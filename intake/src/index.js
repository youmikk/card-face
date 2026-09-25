/**
 * 卡面 / logo 提交审核 Worker
 *
 * 安全约定：
 *  - 审核口令只来自 Cloudflare secret REVIEW_PASSWORD；未配置时审核接口一律 503 关闭。
 *    R2 里的 review-password.txt 只在「已通过当前口令认证」时才能写入，且只存 SHA-256 哈希。
 *  - 上传内容按魔术字节判定真实类型，SVG 做安全净化检查，位图限制像素尺寸。
 *  - 所有 /files、/review/file 响应带 nosniff + CSP sandbox，禁止脚本在 worker 源上执行。
 *  - records.json / catalog.json 用 R2 条件写（ETag）做乐观锁，避免并发覆盖。
 */

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_SIDE = 12000;
const MAX_PIXELS = 40 * 1000 * 1000;
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 200;
const PENDING_LIMIT = 300;
const SUBMIT_PER_HOUR = 20;
const AUTH_FAIL_LIMIT = 10;
const AUTH_FAIL_WINDOW = 10 * 60 * 1000;
const RECORD_TTL_DAYS = 30;
const HIDDEN_TTL_DAYS = 30;

const PASSWORD_KEY = "review-password.txt";
const RECORDS_KEY = "records.json";
const CATALOG_KEY = "catalog.json";

const ROLES = ["plain", "bank", "other"];
const STATUS = { pending: "pending", approved: "approved", rejected: "rejected", hidden: "hidden" };
const TYPES = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };

const DEFAULT_CATALOG = () => ({
  categories: [
    { id: "solid", name: "纯色", kind: "face", role: "plain" },
    { id: "bank", name: "银行", kind: "face", role: "plain" },
    { id: "transit", name: "交通", kind: "face", role: "plain" },
    { id: "other", name: "其他", kind: "face", role: "other" },
    { id: "banks", name: "银行", kind: "logo", role: "bank" },
    { id: "transit-logo", name: "交通", kind: "logo", role: "plain" },
    { id: "official", name: "卡组织", kind: "logo", role: "plain" },
    { id: "payment", name: "支付方式", kind: "logo", role: "plain" },
  ],
  hidden: [],
});

const DAY = 24 * 60 * 60 * 1000;

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      console.error("intake error", error && error.stack ? error.stack : error);
      return json({ error: "server" }, 500);
    }
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  if (url.pathname === "/manifest" && request.method === "GET") return manifest(request, env);
  if (url.pathname === "/submit" && request.method === "POST") return submit(request, env);
  if (url.pathname === "/review" && request.method === "GET") return reviewPage();
  if (url.pathname === "/review/password" && request.method === "GET") return passwordState(env);
  if (url.pathname === "/review/password" && request.method === "POST") return passwordSet(request, env);
  if (url.pathname === "/review/password" && request.method === "DELETE") return passwordClear(request, env);
  if (url.pathname === "/review/catalog" && request.method === "GET") return catalogGet(request, env);
  if (url.pathname === "/review/catalog" && request.method === "POST") return catalogAction(request, env);
  if (url.pathname === "/review/items" && request.method === "GET") return reviewItems(request, env);
  if (url.pathname === "/review/items" && request.method === "POST") return reviewAction(request, env);
  const pending = url.pathname.match(/^\/review\/file\/([A-Za-z0-9_-]+)$/);
  if (pending && request.method === "GET") return reviewFile(request, env, pending[1]);
  const file = url.pathname.match(/^\/files\/([A-Za-z0-9_-]+)$/);
  if (file && request.method === "GET") return publicFile(request, env, file[1]);
  return new Response("not found", { status: 404 });
}

/* ---------------------------------------------------------------- 基础工具 */

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

const rateBuckets = new Map();

function withinLimit(key, limit, windowMs) {
  const now = Date.now();
  let entry = rateBuckets.get(key);
  if (!entry || entry.reset <= now) {
    entry = { count: 0, reset: now + windowMs };
    rateBuckets.set(key, entry);
  }
  entry.count += 1;
  if (rateBuckets.size > 5000) {
    for (const [name, value] of rateBuckets) if (value.reset <= now) rateBuckets.delete(name);
  }
  return entry.count <= limit;
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(response.body, { status: response.status, headers });
}

function json(data, status = 200) {
  const response = cors(Response.json(data, { status }));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function denied(status = 401) {
  const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
  if (status === 429) headers["Retry-After"] = "600";
  return new Response(status === 429 ? "too many requests" : "unauthorized", { status, headers });
}

/* 认证失败计数：只统计失败，成功即清零（尽力而为，见 README 的限速建议） */
const authFailures = new Map();

function authBlocked(key, now = Date.now()) {
  const entry = authFailures.get(key);
  return Boolean(entry && entry.until > now && entry.count >= AUTH_FAIL_LIMIT);
}

function authFailed(key, now = Date.now()) {
  const entry = authFailures.get(key) || { count: 0, until: 0 };
  entry.count += 1;
  entry.until = now + AUTH_FAIL_WINDOW;
  authFailures.set(key, entry);
  if (authFailures.size > 5000) {
    for (const [name, value] of authFailures) if (value.until <= now) authFailures.delete(name);
  }
}

function authPassed(key) {
  authFailures.delete(key);
}

async function sha256hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function objectText(object) {
  if (typeof object.text === "function") return object.text();
  return new TextDecoder().decode(await new Response(object.body).arrayBuffer());
}

/* ------------------------------------------------------------ 口令与鉴权 */

async function passwordInfo(env) {
  let legacy = false;
  const saved = await env.BUCKET.get(PASSWORD_KEY);
  if (saved) {
    const text = (await objectText(saved)).trim();
    if (/^sha256:[0-9a-f]{64}$/.test(text)) return { source: "r2", digest: text.slice(7), legacy: false };
    legacy = true; // 旧版明文口令文件：忽略，避免被预先占用
  }
  const fallback = String(env.REVIEW_PASSWORD || "").trim();
  if (fallback) return { source: "env", digest: await sha256hex(fallback), legacy };
  return { source: "none", digest: null, legacy };
}

async function authorized(request, env) {
  const info = await passwordInfo(env);
  if (!info.digest) return false;
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  return timingSafeEqual(await sha256hex(token), info.digest);
}

/** 审核接口统一入口：未配置口令 → 503；认证失败 → 401；连续失败过多 → 429。 */
async function guard(request, env) {
  const info = await passwordInfo(env);
  if (!info.digest) return { error: json({ error: "not-configured" }, 503) };
  const key = `auth:${clientIp(request)}`;
  if (authBlocked(key)) return { error: denied(429) };
  if (!(await authorized(request, env))) {
    authFailed(key);
    return { error: denied(401) };
  }
  authPassed(key);
  return { ok: true };
}

async function passwordState(env) {
  const info = await passwordInfo(env);
  return json({ ready: Boolean(info.digest), source: info.source, legacy: info.legacy });
}

/** 轮换口令：必须先持有当前口令；R2 里只写哈希。 */
async function passwordSet(request, env) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  const body = await request.json().catch(() => null);
  const password = String(body?.password || "").trim();
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return json({ error: "password", min: MIN_PASSWORD }, 400);
  }
  await env.BUCKET.put(PASSWORD_KEY, `sha256:${await sha256hex(password)}`, {
    httpMetadata: { contentType: "text/plain" },
  });
  return json({ ok: true });
}

/**
 * 清除 R2 里的口令哈希，让口令重新由 REVIEW_PASSWORD 控制。
 * 必须先通过当前口令认证，否则等于给任何人关闭后台的机会。
 */
async function passwordClear(request, env) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  await env.BUCKET.delete(PASSWORD_KEY);
  return json({ ok: true, source: String(env.REVIEW_PASSWORD || "").trim() ? "env" : "none" });
}

/* ------------------------------------------------------------ 存储读写 */

let conditionalWrites = null; // null = 未知，true/false = 探测结果

function conditionFailure(error) {
  const message = String((error && error.message) || error);
  return /precondition|etag|not match|412|304/i.test(message) && !/not (supported|implemented)|invalid (argument|option)|unknown/i.test(message);
}

function unsupportedCondition(error) {
  const message = String((error && error.message) || error);
  // 必须同时提到 onlyIf/etag/conditional，并且是「不支持/参数非法」这类签名，
  // 否则普通的瞬时错误会被误判成降级条件，永久关掉乐观锁。
  if (!/(onlyif|etag|conditional|condition)/i.test(message)) return false;
  return /not (supported|implemented)|invalid (argument|option|parameter)|unsupported|unrecognized/i.test(message);
}

async function readJson(env, key, fallback) {
  const object = await env.BUCKET.get(key);
  if (!object) return { data: fallback(), etag: null };
  const parsed = await object.json().catch(() => null);
  return { data: parsed === null || parsed === undefined ? fallback() : parsed, etag: object.etag || null };
}

async function putJson(env, key, data, etag) {
  const body = JSON.stringify(data);
  const meta = { contentType: "application/json" };
  if (conditionalWrites !== false) {
    try {
      const result = await env.BUCKET.put(key, body, {
        httpMetadata: meta,
        onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
      });
      conditionalWrites = true;
      return result !== null && result !== undefined;
    } catch (error) {
      if (conditionFailure(error)) return false;
      if (!unsupportedCondition(error)) throw error;
      conditionalWrites = false; // 运行时不支持条件写：降级为无锁写入（见 README）
      console.warn("intake: R2 条件写不可用，已降级为无锁写入：", String((error && error.message) || error));
    }
  }
  await env.BUCKET.put(key, body, { httpMetadata: meta });
  return true;
}

/**
 * 读改写 + 乐观锁。mutator 就地修改 data，返回 { commit, result }；
 * commit 为 false 表示无需写入（直接返回结果）；写入冲突时重试。
 */
async function mutateJson(env, key, fallback, mutator, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, etag } = await readJson(env, key, fallback);
    const outcome = await mutator(data);
    if (!outcome || outcome.commit === false) return outcome ? outcome.result : undefined;
    if (await putJson(env, key, data, etag)) return outcome.result;
    await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
  }
  throw new Error(`conflict on ${key}`);
}

const recordsList = () => [];
const catalogDefault = () => DEFAULT_CATALOG();

function records(env) {
  return readJson(env, RECORDS_KEY, recordsList).then((entry) => (Array.isArray(entry.data) ? entry.data : []));
}

function mutateRecords(env, mutator) {
  return mutateJson(env, RECORDS_KEY, recordsList, (data) => {
    if (!Array.isArray(data)) return { commit: false, result: [] };
    return mutator(data);
  });
}

function catalog(env) {
  return readJson(env, CATALOG_KEY, catalogDefault).then((entry) => normalizeCatalog(entry.data));
}

function mutateCatalog(env, mutator) {
  return mutateJson(env, CATALOG_KEY, catalogDefault, (data) => mutator(normalizeCatalog(data)));
}

function legacyRole(category) {
  if (category.kind === "logo" && category.name === "银行") return "bank";
  if (category.name === "其他") return "other";
  return "plain";
}

function normalizeCatalog(data) {
  const source = data && typeof data === "object" && !Array.isArray(data) ? data : catalogDefault();
  const list = Array.isArray(source.categories) ? source.categories : [];
  const categories = list
    .filter((entry) => entry && entry.id && entry.name)
    .map((entry) => ({
      id: String(entry.id),
      name: String(entry.name).slice(0, 16),
      kind: entry.kind === "logo" ? "logo" : "face",
      role: ROLES.includes(entry.role) ? entry.role : legacyRole(entry),
    }));
  // 就地写回：mutateCatalog 依赖返回对象即传入对象，改动才能被序列化保存
  source.categories = categories.length ? categories : catalogDefault().categories;
  source.hidden = Array.isArray(source.hidden) ? [...new Set(source.hidden.map(String))] : [];
  return source;
}

function publicCategories(data) {
  return normalizeCatalog(data).categories.map((entry) => ({
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    role: entry.role,
  }));
}

/* -------------------------------------------------------- 内容类型与校验 */

function ascii(bytes, offset, length) {
  let out = "";
  for (let i = offset; i < offset + length && i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

/** 按内容（魔术字节）判定真实类型，不信任客户端声明的 MIME。 */
function detectType(bytes) {
  if (bytes.length >= 8 && ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  const head = new TextDecoder("utf-8").decode(bytes.subarray(0, 4096)).trimStart().toLowerCase();
  const looksLikeSvg = head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!--") || head.startsWith("<!doctype");
  if (!looksLikeSvg) return "";
  const text = new TextDecoder("utf-8").decode(bytes);
  return /<svg[\s>]/i.test(text) ? "svg" : "";
}

const SVG_DANGER = [
  /<script/i,
  /<\s*foreignobject/i,
  /<\s*(iframe|embed|object|meta|link|base|frame|frameset|audio|video|canvas|animate\s+set)/i,
  /\son[a-z]+\s*=/i,
  /javascript:/i,
  /<!entity/i,
  /<!doctype[^>]*system/i,
  /(?:xlink:)?href\s*=\s*["']?\s*(?:data:|https?:|\/\/)/i,
  /url\(\s*["']?\s*(?:data:|https?:|\/\/)/i,
];

/** SVG 提交净化：命中危险构造直接拒绝（不做改写，避免绕过）。 */
function isSafeSvg(text) {
  if (typeof text !== "string" || !text) return false;
  if (/<svg[\s>]/i.test(text) === false) return false;
  return !SVG_DANGER.some((pattern) => pattern.test(text));
}

function be16(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function be32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function le24(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

/** 解析位图宽高，用于拦截像素炸弹；解析不出时返回 null（不拦截）。 */
function imageSize(type, bytes) {
  if (type === "png") {
    if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return null;
    return { width: be32(bytes, 16), height: be32(bytes, 20) };
  }
  if (type === "jpg") {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      const length = be16(bytes, offset + 2);
      if (length < 2) return { invalid: true };
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { height: be16(bytes, offset + 5), width: be16(bytes, offset + 7) };
      if (marker === 0xda) return null;
      offset += 2 + length;
    }
    return null;
  }
  if (type === "webp") {
    const chunk = ascii(bytes, 12, 4);
    if (chunk === "VP8X" && bytes.length >= 30) {
      return { width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
    }
    if (chunk === "VP8L" && bytes.length >= 25) {
      const bits = (bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)) >>> 0;
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8 " && bytes.length >= 30) {
      for (let i = 20; i < 30 && i + 6 < bytes.length; i += 1) {
        if (bytes[i] === 0x9d && bytes[i + 1] === 0x01 && bytes[i + 2] === 0x2a) {
          return { width: (bytes[i + 3] | (bytes[i + 4] << 8)) & 0x3fff, height: (bytes[i + 5] | (bytes[i + 6] << 8)) & 0x3fff };
        }
      }
    }
    return null;
  }
  return null;
}

function tooLarge(size) {
  if (!size) return false;
  if (size.invalid) return true; // 结构损坏时按不可信处理，避免绕过像素上限
  return size.width > MAX_SIDE || size.height > MAX_SIDE || size.width * size.height > MAX_PIXELS;
}

/* ------------------------------------------------------------ 公开接口 */

async function manifest(request, env) {
  const origin = new URL(request.url).origin;
  const data = await catalog(env);
  const hidden = new Set(data.hidden);
  const items = (await records(env))
    .filter((item) => item.status === STATUS.approved && !hidden.has(item.id))
    .map((item) => publicItem(item, origin));
  return json({ items, categories: publicCategories(data) });
}

async function submit(request, env) {
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > MAX_BYTES + 64 * 1024) return json({ error: "big" }, 413);
  if (!withinLimit(`submit:${clientIp(request)}`, SUBMIT_PER_HOUR, 60 * 60 * 1000)) {
    return json({ error: "rate" }, 429);
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "form" }, 400);
  }
  const name = String(form.get("name") || "").trim().slice(0, 40);
  const kind = String(form.get("kind") || "");
  const category = String(form.get("category") || "");
  const bank = String(form.get("bank") || "");
  const label = String(form.get("label") || "").trim().slice(0, 24);
  const file = form.get("file");
  const data = await catalog(env);
  const target = data.categories.find((entry) => entry.id === category && entry.kind === (kind === "logo" ? "logo" : "face"));
  if (!name || (kind !== "face" && kind !== "logo") || !target || !(file instanceof File)) {
    return json({ error: "fields" }, 400);
  }
  if (file.size <= 0 || file.size > MAX_BYTES) return json({ error: "big" }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectType(bytes);
  if (!type || !TYPES[type]) return json({ error: "file" }, 400);
  if (type === "svg") {
    const text = new TextDecoder("utf-8").decode(bytes);
    if (!isSafeSvg(text)) return json({ error: "svg" }, 400);
  } else if (tooLarge(imageSize(type, bytes))) {
    return json({ error: "size", maxSide: MAX_SIDE }, 400);
  }

  const needsBank = kind === "logo" && target.role === "bank";
  if (needsBank && !/^[A-Za-z0-9_-]{2,16}$/.test(bank)) return json({ error: "bank" }, 400);

  const id = crypto.randomUUID().replace(/-/g, "");
  const key = `pending/${id}.${type}`;
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: TYPES[type] } });

  try {
    const appended = await mutateRecords(env, (items) => {
      if (items.filter((entry) => entry.status === STATUS.pending).length >= PENDING_LIMIT) {
        return { commit: false, result: false };
      }
      items.push({
        id,
        kind,
        name,
        category,
        bank: needsBank ? bank : "",
        label,
        type,
        key,
        status: STATUS.pending,
        created: new Date().toISOString(),
      });
      return { commit: true, result: true };
    });
    if (!appended) {
      await env.BUCKET.delete(key);
      return json({ error: "quota" }, 429);
    }
  } catch (error) {
    await env.BUCKET.delete(key);
    throw error;
  }
  return json({ ok: true });
}

function fileHeaders(item, cache) {
  const headers = new Headers();
  const type = TYPES[item.type] || "application/octet-stream";
  headers.set("Content-Type", type);
  headers.set("Cache-Control", cache ? "public, max-age=86400" : "private, no-store");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  // sandbox 让文档以不透明源加载并禁用脚本：即使被直接打开也无法执行 SVG 内的脚本
  headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; sandbox");
  return headers;
}

async function objectResponse(env, item, cache) {
  const object = await env.BUCKET.get(item.key);
  if (!object) return new Response("not found", { status: 404 });
  return new Response(object.body, { headers: fileHeaders(item, cache) });
}

async function publicFile(request, env, id) {
  const data = await catalog(env);
  if (data.hidden.includes(id)) return new Response("not found", { status: 404 });
  const item = (await records(env)).find((entry) => entry.id === id && entry.status === STATUS.approved);
  if (!item) return new Response("not found", { status: 404 });
  return objectResponse(env, item, true);
}

async function reviewFile(request, env, id) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  const item = (await records(env)).find((entry) => entry.id === id && entry.status !== STATUS.rejected);
  if (!item) return new Response("not found", { status: 404 });
  return objectResponse(env, item, false);
}

function publicItem(item, origin) {
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    category: item.category,
    bank: item.bank || "",
    label: item.label || "",
    url: `${origin}/files/${item.id}`,
    width: 132,
  };
}

/* ------------------------------------------------------------ 审核接口 */

async function reviewItems(request, env) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  await housekeeping(env).catch(() => {});
  const items = (await records(env)).filter((item) => item.status === STATUS.pending);
  return json({ items });
}

async function catalogGet(request, env) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  await housekeeping(env).catch(() => {});
  const data = await catalog(env);
  const all = await records(env);
  const hidden = new Set(data.hidden);
  const items = all.filter((item) => item.status === STATUS.approved && !hidden.has(item.id));
  const hiddenItems = all
    .filter((item) => item.status === STATUS.hidden)
    .map((item) => ({ id: item.id, name: item.name, kind: item.kind, category: item.category }));
  return json({ categories: data.categories, items, hidden: hiddenItems });
}

async function reviewAction(request, env) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  const body = await request.json().catch(() => null);
  if (!body || !body.id) return json({ error: "fields" }, 400);
  const data = await catalog(env);
  const outcome = await mutateRecords(env, async (items) => {
    const item = items.find((entry) => entry.id === body.id);
    if (!item) return { commit: false, result: { error: "missing", status: 404 } };
    // 只处理待审条目：已通过的要用「隐藏」（软删除），否则会删掉线上文件且无法恢复；
    // 被拒绝的条目文件已删除，也不能再通过。
    if (item.status !== STATUS.pending) return { commit: false, result: { error: "state", status: 409 } };
    if (body.action === "reject") {
      const key = item.key || "";
      item.status = STATUS.rejected;
      item.rejectedAt = Date.now();
      item.key = "";
      return { commit: true, result: { ok: true, key } };
    }
    if (body.action !== "approve") return { commit: false, result: { error: "action", status: 400 } };
    const target = data.categories.find((entry) => entry.id === body.category && entry.kind === item.kind);
    if (!target) return { commit: false, result: { error: "category", status: 400 } };
    const label = String(body.label || item.label || "").trim().slice(0, 24);
    if (target.role === "bank" && !/^[A-Za-z0-9_-]{2,16}$/.test(String(body.bank || ""))) {
      return { commit: false, result: { error: "bank", status: 400 } };
    }
    if (!item.key) return { commit: false, result: { error: "file", status: 404 } };
    item.category = target.id;
    item.bank = target.role === "bank" ? String(body.bank || "") : "";
    if (body.name) item.name = String(body.name).trim().slice(0, 40) || item.name;
    item.label = label;
    // 通过后把对象从 pending/ 迁到 approved/（幂等：重试时源已不在则接受已迁移的目标）
    const next = `approved/${item.id}.${item.type}`;
    if (item.key !== next) {
      const object = await env.BUCKET.get(item.key);
      if (object) {
        await env.BUCKET.put(next, object.body, { httpMetadata: object.httpMetadata });
        await env.BUCKET.delete(item.key);
      } else if (!(await env.BUCKET.head(next))) {
        return { commit: false, result: { error: "file", status: 404 } };
      }
      item.key = next;
    }
    item.status = STATUS.approved;
    delete item.hiddenAt;
    delete item.hiddenFrom;
    return { commit: true, result: { ok: true, key: item.id } };
  });
  if (outcome && outcome.error) return json({ error: outcome.error }, outcome.status);
  if (body.action === "reject" && outcome && outcome.key) {
    await env.BUCKET.delete(outcome.key);
  }
  return json({ ok: true });
}

async function catalogAction(request, env) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  const body = await request.json().catch(() => null);
  if (!body || !body.action) return json({ error: "fields" }, 400);
  // 只改记录的动作各用自己的乐观锁，不必整份重写分类
  if (body.action === "move-face") {
    const data = await catalog(env);
    const outcome = await mutateRecords(env, (items) => {
      const item = items.find((entry) => entry.id === body.id);
      if (!item) return { commit: false, result: { error: "missing", status: 404 } };
      const target = data.categories.find((entry) => entry.id === body.category && entry.kind === item.kind);
      if (!target) return { commit: false, result: { error: "category", status: 400 } };
      item.category = target.id;
      if (item.kind === "logo") item.bank = target.role === "bank" ? item.bank : "";
      return { commit: true, result: { ok: true } };
    });
    if (outcome && outcome.error) return json({ error: outcome.error }, outcome.status);
    return json({ ok: true });
  }
  if (body.action === "rename-item") {
    const name = String(body.name || "").trim().slice(0, 40);
    if (!name) return json({ error: "name" }, 400);
    const outcome = await mutateRecords(env, (items) => {
      const item = items.find((entry) => entry.id === body.id);
      if (!item) return { commit: false, result: { error: "missing", status: 404 } };
      item.name = name;
      return { commit: true, result: { ok: true } };
    });
    if (outcome && outcome.error) return json({ error: outcome.error }, outcome.status);
    return json({ ok: true });
  }
  // 其余动作会改动 catalog.json，全部走乐观锁；mutator 内的记录改动是幂等的，
  // 冲突重试时重复执行不会产生额外副作用。
  const outcome = await mutateCatalog(env, async (data) => {
    const fail = (error, status) => ({ commit: false, result: { error, status } });
    if (body.action === "add-category" || body.action === "rename-category") {
      const name = String(body.name || "").trim().slice(0, 16);
      if (!name) return fail("name", 400);
      const role = ROLES.includes(body.role) ? body.role : "plain";
      if (body.action === "rename-category") {
        const target = data.categories.find((entry) => entry.id === body.id);
        if (!target) return fail("category", 400);
        target.name = name;
      } else {
        let newId = "";
        do { newId = crypto.randomUUID().replace(/-/g, "").slice(0, 12); } while (data.categories.some((entry) => entry.id === newId));
        data.categories.push({ id: newId, name, kind: body.kind === "logo" ? "logo" : "face", role });
      }
      return { commit: true, result: { ok: true } };
    }
    if (body.action === "set-role") {
      const target = data.categories.find((entry) => entry.id === body.id);
      if (!target) return fail("category", 400);
      if (!ROLES.includes(body.role)) return fail("role", 400);
      target.role = body.role;
      return { commit: true, result: { ok: true } };
    }
    if (body.action === "remove-category") {
      const target = data.categories.find((entry) => entry.id === body.id);
      if (!target) return fail("category", 400);
      if (body.confirm !== true) {
        const all = await records(env);
        const affected = all.filter((item) => item.kind === target.kind && item.category === target.id);
        return { commit: false, result: { ok: false, needConfirm: true, affected: { items: affected.length, hidden: true } } };
      }
      const siblings = data.categories.filter((entry) => entry.kind === target.kind && entry.id !== target.id);
      const hiddenIds = (await mutateRecords(env, (items) => {
        const moved = [];
        items.forEach((item) => {
          if (item.kind !== target.kind) return;
          if (item.category === target.id) {
            item.category = siblings.length ? siblings[0].id : "";
            item.status = STATUS.hidden;
            item.hiddenAt = Date.now();
            item.hiddenFrom = target.id;
          }
          // 重试路径上条目已迁移过，靠 hiddenFrom 仍能把它记回隐藏清单
          if (item.status === STATUS.hidden && item.hiddenFrom === target.id) moved.push(item.id);
        });
        return { commit: moved.length > 0, result: moved };
      })) || [];
      data.categories = data.categories.filter((entry) => entry.id !== target.id);
      data.hidden = [...new Set([...data.hidden, ...hiddenIds])];
      return { commit: true, result: { ok: true, hidden: hiddenIds.length } };
    }
    if (body.action === "restore-item") {
      const restored = await mutateRecords(env, (items) => {
        const item = items.find((entry) => entry.id === body.id);
        if (!item) return { commit: false, result: { error: "missing", status: 404 } };
        if (item.status !== STATUS.hidden) return { commit: false, result: { error: "state", status: 409 } };
        const exists = item.category && data.categories.some((entry) => entry.id === item.category && entry.kind === item.kind);
        if (!exists) {
          const fallback = data.categories.find((entry) => entry.kind === item.kind);
          if (!fallback) return { commit: false, result: { error: "category", status: 400 } };
          item.category = fallback.id;
        }
        item.status = STATUS.approved;
        delete item.hiddenAt;
        delete item.hiddenFrom;
        return { commit: true, result: { ok: true } };
      });
      if (restored && restored.error) return { commit: false, result: restored };
      data.hidden = data.hidden.filter((id) => id !== body.id);
      return { commit: true, result: { ok: true } };
    }
    if (body.action === "move-category") {
      const index = data.categories.findIndex((entry) => entry.id === body.id);
      const next = index + (body.direction === "up" ? -1 : 1);
      if (index < 0 || next < 0 || next >= data.categories.length) return fail("move", 400);
      if (data.categories[index].kind !== data.categories[next].kind) return fail("move", 400);
      const [entry] = data.categories.splice(index, 1);
      data.categories.splice(next, 0, entry);
      return { commit: true, result: { ok: true } };
    }
    if (body.action === "hide-item" || body.action === "hide-face") {
      const hidden = await mutateRecords(env, (items) => {
        const item = items.find((entry) => entry.id === body.id);
        if (!item) return { commit: false, result: { error: "missing", status: 404 } };
        if (item.status === STATUS.hidden) return { commit: false, result: { ok: true } };
        item.status = STATUS.hidden;
        item.hiddenAt = Date.now();
        return { commit: true, result: { ok: true } };
      });
      if (hidden && hidden.error) return { commit: false, result: hidden };
      data.hidden = [...new Set([...data.hidden, String(body.id)])];
      return { commit: true, result: { ok: true } };
    }
    return fail("action", 400);
  });
  if (outcome && outcome.error) return json({ error: outcome.error }, outcome.status || 400);
  return json(outcome || { ok: true });
}

/**
 * 过期清理：拒绝的条目 30 天后移除记录；隐藏的内容 30 天后连同文件一起删除。
 * 年龄按「进入该状态的时间」计算，否则刚隐藏的老条目会被立刻清掉。
 * 待删除清单只取自提交成功的那一次 mutator 结果，避免重试时累积。
 */
async function housekeeping(env) {
  const now = Date.now();
  const outcome = await mutateRecords(env, (items) => {
    const keep = [];
    const doomed = [];
    const ids = [];
    items.forEach((item) => {
      const since = Date.parse(item.hiddenAt || item.rejectedAt || item.created || 0);
      const age = Number.isFinite(since) ? now - since : 0;
      if (item.status === STATUS.rejected && age > RECORD_TTL_DAYS * DAY) {
        ids.push(item.id);
        return;
      }
      if (item.status === STATUS.hidden && age > HIDDEN_TTL_DAYS * DAY) {
        ids.push(item.id);
        doomed.push(item);
        return;
      }
      keep.push(item);
    });
    if (keep.length === items.length) return { commit: false, result: { doomed: [], ids: [] } };
    items.length = 0;
    items.push(...keep);
    return { commit: true, result: { doomed, ids } };
  });
  const { doomed, ids } = outcome || { doomed: [], ids: [] };
  if (!doomed.length && !ids.length) return;
  await Promise.all(doomed.map((item) => (item.key ? env.BUCKET.delete(item.key) : null)));
  const dropped = new Set(ids);
  await mutateCatalog(env, (data) => {
    const next = data.hidden.filter((id) => !dropped.has(id));
    if (next.length === data.hidden.length) return { commit: false };
    data.hidden = next;
    return { commit: true };
  });
}

/* ------------------------------------------------------------ 审核页面 */

async function reviewPage() {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const html = PAGE_TEMPLATE.replace("__NONCE__", nonce);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' blob: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    },
  });
}

const PAGE_TEMPLATE = `<!doctype html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>审核</title>
<style>
  body { margin: 0; background: #f4f6f8; color: #1d2733; font: 14px/1.5 "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 12px; padding: 16px 22px; background: rgba(255,255,255,.94); border-bottom: 1px solid #e4e8ee; flex-wrap: wrap; }
  header strong { font-size: 18px; }
  header span, .muted { color: #667385; }
  header .grow { flex: 1; }
  main { width: min(1080px, calc(100% - 28px)); margin: 22px auto 48px; display: grid; gap: 16px; }
  section { padding: 16px; border: 1px solid #e4e8ee; border-radius: 18px; background: #fff; box-shadow: 0 10px 30px rgba(27,43,64,.06); }
  h2 { margin: 0 0 12px; font-size: 16px; }
  .cats, .add, .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .cat { display: flex; align-items: center; gap: 4px; padding: 4px; border: 1px solid #e4e8ee; border-radius: 999px; background: #f8fafc; }
  .cat.active { border-color: #1b2b40; background: #fff; }
  .cat .name { background: transparent; font-weight: 650; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-top: 14px; }
  .card { overflow: hidden; border: 1px solid #e4e8ee; border-radius: 14px; background: #f8fafc; }
  .card img { display: block; width: 100%; height: 132px; object-fit: cover; background: #eef2f6; }
  .card div { display: grid; gap: 8px; padding: 10px; }
  article { display: grid; grid-template-columns: 220px 1fr; gap: 16px; padding: 14px; margin: 12px 0; border: 1px solid #e4e8ee; border-radius: 16px; background: #f8fafc; }
  article img { width: 100%; height: 138px; object-fit: contain; border-radius: 12px; background: #eef2f6; }
  label { display: grid; gap: 4px; margin: 8px 0; color: #667385; }
  label[hidden] { display: none; }
  input, select { min-height: 38px; border: 1px solid #e4e8ee; border-radius: 10px; padding: 0 10px; background: #fff; color: #1d2733; }
  .add { margin-top: 12px; }
  .add input { flex: 1; min-width: 160px; }
  button { min-height: 34px; border: 0; border-radius: 10px; padding: 0 12px; background: #eef2f6; color: #1d2733; cursor: pointer; }
  button:disabled { opacity: .4; cursor: default; }
  .ok { background: #1b2b40; color: #fff; }
  .no { background: #fff; color: #c44747; box-shadow: inset 0 0 0 1px #f0d0d0; }
  .empty { margin: 8px 0 0; }
  .notice { margin: 0; padding: 10px 14px; border-radius: 12px; background: #fff6e6; color: #7a5a12; }
  .hidden-row { display: flex; align-items: center; gap: 10px; padding: 10px; margin: 8px 0; border: 1px solid #e4e8ee; border-radius: 12px; background: #f8fafc; }
  .hidden-row .grow { flex: 1; }
  @media (max-width: 700px) { article { grid-template-columns: 1fr; } }
</style>
<header>
  <strong>卡面审核</strong>
  <span class="grow">管理分类和已经出现在网页上的内容</span>
  <button type="button" id="change-password">修改口令</button>
</header>
<main>
  <p class="notice" id="notice" hidden></p>
  <section id="catalog"></section>
  <section><h2>待处理</h2><div id="list"></div></section>
  <section><h2>已隐藏</h2><div id="hidden"></div></section>
</main>
<script nonce="__NONCE__">
let token = "";
let openCategory = "";
let catalogData = { categories: [], items: [], hidden: [] };
const previews = [];

function auth() { return token ? { Authorization: "Bearer " + token } : {}; }
function notice(message, kind) {
  const node = document.querySelector("#notice");
  if (!message) { node.hidden = true; node.textContent = ""; return; }
  node.hidden = false;
  node.textContent = message;
  node.style.background = kind === "warn" ? "#fff6e6" : "#eef6ff";
  node.style.color = kind === "warn" ? "#7a5a12" : "#1b3a5c";
}
function message(text) {
  const list = document.querySelector("#list");
  list.replaceChildren();
  const node = document.createElement("p");
  node.className = "muted empty";
  node.textContent = text;
  list.append(node);
}
function post(path, body) {
  return authed(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function authed(path, options) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    token = token || sessionStorage.getItem("review-token") || "";
    if (!token) {
      const typed = (prompt("审核密码") || "").trim();
      if (!typed) return { ok: false, status: 0 };
      token = typed;
      sessionStorage.setItem("review-token", token);
    }
    const config = Object.assign({}, options, { headers: Object.assign({}, (options && options.headers) || {}, auth()) });
    const response = await fetch(path, config);
    if (response.status !== 401) return response;
    token = "";
    sessionStorage.removeItem("review-token");
  }
  return { ok: false, status: 401 };
}
function catalogSend(body) {
  return post("/review/catalog", body).then((response) => {
    if (response.ok) return load();
    if (response.status === 429) notice("操作太频繁，请稍后再试。", "warn");
    return null;
  });
}
function roleLabel(role) { return role === "bank" ? "银行" : role === "other" ? "其他（需要备注）" : "普通"; }
function roleOptions(select, current) {
  [["plain", "普通"], ["bank", "银行"], ["other", "其他（需要备注）"]].forEach(function (entry) {
    select.append(Object.assign(document.createElement("option"), { value: entry[0], textContent: entry[1] }));
  });
  select.value = current || "plain";
}
function drawCatalog() {
  const groups = catalogData.categories.map(function (entry) {
    return { id: entry.id, name: entry.name, kind: entry.kind || "face", role: entry.role || "plain" };
  });
  if (!groups.some(function (entry) { return entry.kind + ":" + entry.id === openCategory; })) {
    openCategory = groups.length ? groups[0].kind + ":" + groups[0].id : "";
  }
  const current = groups.find(function (entry) { return entry.kind + ":" + entry.id === openCategory; });
  const box = document.querySelector("#catalog");
  box.replaceChildren();
  const title = document.createElement("h2");
  title.textContent = "分类";
  const note = document.createElement("p");
  note.className = "muted";
  note.textContent = "点开一个分类后只显示里面的内容。角色决定提交表单要填什么（银行编号 / 备注）。";
  const cats = document.createElement("div");
  cats.className = "cats";
  groups.forEach(function (entry) {
    const row = document.createElement("div");
    row.className = "cat" + (entry === current ? " active" : "");
    const open = document.createElement("button");
    open.type = "button";
    open.className = "name";
    open.textContent = (entry.kind === "face" ? "卡面 · " : "Logo · ") + entry.name;
    open.addEventListener("click", function () { openCategory = entry.kind + ":" + entry.id; drawCatalog(); });
    const role = document.createElement("select");
    roleOptions(role, entry.role);
    role.addEventListener("change", function () { catalogSend({ action: "set-role", id: entry.id, role: role.value }); });
    const rename = document.createElement("button");
    rename.type = "button";
    rename.textContent = "改名";
    rename.addEventListener("click", function () {
      const name = prompt("分类名称", entry.name);
      if (name && name.trim() && name.trim() !== entry.name) catalogSend({ action: "rename-category", id: entry.id, name: name });
    });
    const same = groups.filter(function (item) { return item.kind === entry.kind; });
    const index = same.indexOf(entry);
    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "上移";
    up.disabled = index === 0;
    up.addEventListener("click", function () { catalogSend({ action: "move-category", id: entry.id, direction: "up" }); });
    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "下移";
    down.disabled = index === same.length - 1;
    down.addEventListener("click", function () { catalogSend({ action: "move-category", id: entry.id, direction: "down" }); });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "no";
    remove.textContent = "隐藏分类";
    remove.addEventListener("click", async function () {
      const first = await post("/review/catalog", { action: "remove-category", id: entry.id });
      if (!first.ok) { notice("操作失败。", "warn"); return; }
      const info = await first.json();
      if (!info.needConfirm) { load(); return; }
      const ok = confirm("将隐藏「" + entry.name + "」里的 " + info.affected.items + " 个条目。隐藏后可恢复，30 天后自动清理。继续？");
      if (!ok) return;
      catalogSend({ action: "remove-category", id: entry.id, confirm: true });
    });
    row.append(open, role, rename, up, down, remove);
    cats.append(row);
  });
  const add = document.createElement("form");
  add.className = "add";
  const kind = document.createElement("select");
  [["face", "卡面"], ["logo", "Logo"]].forEach(function (entry) {
    kind.append(Object.assign(document.createElement("option"), { value: entry[0], textContent: entry[1] }));
  });
  const addRole = document.createElement("select");
  roleOptions(addRole, "plain");
  const input = document.createElement("input");
  input.placeholder = "新分类名称";
  input.maxLength = 16;
  input.required = true;
  const submit = document.createElement("button");
  submit.className = "ok";
  submit.textContent = "添加分类";
  add.append(kind, input, addRole, submit);
  add.addEventListener("submit", function (event) {
    event.preventDefault();
    openCategory = kind.value + ":new";
    catalogSend({ action: "add-category", name: input.value, kind: kind.value, role: addRole.value });
  });
  box.append(title, note, cats, add);
  if (!current) return;
  const heading = document.createElement("h2");
  heading.textContent = (current.kind === "face" ? "卡面 · " : "Logo · ") + current.name + "　角色：" + roleLabel(current.role);
  const cards = document.createElement("div");
  cards.className = "cards";
  const visible = catalogData.items.filter(function (item) { return item.kind === current.kind && item.category === current.id; });
  const choices = catalogData.categories.filter(function (entry) { return entry.kind === current.kind; });
  visible.forEach(function (item) {
    const card = document.createElement("article");
    card.className = "card";
    const preview = document.createElement("img");
    preview.alt = item.name;
    preview.src = "/files/" + item.id;
    const body = document.createElement("div");
    const name = document.createElement("input");
    name.value = item.name;
    name.maxLength = 40;
    name.addEventListener("change", function () { catalogSend({ action: "rename-item", id: item.id, name: name.value }); });
    const category = document.createElement("select");
    choices.forEach(function (entry) {
      category.append(Object.assign(document.createElement("option"), { value: entry.id, textContent: entry.name }));
    });
    category.value = current.id;
    category.addEventListener("change", function () {
      openCategory = current.kind + ":" + category.value;
      catalogSend({ action: "move-face", id: item.id, category: category.value });
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "no";
    remove.textContent = "隐藏";
    remove.addEventListener("click", function () {
      if (!confirm("隐藏「" + item.name + "」？隐藏后可以恢复，30 天后自动清理。")) return;
      catalogSend({ action: "hide-item", id: item.id });
    });
    body.append(name, category, remove);
    card.append(preview, body);
    cards.append(card);
  });
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "muted empty";
    empty.textContent = "这个分类里还没有内容。";
    cards.append(empty);
  }
  box.append(heading, cards);
}
function drawHidden() {
  const box = document.querySelector("#hidden");
  box.replaceChildren();
  const list = catalogData.hidden || [];
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "muted empty";
    empty.textContent = "没有隐藏的内容。";
    box.append(empty);
    return;
  }
  list.forEach(function (item) {
    const row = document.createElement("div");
    row.className = "hidden-row";
    const name = document.createElement("span");
    name.className = "grow";
    name.textContent = (item.kind === "logo" ? "Logo · " : "卡面 · ") + item.name;
    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "ok";
    restore.textContent = "恢复";
    restore.addEventListener("click", function () { catalogSend({ action: "restore-item", id: item.id }); });
    row.append(name, restore);
    box.append(row);
  });
}
function drawItems(items) {
  const list = document.querySelector("#list");
  list.replaceChildren();
  items.forEach(function (item) {
    const card = document.createElement("article");
    const preview = document.createElement("img");
    preview.alt = item.name;
    const body = document.createElement("div");
    const name = document.createElement("label");
    const nameInput = Object.assign(document.createElement("input"), { type: "text", value: item.name, maxLength: 40 });
    name.append("名称", nameInput);
    const category = document.createElement("label");
    const categorySelect = document.createElement("select");
    const options = catalogData.categories.filter(function (entry) { return (entry.kind || "face") === item.kind; });
    if (!options.some(function (entry) { return entry.id === item.category; })) options.push({ id: item.category, name: item.category, role: "plain" });
    options.forEach(function (entry) {
      categorySelect.append(Object.assign(document.createElement("option"), { value: entry.id, textContent: entry.name }));
    });
    categorySelect.value = item.category;
    category.append("分类", categorySelect);
    const bank = document.createElement("label");
    const bankInput = Object.assign(document.createElement("input"), { type: "text", value: item.bank || "" });
    bank.append("银行编号", bankInput);
    const custom = document.createElement("label");
    const customInput = Object.assign(document.createElement("input"), { type: "text", value: item.label || "" });
    custom.append("备注", customInput);
    function selected() {
      return catalogData.categories.find(function (entry) { return entry.id === categorySelect.value; });
    }
    function sync() {
      const target = selected();
      const role = target ? target.role : "plain";
      bank.hidden = !(item.kind === "logo" && role === "bank");
      custom.hidden = role !== "other";
    }
    categorySelect.addEventListener("change", sync);
    sync();
    const row = document.createElement("div");
    row.className = "row";
    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "ok";
    approve.textContent = "通过";
    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "no";
    reject.textContent = "拒绝并删除文件";
    const send = function (action) {
      return post("/review/items", {
        action: action,
        id: item.id,
        name: nameInput.value,
        category: categorySelect.value,
        bank: bankInput.value,
        label: customInput.value,
      }).then(function (response) {
        if (response.ok) load();
        else notice("提交失败：" + response.status, "warn");
      });
    };
    approve.addEventListener("click", function () { send("approve"); });
    reject.addEventListener("click", function () {
      if (!confirm("拒绝并删除服务器上的文件？")) return;
      send("reject");
    });
    row.append(approve, reject);
    body.append(name, category, bank, custom, row);
    card.append(preview, body);
    list.append(card);
    fetch("/review/file/" + item.id, { headers: auth() }).then(function (response) {
      if (!response.ok) return;
      return response.blob().then(function (blob) {
        const url = URL.createObjectURL(blob);
        previews.push(url);
        preview.src = url;
      });
    }).catch(function () {});
  });
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "muted empty";
    empty.textContent = "没有待处理的图片。";
    list.append(empty);
  }
}
async function load() {
  previews.forEach(function (url) { URL.revokeObjectURL(url); });
  previews.length = 0;
  let state = null;
  try { state = await (await fetch("/review/password")).json(); } catch (error) { state = null; }
  if (!state || !state.ready) {
    message("审核口令未配置。请先执行：npx wrangler secret put REVIEW_PASSWORD，然后重新部署。");
    return;
  }
  if (state.legacy) notice("检测到旧版明文口令文件（review-password.txt），已忽略；建议在 R2 里删除它，口令以 REVIEW_PASSWORD 为准。", "warn");
  else notice("");
  const itemsResponse = await authed("/review/items");
  if (!itemsResponse.ok) {
    if (itemsResponse.status === 401) message("口令不正确。刷新页面重新输入。");
    else if (itemsResponse.status === 429) message("尝试次数过多，请稍后再试。");
    else message("审核列表加载失败。");
    return;
  }
  const data = await itemsResponse.json();
  const catalogResponse = await authed("/review/catalog");
  if (catalogResponse.ok) catalogData = await catalogResponse.json();
  drawCatalog();
  drawItems(data.items);
  drawHidden();
}
document.querySelector("#change-password").addEventListener("click", async function () {
  const next = (prompt("新审核密码（至少 12 位）") || "").trim();
  if (next.length < 12) { alert("口令至少 12 位"); return; }
  const response = await post("/review/password", { password: next });
  if (response.ok) {
    token = next;
    sessionStorage.setItem("review-token", token);
    alert("口令已更新。");
  } else if (response.status === 503) alert("尚未配置 REVIEW_PASSWORD，无法轮换。");
  else alert("修改失败：" + response.status);
});
load();
</script>`;

export { detectType, imageSize, isSafeSvg, tooLarge, normalizeCatalog, publicCategories, sha256hex, timingSafeEqual, DEFAULT_CATALOG };
