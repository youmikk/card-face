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
import { BANKS } from "./banks.js";
import { PAGE_TEMPLATE } from "./page.js";
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

/* 内置银行：站点靠 id 把它挂到对应银行上，给人看的是中文名。名单外的名称按自定义银行处理。 */
const BANK_ID_SET = new Set(BANKS.map((entry) => entry[0]));
const BANK_NAMES = new Map(BANKS);
const BANK_NAME_TO_ID = new Map(BANKS.map((entry) => [entry[1], entry[0]]));

/**
 * 银行值归一化：内置银行（写 id、或写中文名）统一存成 id；其它名称当作自定义银行原样存。
 * 返回的 value 是站点用来挂 logo 的键，name 是给人看的名称。
 */
function resolveBank(input) {
  const raw = String(input || "").replace(/\s+/g, " ").trim().slice(0, 24);
  if (!raw || /[\\/]|\.\./.test(raw)) return { value: "", name: "" };
  if (BANK_ID_SET.has(raw)) return { value: raw, name: BANK_NAMES.get(raw) || raw };
  const id = BANK_NAME_TO_ID.get(raw);
  if (id) return { value: id, name: BANK_NAMES.get(id) || raw };
  return { value: raw, name: raw };
}
/** 给人看的银行名称：优先用记录里存下来的（旧数据没存就按 id / 名称推出来）。 */
function bankLabel(item) {
  return item.bankName || resolveBank(item.bank).name;
}

const MANIFEST_KEY = "manifest.json";
const BACKUP_PREFIX = "backups/records-";

const DEFAULT_CATALOG = () => ({
  categories: [
    { id: "solid", name: "纯色", kind: "face", role: "plain" },
    { id: "bank", name: "银行", kind: "face", role: "plain" },
    { id: "transit", name: "交通", kind: "face", role: "plain" },
    { id: "other", name: "其他", kind: "face", role: "other" },
    { id: "banks", name: "银行", kind: "logo", role: "bank" },
    { id: "transit-logo", name: "交通联合", kind: "logo", role: "plain" },
    { id: "official", name: "卡组织素材", kind: "logo", role: "plain" },
    { id: "payment", name: "支付方式", kind: "logo", role: "plain" },
  ],
});

const DAY = 24 * 60 * 60 * 1000;
const THUMB_MAX = 256 * 1024; // 缩略图上限：站点在浏览器里生成小图后跟原图一起提交
const FREE_STORAGE = 10 * 1024 * 1024 * 1024; // R2 免费额度：10 GB（本桶用量估算用）
const USAGE_KEY = "usage.json"; // 用量统计缓存（避免每次打开后台都全量列一遍）

export default {
  async fetch(request, env) {
    try {
      return noIndex(new URL(request.url).pathname, await route(request, env));
    } catch (error) {
      console.error("intake error", error && error.stack ? error.stack : error);
      return json({ error: "server" }, 500);
    }
  },
};

// 审核台整站不进搜索索引：除公开素材 /files/* 外，所有响应统一带 noindex。
// 页面壳（/review）本来就有，这里补齐 404 之类的兜底响应，避免将来新增路由漏掉。
function noIndex(pathname, response) {
  if (pathname.startsWith("/files/") || response.headers.has("X-Robots-Tag")) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  if (url.pathname === "/manifest" && request.method === "GET") return manifest(request, env);
  if (url.pathname === "/robots.txt" && request.method === "GET") {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
    });
  }
  if (url.pathname === "/submit" && request.method === "POST") return submit(request, env);
  if (url.pathname === "/review" && request.method === "GET") return reviewPage();
  if (url.pathname === "/review/password" && request.method === "GET") return passwordState(env);
  if (url.pathname === "/review/usage" && request.method === "GET") return usage(request, env);
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

/** 对原始字节求 SHA-256（内容指纹/去重用），与对文本求值的 sha256hex 区分开。 */
async function sha256bytesHex(bytes) {
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

/* 按 isolate + env 记忆口令信息 / 例行维护时间：预览这类高频请求不必反复读 R2（轮换时主动作废） */
const passwordMemo = new WeakMap();
const housekeepAt = new WeakMap();
function forgetPassword(env) { passwordMemo.delete(env); }

async function passwordInfo(env) {
  const hit = passwordMemo.get(env);
  if (hit && Date.now() - hit.at < 10000) return hit.info;
  const info = await readPasswordInfo(env);
  passwordMemo.set(env, { info, at: Date.now() });
  return info;
}

async function readPasswordInfo(env) {
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

async function authorizedWith(request, info) {
  if (!info.digest) return false;
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  return timingSafeEqual(await sha256hex(token), info.digest);
}

async function authorized(request, env) {
  return authorizedWith(request, await passwordInfo(env));
}
/** 审核接口统一入口：未配置口令 → 503；认证失败 → 401；连续失败过多 → 429。 */
async function guard(request, env) {
  const info = await passwordInfo(env);
  if (!info.digest) return { error: json({ error: "not-configured" }, 503) };
  const key = `auth:${clientIp(request)}`;
  if (authBlocked(key)) return { error: denied(429) };
  if (!(await authorizedWith(request, info))) {
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
  forgetPassword(env); // 轮换后立刻作废本 isolate 的口令缓存
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
  forgetPassword(env);
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

/**
 * 就地归一化清单，并做一次「内置分类补齐」：
 * 老数据里只有少数分类（例如只剩 纯色/卡通/其他）时，缺的内置分类会按 id 补回来，
 * 同时写入 seeded 标记；标记存在之后，运营者在后台的增删就完全生效、不再被补回。
 * 读取路径只在内存里补（立刻对外可见），下一次写入才落盘。
 */
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
  const merged = categories.length ? categories : catalogDefault().categories.map((entry) => ({ ...entry }));
  if (source.seeded !== true) {
    const have = new Set(merged.map((entry) => entry.id));
    catalogDefault().categories.forEach((entry) => {
      if (!have.has(entry.id)) merged.push({ ...entry });
    });
    source.seeded = true;
  }
  source.categories = merged;
  delete source.hidden; // 历史字段：可见性统一以 item.status 为准，不再维护第二份真相
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

async function buildManifest(env, origin) {
  const data = await catalog(env);
  const items = (await records(env))
    .filter((item) => item.status === STATUS.approved)
    .map((item) => publicItem(item, origin, data.categories));
  return { items, categories: publicCategories(data), updated: new Date().toISOString() };
}

/** 状态一变就重建派生清单：/manifest 只需读一个小对象，前台每次访问不再解析整份记录。 */
async function rebuildManifest(env, origin) {
  const data = await buildManifest(env, origin);
  await env.BUCKET.put(MANIFEST_KEY, JSON.stringify(data), { httpMetadata: { contentType: "application/json" } });
  return data;
}

async function manifest(request, env) {
  const origin = new URL(request.url).origin;
  const object = await env.BUCKET.get(MANIFEST_KEY);
  if (object) {
    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    const etag = object.etag ? `"${object.etag}"` : null;
    if (etag) headers.set("ETag", etag);
    if (etag && request.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers });
    return new Response(object.body, { headers });
  }
  // 派生清单还不存在（或写入失败）时即时构建，保证前台始终可用
  return json(await buildManifest(env, origin));
}

async function submit(request, env) {
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > MAX_BYTES + THUMB_MAX + 64 * 1024) return json({ error: "big" }, 413);
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
  const dim = type === "svg" ? null : imageSize(type, bytes);
  if (type === "svg") {
    const text = new TextDecoder("utf-8").decode(bytes);
    if (!isSafeSvg(text)) return json({ error: "svg" }, 400);
  } else if (tooLarge(dim)) {
    return json({ error: "size", maxSide: MAX_SIDE }, 400);
  }

  const needsBank = kind === "logo" && target.role === "bank";
  const bankValue = resolveBank(needsBank ? bank : "");
  if (needsBank && !bankValue.value) return json({ error: "bank" }, 400);

  const id = crypto.randomUUID().replace(/-/g, "");
  const key = `pending/${id}.${type}`;
  const hash = await sha256bytesHex(bytes);
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: TYPES[type] } });
  // 可选缩略图（站点在浏览器里生成）：审核台列表只加载它，不用下原图
  const thumbKey = `pending/${id}.thumb`;
  const thumbFile = form.get("thumb");
  if (thumbFile instanceof File && thumbFile.size > 0 && thumbFile.size <= THUMB_MAX) {
    const thumbBytes = new Uint8Array(await thumbFile.arrayBuffer());
    const thumbType = detectType(thumbBytes);
    if (thumbType === "png" || thumbType === "jpg" || thumbType === "webp") {
      await env.BUCKET.put(thumbKey, thumbBytes, { httpMetadata: { contentType: TYPES[thumbType] } });
    }
  }

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
        bank: bankValue.value,
        bankName: bankValue.name,
        label,
        type,
        key,
        status: STATUS.pending,
        created: new Date().toISOString(),
        width: dim ? dim.width : 0,
        height: dim ? dim.height : 0,
        size: bytes.length,
        hash,
        reviewedAt: "",
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

function fileHeaders(type, mode, etag) {
  const headers = new Headers();
  headers.set("Content-Type", type || "application/octet-stream");
  // mode: "public" = 站点用的 /files（长缓存）；其它 = 审核台预览（短缓存，避免每次重画都重新下载）
  headers.set("Cache-Control", mode === "public" ? "public, max-age=86400, stale-while-revalidate=604800" : "private, max-age=300, stale-while-revalidate=600");
  if (etag) headers.set("ETag", etag);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  // sandbox 让文档以不透明源加载并禁用脚本：即使被直接打开也无法执行 SVG 内的脚本
  headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; sandbox");
  return headers;
}

/** 对象真实的内容类型：优先用上传时写进元数据的类型（缩略图与原图类型可能不同）。 */
function objectType(object, fallback) {
  const stored = object && object.httpMetadata && object.httpMetadata.contentType;
  return stored || TYPES[fallback] || "application/octet-stream";
}

/** 已经取到对象时直接构造响应（原图 / 缩略图共用）。 */
/** 缩略图可能存在的两个位置（命名规则 <dir>/<id>.thumb）。 */
function thumbKeys(id) {
  return [`pending/${id}.thumb`, `approved/${id}.thumb`];
}

/** 删掉一条记录对应的原图与缩略图（尽力而为，不存在就跳过）。 */
async function deleteItemFiles(env, item) {
  if (!item) return;
  const keys = [item.key].concat(item.id ? thumbKeys(item.id) : []).filter(Boolean);
  for (const key of keys) await env.BUCKET.delete(key);
}

function respondObject(request, object, type, mode) {
  const etag = object.etag ? `"${object.etag}"` : null;
  if (etag && request.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers: fileHeaders(type, mode, etag) });
  }
  return new Response(object.body, { headers: fileHeaders(type, mode, etag) });
}

async function objectResponse(request, env, item, mode) {
  const object = await env.BUCKET.get(item.key);
  if (!object) return new Response("not found", { status: 404 });
  return respondObject(request, object, objectType(object, item.type), mode);
}

async function publicFile(request, env, id) {
  const item = (await records(env)).find((entry) => entry.id === id && entry.status === STATUS.approved);
  if (!item) return new Response("not found", { status: 404 });
  return objectResponse(request, env, item, "public");
}

/**
 * R2 用量估算：列出本桶所有对象求和，并按前缀分类（pending/approved/backups…）。
 * 结果缓存 30 分钟（`?refresh=1` 强制重算）；免费额度按 R2 的 10 GB 月额度标注。
 * 注意：只能统计「对象存储量」，R2 的 A/B 类操作次数无法从这里读到。
 */
async function usage(request, env) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  const force = new URL(request.url).searchParams.get("refresh") === "1";
  if (!force) {
    const cached = await env.BUCKET.get(USAGE_KEY);
    if (cached) {
      const data = await cached.json().catch(() => null);
      if (data && Date.now() - Date.parse(data.at || 0) < 30 * 60 * 1000) {
        return json({ ...data, cached: true, freeLimitBytes: FREE_STORAGE });
      }
    }
  }
  let cursor;
  let objects = 0;
  let bytes = 0;
  const byPrefix = {};
  do {
    const page = await env.BUCKET.list({ cursor, limit: 1000 });
    const rows = (page && page.objects) || [];
    rows.forEach((object) => {
      const size = Number(object.size) || 0;
      objects += 1;
      bytes += size;
      const prefix = String(object.key || "").split("/")[0] || "(root)";
      if (!byPrefix[prefix]) byPrefix[prefix] = { objects: 0, bytes: 0 };
      byPrefix[prefix].objects += 1;
      byPrefix[prefix].bytes += size;
    });
    cursor = page && page.truncated ? page.cursor : undefined;
  } while (cursor);
  const data = { at: new Date().toISOString(), objects, bytes, byPrefix };
  await env.BUCKET.put(USAGE_KEY, JSON.stringify(data), { httpMetadata: { contentType: "application/json" } });
  return json({ ...data, cached: false, freeLimitBytes: FREE_STORAGE });
}

async function reviewFile(request, env, id) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  const url = new URL(request.url);
  const type = String(url.searchParams.get("t") || "").toLowerCase();
  const thumb = url.searchParams.get("thumb") === "1";
  // 快路径：客户端把列表里本来就有的类型带上，就能直接拼出 key
  // —— 不用读 records.json（原来每张预览都要把整份记录拉下来解析，几十张图就卡爆了）
  if (TYPES[type]) {
    const suffix = thumb ? ".thumb" : "." + type;
    const dirs = url.searchParams.get("d") === "pending" ? ["pending", "approved"] : ["approved", "pending"];
    for (const dir of dirs) {
      const object = await env.BUCKET.get(dir + "/" + id + suffix);
      if (object) return respondObject(request, object, objectType(object, type), "private");
    }
    if (thumb) return new Response("no thumbnail", { status: 404 });
  }
  // 兜底（老数据 / 没带类型）：按记录里存的 key 找
  const item = (await records(env)).find((entry) => entry.id === id && entry.status !== STATUS.rejected);
  if (!item) return new Response("not found", { status: 404 });
  return objectResponse(request, env, item, "private");
}

function logoWidth(item) {
  const w = Number(item.width) || 0;
  const h = Number(item.height) || 0;
  if (!w || !h) return 132;
  // 前端按「初始宽度」摆放 logo：按高宽比换算成高约 40px 的宽度，限制在 60–200 之间
  return Math.round(Math.min(200, Math.max(60, (40 * w) / h)));
}

function publicItem(item, origin, categories) {
  return {
    id: item.id,
    kind: kindOfItem(item, categories),
    name: item.name,
    category: item.category,
    bank: item.bank || "",
    bankName: bankLabel(item),
    label: item.label || "",
    url: `${origin}/files/${item.id}`,
    width: logoWidth(item),
  };
}

/* ------------------------------------------------------------ 审核接口 */

/* ------------------------------------------------------- 审核端小工具 */

function matchesQuery(item, q) {
  if (!q) return true;
  // 银行按「存的值」和「给人看的名称」都能搜到（内置银行存的是 id）
  const fields = [item.name, item.label, item.bank, item.bankName, item.id, bankLabel(item)];
  return fields.some((value) => String(value || "").toLowerCase().includes(q));
}

/** 银行名称建议：内置 154 家的中文名 + 记录里已经出现的自定义银行（后台与提交表单共用）。 */
function bankNameOptions(items) {
  const custom = [...new Set((items || []).map((item) => bankLabel(item)))]
    .filter((name) => name && !BANK_NAME_TO_ID.has(name));
  return [...BANK_NAMES.values(), ...custom];
}

function paging(url, defLimit = 60) {
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || defLimit));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 40);
  return { limit, offset, q };
}

/**
 * 条目的真实类型（face / logo）：分类 id 能对上时以分类为准。
 * 历史数据里有条目没写 kind、或早期默认写成了 face，若直接按 item.kind 过滤，
 * 这些条目会在后台彻底消失（分类点进去是空的、搜索也搜不到）——所以读取一律走这里推断。
 */
function kindOfItem(item, categories) {
  const hit = (categories || []).find((entry) => entry.id === item.category);
  if (hit) return hit.kind === "logo" ? "logo" : "face";
  return item.kind === "logo" ? "logo" : "face";
}

/** 内容指纹 → 条数（不含已拒绝、不含没有指纹的老数据），用于「同图」提示与合并。 */
function hashCounts(items) {
  const counts = new Map();
  (items || []).forEach((item) => {
    if (!item.hash || item.status === STATUS.rejected) return;
    counts.set(item.hash, (counts.get(item.hash) || 0) + 1);
  });
  return counts;
}

/** 审核页统一使用的条目视图（带运营需要的提交时间/大小/尺寸/指纹等元数据）。 */
function adminItem(item, categories, counts) {
  return {
    id: item.id,
    kind: kindOfItem(item, categories),
    name: item.name,
    category: item.category,
    bank: item.bank || "",
    bankName: bankLabel(item),
    bankBuiltin: BANK_ID_SET.has(item.bank),
    label: item.label || "",
    type: item.type,
    status: item.status,
    created: item.created || "",
    reviewedAt: item.reviewedAt || "",
    width: Number(item.width) || 0,
    height: Number(item.height) || 0,
    size: Number(item.size) || 0,
    hash: item.hash || "",
    sameHash: counts ? Math.max(0, (counts.get(item.hash) || 1) - 1) : 0,
    url: `/review/file/${item.id}?t=${item.type || ""}&d=${item.status === STATUS.pending ? "pending" : "approved"}`,
    thumbUrl: `/review/file/${item.id}?t=${item.type || ""}&d=${item.status === STATUS.pending ? "pending" : "approved"}&thumb=1`,
  };
}

async function reviewItems(request, env) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  await housekeeping(env, new URL(request.url).origin).catch(() => {});
  const url = new URL(request.url);
  const { limit, offset, q } = paging(url);
  const data = await catalog(env);
  const all = await records(env);
  // 待处理按类型分开取（页面上卡面 / Logo 是两个独立区域）
  const rawKind = url.searchParams.get("kind");
  const kindWanted = rawKind === "logo" ? "logo" : rawKind === "face" ? "face" : "";
  const pending = all
    .filter((item) => item.status === STATUS.pending && matchesQuery(item, q) && (!kindWanted || kindOfItem(item, data.categories) === kindWanted))
    .reverse();
  const pendingByKind = { face: 0, logo: 0 };
  all.filter((item) => item.status === STATUS.pending).forEach((item) => {
    pendingByKind[kindOfItem(item, data.categories)] += 1;
  });
  const hashTally = hashCounts(all);
  return json({
    items: pending.slice(offset, offset + limit).map((item) => adminItem(item, data.categories, hashTally)),
    total: pending.length,
    pendingByKind,
    limit,
    offset,
    bankNames: bankNameOptions(all),
  });
}

async function catalogGet(request, env) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  await housekeeping(env, new URL(request.url).origin).catch(() => {});
  const url = new URL(request.url);
  const data = await catalog(env);
  const { limit, offset, q } = paging(url, 80);
  const kind = url.searchParams.get("kind") === "logo" ? "logo" : "face";
  const category = String(url.searchParams.get("category") || "");
  const all = await records(env);
  const approved = all.filter((item) => item.status === STATUS.approved);
  const searching = q !== "";
  const kindOf = (item) => kindOfItem(item, data.categories);
  const knownCategory = (item) => data.categories.some((entry) => entry.id === item.category && entry.kind === kindOf(item));
  const orphans = approved.filter((item) => !knownCategory(item));
  // 计数按「类型:分类」给键，避免卡面/Logo 分类 id 撞车时数字串台
  const counts = {};
  approved.forEach((item) => { const key = kindOf(item) + ':' + item.category; counts[key] = (counts[key] || 0) + 1; });
  const approvedByKind = { face: 0, logo: 0 };
  approved.forEach((item) => { approvedByKind[kindOf(item)] += 1; });
  const hiddenByKind = { face: 0, logo: 0 };
  all.filter((item) => item.status === STATUS.hidden).forEach((item) => { hiddenByKind[kindOf(item)] += 1; });
  // 搜索时跨分类跨类型；__orphan__ 是「分类已被删除」的虚拟分组，
  // 保证任何条目都不会因为分类被删而在后台彻底看不见。
  let list;
  if (searching) list = approved.filter((item) => matchesQuery(item, q));
  else if (category === "__orphan__") list = orphans;
  else list = approved.filter((item) => kindOf(item) === kind && (!category || item.category === category));
  const hidden = all.filter((item) => item.status === STATUS.hidden && matchesQuery(item, q));
  const hashTally = hashCounts(all);
  return json({
    categories: data.categories,
    counts,
    approvedByKind,
    hiddenByKind,
    orphans: orphans.length,
    searching,
    items: list.slice(offset, offset + limit).map((item) => adminItem(item, data.categories, hashTally)),
    total: list.length,
    hidden: hidden.slice(0, 200).map((item) => adminItem(item, data.categories, hashTally)),
    hiddenTotal: hidden.length,
    bankNames: bankNameOptions(all),
    limit,
    offset,
  });
}

/**
 * 通过一条待审条目：写状态 + 把对象从 pending/ 迁到 approved/（幂等：源已不在时接受已迁移的目标）。
 * wanted = { category, bank, label, name }；返回 { error, status } 或 { ok: true }。
 */
async function approveOne(env, data, item, now, wanted) {
  const ownKind = kindOfItem(item, data.categories);
  const target = data.categories.find((entry) => entry.id === wanted.category && entry.kind === ownKind);
  if (!target) return { error: "category", status: 400 };
  const label = String(wanted.label === undefined ? item.label || "" : wanted.label).trim().slice(0, 24);
  // 只有 logo 在「银行」角色分类下才要求银行名称（与 /submit 的口径一致）
  const needsBank = ownKind === "logo" && target.role === "bank";
  let picked = needsBank ? resolveBank(wanted.bank === undefined ? item.bank || "" : wanted.bank) : { value: "", name: "" };
  // 同图批量通过时，某条自己没填银行就沿用「以哪条为准」那条的银行
  if (needsBank && !picked.value && wanted.fallbackBank) picked = resolveBank(wanted.fallbackBank);
  if (needsBank && !picked.value) return { error: "bank", status: 400 };
  if (!item.key) return { error: "file", status: 404 };
  item.kind = ownKind;
  item.category = target.id;
  item.bank = needsBank ? picked.value : "";
  item.bankName = needsBank ? picked.name : "";
  if (wanted.name) item.name = String(wanted.name).trim().slice(0, 40) || item.name;
  item.label = label;
  item.status = STATUS.approved;
  item.reviewedAt = now;
  delete item.hiddenAt;
  delete item.hiddenFrom;
  const next = `approved/${item.id}.${item.type}`;
  if (item.key !== next) {
    const object = await env.BUCKET.get(item.key);
    if (object) {
      await env.BUCKET.put(next, object.body, { httpMetadata: object.httpMetadata });
      await env.BUCKET.delete(item.key);
    } else if (!(await env.BUCKET.head(next))) {
      return { error: "file", status: 404 };
    }
    item.key = next;
  }
  // 缩略图跟着一起搬（老内容没有缩略图就跳过）
  const thumbFrom = `pending/${item.id}.thumb`;
  const thumbObject = await env.BUCKET.get(thumbFrom);
  if (thumbObject) {
    await env.BUCKET.put(`approved/${item.id}.thumb`, thumbObject.body, { httpMetadata: thumbObject.httpMetadata });
    await env.BUCKET.delete(thumbFrom);
  }
  return { ok: true };
}

async function reviewAction(request, env) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  const body = await request.json().catch(() => null);
  if (!body || !body.id) return json({ error: "fields" }, 400);
  const origin = new URL(request.url).origin;
  const data = await catalog(env);
  const now = new Date().toISOString();
  const outcome = await mutateRecords(env, async (items) => {
    const item = items.find((entry) => entry.id === body.id);
    if (!item) return { commit: false, result: { error: "missing", status: 404 } };
    // 只处理待审条目：已通过的要用「隐藏」或「删除」，否则会删掉线上文件且无法恢复；
    // 被拒绝的条目文件已删除，也不能再通过。
    if (item.status !== STATUS.pending) return { commit: false, result: { error: "state", status: 409 } };
    // 「同图」批量：approve-dupes / reject-dupes 会连带处理内容指纹相同的其它待审条目
    const batched = body.action === "approve-dupes" || body.action === "reject-dupes";
    const siblings = batched && item.hash
      ? items.filter((entry) => entry.id !== item.id && entry.status === STATUS.pending && entry.hash === item.hash)
      : [];
    if (body.action === "reject" || body.action === "reject-dupes") {
      const doomed = [item, ...siblings];
      const keys = [];
      doomed.forEach((entry) => {
        if (entry.key) keys.push(entry.key);
        keys.push(...thumbKeys(entry.id));
        entry.status = STATUS.rejected;
        entry.rejectedAt = now;
        entry.reviewedAt = now;
        entry.key = "";
      });
      return { commit: true, result: { ok: true, keys, count: doomed.length } };
    }
    if (body.action !== "approve" && body.action !== "approve-dupes") {
      return { commit: false, result: { error: "action", status: 400 } };
    }
    const first = await approveOne(env, data, item, now, { category: body.category, bank: body.bank, label: body.label, name: body.name });
    if (first.error) return { commit: false, result: first };
    const approved = [item.id];
    for (const sibling of siblings) {
      const done = await approveOne(env, data, sibling, now, {
        category: sibling.category,
        bank: sibling.bank,
        label: sibling.label,
        name: sibling.name,
        fallbackBank: body.bank || item.bank || "",
      });
      if (!done.error) approved.push(sibling.id);
    }
    return { commit: true, result: { ok: true, key: item.id, approved } };
  });
  if (outcome && outcome.error) return json({ error: outcome.error }, outcome.status);
  // 拒绝会立刻删掉文件；批量拒绝时逐个删
  if (outcome && Array.isArray(outcome.keys)) {
    for (const key of outcome.keys) await env.BUCKET.delete(key);
  }
  await rebuildManifest(env, origin).catch(() => {});
  return json({ ok: true, approved: outcome && outcome.approved ? outcome.approved.length : undefined, rejected: outcome && outcome.count });
}

async function catalogAction(request, env) {
  const guardResult = await guard(request, env);
  if (guardResult.error) return guardResult.error;
  const body = await request.json().catch(() => null);
  if (!body || !body.action) return json({ error: "fields" }, 400);
  const origin = new URL(request.url).origin;
  const now = new Date().toISOString();
  const snapshot = await catalog(env);

  // 只改记录的动作（改名 / 改分类 / 详细编辑 / 隐藏）：用记录自身的乐观锁即可
  if (body.action === "move-face" || body.action === "rename-item" || body.action === "update-item" || body.action === "hide-item" || body.action === "hide-face") {
    const outcome = await mutateRecords(env, (items) => {
      const item = items.find((entry) => entry.id === body.id);
      if (!item) return { commit: false, result: { error: "missing", status: 404 } };
      if (body.action === "hide-item" || body.action === "hide-face") {
        if (item.status !== STATUS.hidden) {
          item.status = STATUS.hidden;
          item.hiddenAt = now;
          item.hiddenFrom = item.category || "";
        }
        return { commit: true, result: { ok: true } };
      }
      if (body.action === "rename-item") {
        const name = String(body.name || "").trim().slice(0, 40);
        if (!name) return { commit: false, result: { error: "name", status: 400 } };
        item.name = name;
        item.updatedAt = now;
        return { commit: true, result: { ok: true } };
      }
      const ownKind = kindOfItem(item, snapshot.categories);
      const wanted = String(body.category || item.category || "");
      const target = snapshot.categories.find((entry) => entry.id === wanted && entry.kind === ownKind);
      if (!target) return { commit: false, result: { error: "category", status: 400 } };
      if (body.action === "update-item") {
        const name = String(body.name === undefined ? item.name : body.name).trim().slice(0, 40);
        if (!name) return { commit: false, result: { error: "name", status: 400 } };
        const label = String(body.label === undefined ? item.label || "" : body.label).trim().slice(0, 24);
        const needsBank = ownKind === "logo" && target.role === "bank";
        const picked = needsBank ? resolveBank(body.bank === undefined ? item.bank || "" : body.bank) : { value: "", name: "" };
        if (needsBank && !picked.value) {
          return { commit: false, result: { error: "bank", status: 400 } };
        }
        item.name = name;
        item.label = label;
        item.bank = needsBank ? picked.value : "";
        item.bankName = needsBank ? picked.name : "";
      } else if (ownKind === "logo" && target.role !== "bank") {
        item.bank = "";
        item.bankName = "";
      }
      item.kind = ownKind;
      item.category = target.id;
      item.updatedAt = now;
      return { commit: true, result: { ok: true } };
    });
    if (outcome && outcome.error) return json({ error: outcome.error }, outcome.status);
    await rebuildManifest(env, origin).catch(() => {});
    return json({ ok: true });
  }

  // 永久删除：文件与记录一起删掉（页面会二次确认）
  if (body.action === "delete-item") {
    if (body.confirm !== true) return json({ error: "confirm" }, 400);
    let doomed = null;
    const outcome = await mutateRecords(env, (items) => {
      const index = items.findIndex((entry) => entry.id === body.id);
      if (index < 0) return { commit: false, result: { error: "missing", status: 404 } };
      doomed = items[index];
      items.splice(index, 1);
      return { commit: true, result: { ok: true } };
    });
    if (outcome && outcome.error) return json({ error: outcome.error }, outcome.status);
    if (doomed) await deleteItemFiles(env, doomed);
    console.log("intake: 删除条目", body.id);
    await rebuildManifest(env, origin).catch(() => {});
    return json({ ok: true });
  }

  // 合并同图：保留这一条，把内容指纹相同的其它条目（连文件）全部删掉（页面会二次确认）
  if (body.action === "merge-dupes") {
    if (body.confirm !== true) return json({ error: "confirm" }, 400);
    const snapshot = await records(env);
    const ref = snapshot.find((entry) => entry.id === body.id);
    if (!ref) return json({ error: "missing" }, 404);
    const doomed = snapshot.filter((entry) => entry.id !== ref.id && ref.hash && entry.hash === ref.hash && entry.status !== STATUS.rejected);
    if (!doomed.length) return json({ ok: true, merged: 0 });
    const ids = new Set(doomed.map((entry) => entry.id));
    let keys = [];
    const outcome = await mutateRecords(env, (items) => {
      keys = items.filter((entry) => ids.has(entry.id)).flatMap((entry) => [entry.key].concat(thumbKeys(entry.id))).filter(Boolean);
      const kept = items.filter((entry) => !ids.has(entry.id));
      items.length = 0;
      items.push(...kept);
      return { commit: true, result: { ok: true } };
    });
    if (outcome && outcome.error) return json({ error: outcome.error }, outcome.status);
    for (const key of keys) await env.BUCKET.delete(key);
    console.log("intake: 合并同图", ref.id, "删掉", doomed.length, "条");
    await rebuildManifest(env, origin).catch(() => {});
    return json({ ok: true, merged: doomed.length });
  }

  // 其余动作会改动 catalog.json，全部走乐观锁；mutator 内的记录改动是幂等的
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
        const affected = all.filter((item) => kindOfItem(item, data.categories) === target.kind && item.category === target.id);
        return { commit: false, result: { ok: false, needConfirm: true, affected: { items: affected.length, hidden: true } } };
      }
      const siblings = data.categories.filter((entry) => entry.kind === target.kind && entry.id !== target.id);
      const movedCount = (await mutateRecords(env, (items) => {
        let touched = 0;
        items.forEach((item) => {
          if (kindOfItem(item, data.categories) !== target.kind || item.category !== target.id) return;
          item.category = siblings.length ? siblings[0].id : "";
          // 条目被挪到非「银行」角色的分类后，清掉过期的银行值（站点按分类角色决定是否算银行图标）
          if (!siblings.length || siblings[0].role !== "bank") { item.bank = ""; item.bankName = ""; }
          item.status = STATUS.hidden;
          item.hiddenAt = now;
          item.hiddenFrom = target.id;
          touched += 1;
        });
        return { commit: touched > 0, result: touched };
      })) || 0;
      data.categories = data.categories.filter((entry) => entry.id !== target.id);
      return { commit: true, result: { ok: true, hidden: movedCount } };
    }
    if (body.action === "restore-item") {
      const restored = await mutateRecords(env, (items) => {
        const item = items.find((entry) => entry.id === body.id);
        if (!item) return { commit: false, result: { error: "missing", status: 404 } };
        if (item.status !== STATUS.hidden) return { commit: false, result: { error: "state", status: 409 } };
        const ownKind = kindOfItem(item, data.categories);
        const exists = item.category && data.categories.some((entry) => entry.id === item.category && entry.kind === ownKind);
        if (!exists) {
          const fallback = data.categories.find((entry) => entry.kind === ownKind);
          if (!fallback) return { commit: false, result: { error: "category", status: 400 } };
          item.category = fallback.id;
        }
        // 恢复后落在非「银行」角色的分类里，也要清掉过期的银行值
        const parked = data.categories.find((entry) => entry.id === item.category);
        if (!parked || parked.role !== "bank") { item.bank = ""; item.bankName = ""; }
        item.kind = ownKind;
        item.status = STATUS.approved;
        delete item.hiddenAt;
        delete item.hiddenFrom;
        return { commit: true, result: { ok: true } };
      });
      if (restored && restored.error) return { commit: false, result: restored };
      return { commit: false, result: { ok: true } };
    }
    // 批量修正历史条目的类型：按分类推断写回。读取时已经能看见它们，
    // 这一步是让数据本身变正确（站点清单里的 kind 也跟着对）。
    if (body.action === "fix-kinds") {
      const fixed = await mutateRecords(env, (items) => {
        let touched = 0;
        items.forEach((item) => {
          const ownKind = kindOfItem(item, data.categories);
          if (item.kind !== ownKind) { item.kind = ownKind; touched += 1; }
        });
        return { commit: touched > 0, result: touched };
      });
      if (typeof fixed !== "number") return { commit: false, result: { error: "locked", status: 409 } };
      return { commit: false, result: { ok: true, fixed } };
    }
    // 找回被删掉的内置分类：只补缺失的 id，已存在（含改过名/角色）的一律不动
    if (body.action === "restore-defaults") {
      const have = new Set(data.categories.map((entry) => entry.id));
      const missing = catalogDefault().categories.filter((entry) => !have.has(entry.id));
      if (!missing.length) return { commit: false, result: { ok: true, restored: 0 } };
      missing.forEach((entry) => data.categories.push({ ...entry }));
      return { commit: true, result: { ok: true, restored: missing.length } };
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
    return fail("action", 400);
  });
  if (outcome && outcome.error) return json({ error: outcome.error }, outcome.status || 400);
  await rebuildManifest(env, origin).catch(() => {});
  return json(outcome || { ok: true });
}

/**
 * 过期清理：拒绝的条目 30 天后移除记录；隐藏的内容 30 天后连同文件一起删除。
 * 年龄按「进入该状态的时间」计算，否则刚隐藏的老条目会被立刻清掉。
 * 待删除清单只取自提交成功的那一次 mutator 结果，避免重试时累积。
 */
/**
 * 例行维护：过期清理（拒绝 30 天、隐藏 30 天连同文件一起删）、孤儿对象清扫、每日备份。
 * 待删除清单只取当次 mutator 结果，避免重试累积；年龄按「进入该状态的时间」算。
 */
async function housekeeping(env, origin) {
  // 限流：同一个 env 默认每 5 分钟清扫一次（可用 HOUSEKEEP_INTERVAL_MS 覆盖，测试里设 0）
  const interval = Number(env.HOUSEKEEP_INTERVAL_MS ?? 5 * 60 * 1000);
  if (Date.now() - (housekeepAt.get(env) || 0) < interval) return;
  housekeepAt.set(env, Date.now());
  const now = Date.now();
  const outcome = await mutateRecords(env, (items) => {
    const keep = [];
    const doomed = [];
    let changed = false;
    items.forEach((item) => {
      const since = Date.parse(item.hiddenAt || item.rejectedAt || item.created || 0);
      const age = Number.isFinite(since) ? now - since : 0;
      if (item.status === STATUS.rejected && age > RECORD_TTL_DAYS * DAY) { changed = true; return; }
      if (item.status === STATUS.hidden && age > HIDDEN_TTL_DAYS * DAY) { doomed.push(item); changed = true; return; }
      keep.push(item);
    });
    if (!changed) return { commit: false, result: { doomed: [], changed: false } };
    items.length = 0;
    items.push(...keep);
    return { commit: true, result: { doomed, changed: true } };
  });
  const { doomed, changed } = outcome || { doomed: [], changed: false };
  if (doomed.length) {
    const doomedKeys = doomed.flatMap((item) => [item.key].concat(item.id ? thumbKeys(item.id) : [])).filter(Boolean);
    await Promise.all(doomedKeys.map((key) => env.BUCKET.delete(key)));
  }
  if (changed && origin) await rebuildManifest(env, origin).catch(() => {});
  await sweepOrphans(env);
  await backupRecords(env);
}

/** 清理「有文件、没记录」的孤儿对象（提交写到一半失败会留下），只删超过 1 天的。 */
async function sweepOrphans(env) {
  try {
    const list = await env.BUCKET.list({ prefix: "pending/", limit: 500 });
    const objects = list && Array.isArray(list.objects) ? list.objects : [];
    if (!objects.length) return;
    const items = await records(env);
    const known = new Set(items.map((item) => item.key).filter(Boolean));
    items.forEach((item) => { if (item.id) thumbKeys(item.id).forEach((key) => known.add(key)); });
    const cutoff = Date.now() - DAY;
    const stale = objects.filter((object) => !known.has(object.key) && new Date(object.uploaded || 0).getTime() < cutoff);
    if (!stale.length) return;
    await Promise.all(stale.map((object) => env.BUCKET.delete(object.key)));
    console.warn("intake: 已清理孤儿对象", stale.length);
  } catch (error) {
    console.warn("intake: 孤儿清理跳过", String((error && error.message) || error));
  }
}

/** 每天留一份 records.json 备份（当天已备份则跳过）。 */
async function backupRecords(env) {
  try {
    const key = `${BACKUP_PREFIX}${new Date().toISOString().slice(0, 10)}.json`;
    if (await env.BUCKET.head(key)) return;
    const object = await env.BUCKET.get(RECORDS_KEY);
    if (!object) return;
    await env.BUCKET.put(key, object.body, { httpMetadata: { contentType: "application/json" } });
  } catch (error) {
    console.warn("intake: 备份跳过", String((error && error.message) || error));
  }
}

/* ------------------------------------------------------------ 审核页面 */

async function reviewPage() {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const html = PAGE_TEMPLATE.replace("__NONCE__", nonce);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // 审核台不要被搜索引擎收录（页面壳是公开的，数据才需要口令）
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' blob: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    },
  });
}


export { detectType, imageSize, isSafeSvg, tooLarge, normalizeCatalog, publicCategories, sha256hex, timingSafeEqual, DEFAULT_CATALOG };
