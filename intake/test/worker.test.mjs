/**
 * 审核 Worker 的单元测试（node --test，无外部依赖）。
 * 内存 R2 桩实现 get/put/head/delete + onlyIf 条件写语义，用于验证乐观锁。
 */
import test from "node:test";
import assert from "node:assert/strict";
import worker, { detectType, imageSize, isSafeSvg, tooLarge, normalizeCatalog } from "../src/index.js";

class FakeBucket {
  constructor({ conditional = true, latency = 0 } = {}) {
    this.objects = new Map();
    this.conditional = conditional;
    this.latency = latency;
    this.seq = 0;
  }

  async #settle() {
    if (this.latency) await new Promise((resolve) => setTimeout(resolve, this.latency));
  }

  async put(key, value, options = {}) {
    await this.#settle();
    if (options.onlyIf !== undefined && !this.conditional) throw new Error("onlyIf is not supported here");
    const current = this.objects.get(key);
    if (options.onlyIf) {
      const { etagMatches, etagDoesNotMatch } = options.onlyIf;
      if (etagMatches !== undefined && (!current || current.etag !== etagMatches)) return null;
      if (etagDoesNotMatch === "*" && current) return null;
    }
    const bytes = typeof value === "string"
      ? new TextEncoder().encode(value)
      : value instanceof Uint8Array
        ? value.slice()
        : new Uint8Array(await new Response(value).arrayBuffer());
    this.seq += 1;
    const stored = { key, bytes, etag: `etag-${this.seq}`, httpMetadata: options.httpMetadata || {} };
    this.objects.set(key, stored);
    return { ...stored };
  }

  async get(key) {
    await this.#settle();
    const object = this.objects.get(key);
    if (!object) return null;
    return body(object);
  }

  async head(key) {
    await this.#settle();
    const object = this.objects.get(key);
    return object ? { ...object } : null;
  }

  async delete(key) {
    await this.#settle();
    this.objects.delete(key);
  }

  keys() {
    return [...this.objects.keys()];
  }
}

function body(object) {
  return {
    key: object.key,
    etag: object.etag,
    httpMetadata: object.httpMetadata,
    body: object.bytes,
    text: async () => new TextDecoder().decode(object.bytes),
    json: async () => JSON.parse(new TextDecoder().decode(object.bytes)),
    arrayBuffer: async () => object.bytes.slice().buffer,
  };
}

const PASSWORD = "correct-horse-battery";

function makeEnv(overrides = {}) {
  return { BUCKET: new FakeBucket(), REVIEW_PASSWORD: PASSWORD, ...overrides };
}

function req(path, { method = "GET", token, ip = "10.0.0.1", payload, form } = {}) {
  const headers = { "CF-Connecting-IP": ip };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (form) {
    body = form;
  } else if (payload !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(payload);
  }
  return new Request(`https://review.test${path}`, { method, headers, body });
}

async function call(env, path, options) {
  return worker.fetch(req(path, options), env);
}

function pngBytes(width, height) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpegBytes(width, height) {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

function webpBytes(width, height) {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);
  const w = width - 1;
  const h = height - 1;
  bytes[24] = w & 0xff;
  bytes[25] = (w >> 8) & 0xff;
  bytes[26] = (w >> 16) & 0xff;
  bytes[27] = h & 0xff;
  bytes[28] = (h >> 8) & 0xff;
  bytes[29] = (h >> 16) & 0xff;
  return bytes;
}

function fileOf(bytes, name, type) {
  return new File([bytes], name, { type });
}

function submitForm({ name = "测试卡面", kind = "face", category = "solid", bank = "", label = "", ip, file }) {
  const form = new FormData();
  form.set("name", name);
  form.set("kind", kind);
  form.set("category", category);
  form.set("bank", bank);
  form.set("label", label);
  if (file) form.set("file", file);
  return { form, ip };
}

/* ------------------------------------------------------------ 内容判定 */

test("detectType 按内容判定类型，忽略文件名与声明 MIME", () => {
  assert.equal(detectType(pngBytes(10, 10)), "png");
  assert.equal(detectType(jpegBytes(10, 10)), "jpg");
  assert.equal(detectType(webpBytes(10, 10)), "webp");
  assert.equal(detectType(new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')), "svg");
  assert.equal(detectType(new TextEncoder().encode("<html><body>hi</body></html>")), "");
  assert.equal(detectType(new TextEncoder().encode("%PDF-1.7 <svg></svg>")), "");
});

test("isSafeSvg 拒绝危险构造，接受普通 SVG", () => {
  const safe = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10H0z" fill="#123"/></svg>';
  assert.equal(isSafeSvg(safe), true);
  assert.equal(isSafeSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), false);
  assert.equal(isSafeSvg('<svg onload="alert(1)"></svg>'), false);
  assert.equal(isSafeSvg('<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>'), false);
  assert.equal(isSafeSvg('<svg><foreignObject><body onload="x()"></body></foreignObject></svg>'), false);
  assert.equal(isSafeSvg('<svg><image href="https://evil.example/x.png"/></svg>'), false);
  assert.equal(isSafeSvg('<svg><style>@import url(https://evil.example/a.css);</style></svg>'), false);
});

test("imageSize 解析位图宽高并拦截像素炸弹", () => {
  assert.deepEqual(imageSize("png", pngBytes(1200, 800)), { width: 1200, height: 800 });
  assert.deepEqual(imageSize("jpg", jpegBytes(640, 480)), { width: 640, height: 480 });
  assert.deepEqual(imageSize("webp", webpBytes(300, 200)), { width: 300, height: 200 });
  assert.equal(tooLarge(imageSize("png", pngBytes(20000, 20000))), true);
  assert.equal(tooLarge(imageSize("png", pngBytes(1536, 969))), false);
});

test("normalizeCatalog 就地归一化并继承旧数据角色", () => {
  const data = { categories: [{ id: "banks", name: "银行", kind: "logo" }, { id: "other", name: "其他" }] };
  const normalized = normalizeCatalog(data);
  assert.equal(normalized, data, "应返回同一对象，保证 mutateCatalog 的改动能被序列化");
  assert.equal(data.categories[0].role, "bank");
  assert.equal(data.categories[1].role, "other");
  assert.equal(data.categories[1].kind, "face");
  assert.deepEqual(data.hidden, []);
});

/* ------------------------------------------------------------ 口令与鉴权 */

test("未配置 REVIEW_PASSWORD 时审核接口关闭，且无法通过页面自设口令接管", async () => {
  const env = makeEnv({ REVIEW_PASSWORD: "" });
  const state = await call(env, "/review/password");
  assert.deepEqual(await state.json(), { ready: false, source: "none", legacy: false });
  for (const path of ["/review/items", "/review/catalog"]) {
    assert.equal((await call(env, path, { token: "anything" })).status, 503);
  }
  const set = await call(env, "/review/password", { method: "POST", payload: { password: "attacker-password" } });
  assert.equal(set.status, 503);
  assert.equal(env.BUCKET.keys().includes("review-password.txt"), false);
});

test("口径：错误口令 401，正确口令 200，且只统计失败不限流正常管理员", async () => {
  const env = makeEnv();
  assert.equal((await call(env, "/review/items", { token: "wrong", ip: "10.0.0.2" })).status, 401);
  for (let i = 0; i < 25; i += 1) {
    assert.equal((await call(env, "/review/items", { token: PASSWORD, ip: "10.0.0.2" })).status, 200, `第 ${i + 1} 次正常请求不应被限流`);
  }
});

test("连续失败会限流并返回 429", async () => {
  const env = makeEnv();
  let last = 0;
  for (let i = 0; i < 12; i += 1) {
    last = (await call(env, "/review/items", { token: "nope", ip: "10.0.0.9" })).status;
  }
  assert.equal(last, 429);
});

test("旧版明文口令文件被忽略，env 口令仍生效", async () => {
  const env = makeEnv();
  await env.BUCKET.put("review-password.txt", "attacker-planted");
  assert.equal((await call(env, "/review/items", { token: "attacker-planted", ip: "10.0.0.3" })).status, 401);
  assert.equal((await call(env, "/review/items", { token: PASSWORD, ip: "10.0.0.3" })).status, 200);
  const state = await (await call(env, "/review/password")).json();
  assert.equal(state.legacy, true);
});

test("轮换口令需要当前口令，且只写入哈希", async () => {
  const env = makeEnv();
  const denied = await call(env, "/review/password", { method: "POST", ip: "10.0.0.4", payload: { password: "brand-new-password" } });
  assert.equal(denied.status, 401);
  const short = await call(env, "/review/password", { method: "POST", ip: "10.0.0.4", token: PASSWORD, payload: { password: "short" } });
  assert.equal(short.status, 400);
  const ok = await call(env, "/review/password", { method: "POST", ip: "10.0.0.4", token: PASSWORD, payload: { password: "brand-new-password" } });
  assert.equal(ok.status, 200);
  const stored = await env.BUCKET.get("review-password.txt");
  const raw = await stored.text();
  assert.match(raw, /^sha256:[0-9a-f]{64}$/);
  assert.equal(raw.includes("brand-new-password"), false);
  assert.equal((await call(env, "/review/items", { token: PASSWORD, ip: "10.0.0.4" })).status, 401);
  assert.equal((await call(env, "/review/items", { token: "brand-new-password", ip: "10.0.0.4" })).status, 200);
});

/* ------------------------------------------------------------ 提交与审核 */

test("提交合法 PNG 会入库为 pending 并可被审核通过", async () => {
  const env = makeEnv();
  const form = submitForm({ ip: "10.1.0.1", file: fileOf(pngBytes(1536, 969), "card.png", "image/png") });
  const response = await call(env, "/submit", { method: "POST", form: form.form, ip: form.ip });
  assert.equal(response.status, 200);
  const list = await (await call(env, "/review/items", { token: PASSWORD, ip: "10.1.0.1" })).json();
  assert.equal(list.items.length, 1);
  const item = list.items[0];
  assert.equal(item.type, "png");
  assert.equal(item.status, "pending");

  const approved = await call(env, "/review/items", { method: "POST", token: PASSWORD, ip: "10.1.0.1", payload: { action: "approve", id: item.id, category: "solid", name: "新卡面" } });
  assert.equal(approved.status, 200);
  assert.equal((await env.BUCKET.head(`approved/${item.id}.png`)) !== null, true);
  assert.equal((await env.BUCKET.head(`pending/${item.id}.png`)), null);

  const manifest = await (await call(env, "/manifest")).json();
  assert.equal(manifest.items.length, 1);
  const file = await call(env, `/files/${item.id}`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(file.headers.get("Content-Security-Policy"), /sandbox/);
  assert.equal(file.headers.get("Cache-Control"), "public, max-age=86400");
});

test("伪装成 PNG 的 HTML、含脚本的 SVG、超大像素图都被拒绝", async () => {
  const env = makeEnv();
  const html = fileOf(new TextEncoder().encode("<html><script>alert(1)</script></html>"), "card.png", "image/png");
  const asHtml = await call(env, "/submit", { method: "POST", ip: "10.1.0.2", form: submitForm({ ip: "10.1.0.2", file: html }).form });
  assert.equal(asHtml.status, 400);
  assert.equal((await asHtml.json()).error, "file");

  const svg = fileOf(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "logo.svg", "image/svg+xml");
  const asSvg = await call(env, "/submit", { method: "POST", ip: "10.1.0.3", form: submitForm({ ip: "10.1.0.3", file: svg }).form });
  assert.equal(asSvg.status, 400);
  assert.equal((await asSvg.json()).error, "svg");

  const bomb = fileOf(pngBytes(60000, 60000), "bomb.png", "image/png");
  const asBomb = await call(env, "/submit", { method: "POST", ip: "10.1.0.4", form: submitForm({ ip: "10.1.0.4", file: bomb }).form });
  assert.equal(asBomb.status, 400);
  assert.equal((await asBomb.json()).error, "size");

  const records = await env.BUCKET.get("records.json");
  assert.equal(records, null, "被拒绝的提交不应写入记录");
});

test("logo 提交在 bank 角色分类下必须带银行编号", async () => {
  const env = makeEnv();
  const file = fileOf(pngBytes(200, 200), "logo.png", "image/png");
  const missing = submitForm({ kind: "logo", category: "banks", ip: "10.1.0.5", file });
  assert.equal((await call(env, "/submit", { method: "POST", ip: "10.1.0.5", form: missing.form })).status, 400);
  const bad = submitForm({ kind: "logo", category: "banks", bank: "../etc", ip: "10.1.0.5", file });
  assert.equal((await (await call(env, "/submit", { method: "POST", ip: "10.1.0.5", form: bad.form })).json()).error, "bank");
  const good = submitForm({ kind: "logo", category: "banks", bank: "ICBC", ip: "10.1.0.5", file });
  assert.equal((await call(env, "/submit", { method: "POST", ip: "10.1.0.5", form: good.form })).status, 200);
});

test("提交频率超限返回 429", async () => {
  const env = makeEnv();
  let status = 0;
  for (let i = 0; i < 21; i += 1) {
    const form = submitForm({ ip: "10.1.9.9", file: fileOf(pngBytes(10, 10), "a.png", "image/png") });
    status = (await call(env, "/submit", { method: "POST", ip: "10.1.9.9", form: form.form })).status;
  }
  assert.equal(status, 429);
});

test("拒绝会删除服务器上的文件", async () => {
  const env = makeEnv();
  const form = submitForm({ ip: "10.2.0.1", file: fileOf(pngBytes(100, 100), "x.png", "image/png") });
  await call(env, "/submit", { method: "POST", ip: "10.2.0.1", form: form.form });
  const item = (await (await call(env, "/review/items", { token: PASSWORD, ip: "10.2.0.1" })).json()).items[0];
  assert.equal(env.BUCKET.keys().includes(`pending/${item.id}.png`), true);
  await call(env, "/review/items", { method: "POST", token: PASSWORD, ip: "10.2.0.1", payload: { action: "reject", id: item.id } });
  assert.equal(env.BUCKET.keys().some((key) => key.includes(item.id)), false);
});

test("并发提交不会丢记录（乐观锁生效）", async () => {
  const env = makeEnv({ BUCKET: new FakeBucket({ latency: 3 }) });
  const jobs = [];
  for (let i = 0; i < 5; i += 1) {
    const ip = `10.3.0.${i + 1}`;
    const form = submitForm({ name: `并发 ${i}`, ip, file: fileOf(pngBytes(50 + i, 50), `c${i}.png`, "image/png") });
    jobs.push(call(env, "/submit", { method: "POST", ip, form: form.form }));
  }
  const responses = await Promise.all(jobs);
  assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 200, 200]);
  const list = await (await call(env, "/review/items", { token: PASSWORD, ip: "10.3.9.9" })).json();
  assert.equal(list.items.length, 5, "5 个并发提交都应保留");
});

test("条件写不可用时降级为普通写入，且不会污染共享实例的乐观锁", async () => {
  // 用带查询串的独立模块实例，避免把共享实例的 conditionalWrites 永久置为 false
  const { default: freshWorker } = await import("../src/index.js?degrade-check");
  const submitWith = (instance, bucketEnv, ip, name) => instance.fetch(
    req("/submit", { method: "POST", ip, form: submitForm({ name, ip, file: fileOf(pngBytes(60, 60), `${name}.png`, "image/png") }).form }),
    bucketEnv,
  );
  const degraded = makeEnv({ BUCKET: new FakeBucket({ conditional: false }) });
  assert.equal((await submitWith(freshWorker, degraded, "10.3.5.1", "degraded")).status, 200);
  const degradedList = await (await freshWorker.fetch(req("/review/items", { token: PASSWORD, ip: "10.3.5.1" }), degraded)).json();
  assert.equal(degradedList.items.length, 1);
  // 共享实例仍应带乐观锁：并发提交不丢记录
  const locked = makeEnv({ BUCKET: new FakeBucket({ latency: 3 }) });
  const statuses = await Promise.all(
    ["a", "b", "c"].map((name, index) => submitWith(worker, locked, `10.3.7.${index + 1}`, name).then((response) => response.status)),
  );
  assert.deepEqual(statuses, [200, 200, 200]);
  const lockedList = await (await worker.fetch(req("/review/items", { token: PASSWORD, ip: "10.3.7.9" }), locked)).json();
  assert.equal(lockedList.items.length, 3, "共享实例的乐观锁必须仍然生效");
});

test("删除分类改为软删除：可恢复，且在隐藏期间不可公开访问", async () => {
  const env = makeEnv();
  const form = submitForm({ ip: "10.4.0.1", file: fileOf(pngBytes(300, 200), "e.png", "image/png") });
  await call(env, "/submit", { method: "POST", ip: "10.4.0.1", form: form.form });
  const item = (await (await call(env, "/review/items", { token: PASSWORD, ip: "10.4.0.1" })).json()).items[0];
  await call(env, "/review/items", { method: "POST", token: PASSWORD, ip: "10.4.0.1", payload: { action: "approve", id: item.id, category: "solid" } });
  assert.equal((await call(env, `/files/${item.id}`)).status, 200);

  const probe = await call(env, "/review/catalog", { method: "POST", token: PASSWORD, ip: "10.4.0.1", payload: { action: "remove-category", id: "solid" } });
  const info = await probe.json();
  assert.equal(info.needConfirm, true);
  assert.equal(info.affected.items, 1);
  assert.equal((await call(env, `/files/${item.id}`)).status, 200, "未确认前不应改变任何内容");

  const done = await call(env, "/review/catalog", { method: "POST", token: PASSWORD, ip: "10.4.0.1", payload: { action: "remove-category", id: "solid", confirm: true } });
  assert.equal(done.status, 200);
  assert.equal((await env.BUCKET.head(`approved/${item.id}.png`)) !== null, true, "文件保留");
  assert.equal((await call(env, `/files/${item.id}`)).status, 404);
  assert.equal((await (await call(env, "/manifest")).json()).items.length, 0);

  const catalog = await (await call(env, "/review/catalog", { token: PASSWORD, ip: "10.4.0.1" })).json();
  assert.equal(catalog.hidden.length, 1);
  assert.equal(catalog.categories.some((entry) => entry.id === "solid"), false);

  const restored = await call(env, "/review/catalog", { method: "POST", token: PASSWORD, ip: "10.4.0.1", payload: { action: "restore-item", id: item.id } });
  assert.equal(restored.status, 200);
  assert.equal((await call(env, `/files/${item.id}`)).status, 200);
  const after = await (await call(env, "/review/catalog", { token: PASSWORD, ip: "10.4.0.1" })).json();
  assert.equal(after.hidden.length, 0);
});

test("角色决定银行校验与备注字段（不依赖分类显示名）", async () => {
  const env = makeEnv();
  await call(env, "/review/catalog", { method: "POST", token: PASSWORD, ip: "10.5.0.1", payload: { action: "add-category", name: "我行", kind: "logo", role: "bank" } });
  const catalog = await (await call(env, "/review/catalog", { token: PASSWORD, ip: "10.5.0.1" })).json();
  const custom = catalog.categories.find((entry) => entry.name === "我行");
  assert.equal(custom.role, "bank");
  const file = fileOf(pngBytes(120, 120), "l.png", "image/png");
  const noBank = submitForm({ kind: "logo", category: custom.id, ip: "10.5.0.2", file });
  assert.equal((await (await call(env, "/submit", { method: "POST", ip: "10.5.0.2", form: noBank.form })).json()).error, "bank");
  const withBank = submitForm({ kind: "logo", category: custom.id, bank: "ABC", ip: "10.5.0.3", file });
  assert.equal((await call(env, "/submit", { method: "POST", ip: "10.5.0.3", form: withBank.form })).status, 200);

  const renamed = await call(env, "/review/catalog", { method: "POST", token: PASSWORD, ip: "10.5.0.1", payload: { action: "rename-category", id: custom.id, name: "银行" } });
  assert.equal(renamed.status, 200);
  const after = await (await call(env, "/review/catalog", { token: PASSWORD, ip: "10.5.0.1" })).json();
  assert.equal(after.categories.find((entry) => entry.id === custom.id).role, "bank", "改名不影响角色");
});

test("未通过审核的内容不可公开访问，且审核文件需要鉴权", async () => {
  const env = makeEnv();
  const form = submitForm({ ip: "10.6.0.1", file: fileOf(pngBytes(90, 90), "f.png", "image/png") });
  await call(env, "/submit", { method: "POST", ip: "10.6.0.1", form: form.form });
  const item = (await (await call(env, "/review/items", { token: PASSWORD, ip: "10.6.0.1" })).json()).items[0];
  assert.equal((await call(env, `/files/${item.id}`)).status, 404);
  assert.equal((await call(env, `/review/file/${item.id}`)).status, 401);
  assert.equal((await call(env, `/review/file/${item.id}`, { token: PASSWORD, ip: "10.6.0.1" })).status, 200);
  assert.equal((await call(env, `/review/file/${item.id}`, { token: PASSWORD, ip: "10.6.0.1" })).headers.get("Cache-Control"), "private, no-store");
});

const DAY_MS = 24 * 60 * 60 * 1000;

test("隐藏时间才决定清理期限：上线很久的条目刚隐藏不会被立刻删除", async () => {
  const env = makeEnv();
  const form = submitForm({ ip: "10.7.0.1", file: fileOf(pngBytes(100, 100), "old.png", "image/png") });
  await call(env, "/submit", { method: "POST", ip: "10.7.0.1", form: form.form });
  const item = (await (await call(env, "/review/items", { token: PASSWORD, ip: "10.7.0.1" })).json()).items[0];
  await call(env, "/review/items", { method: "POST", token: PASSWORD, ip: "10.7.0.1", payload: { action: "approve", id: item.id, category: "solid" } });
  const stored = env.BUCKET.objects.get("records.json");
  const data = JSON.parse(new TextDecoder().decode(stored.bytes));
  data.find((entry) => entry.id === item.id).created = new Date(Date.now() - 60 * DAY_MS).toISOString();
  await env.BUCKET.put("records.json", JSON.stringify(data), { httpMetadata: { contentType: "application/json" } });
  assert.equal((await call(env, "/review/catalog", { method: "POST", token: PASSWORD, ip: "10.7.0.1", payload: { action: "hide-item", id: item.id } })).status, 200);
  // 打开审核页会触发 housekeeping：这里必须仍然保留文件和记录
  const catalog = await (await call(env, "/review/catalog", { token: PASSWORD, ip: "10.7.0.1" })).json();
  assert.equal(catalog.hidden.length, 1, "刚隐藏的条目不应被清理");
  assert.equal((await env.BUCKET.head(`approved/${item.id}.png`)) !== null, true, "文件必须保留");
  assert.equal((await call(env, "/review/catalog", { method: "POST", token: PASSWORD, ip: "10.7.0.1", payload: { action: "restore-item", id: item.id } })).status, 200);
  assert.equal((await call(env, `/files/${item.id}`)).status, 200);
});

test("已通过的条目不能被拒绝，线上文件保留", async () => {
  const env = makeEnv();
  const form = submitForm({ ip: "10.7.1.1", file: fileOf(pngBytes(120, 90), "keep.png", "image/png") });
  await call(env, "/submit", { method: "POST", ip: "10.7.1.1", form: form.form });
  const item = (await (await call(env, "/review/items", { token: PASSWORD, ip: "10.7.1.1" })).json()).items[0];
  await call(env, "/review/items", { method: "POST", token: PASSWORD, ip: "10.7.1.1", payload: { action: "approve", id: item.id, category: "solid" } });
  const rejected = await call(env, "/review/items", { method: "POST", token: PASSWORD, ip: "10.7.1.1", payload: { action: "reject", id: item.id } });
  assert.equal(rejected.status, 409);
  assert.equal((await env.BUCKET.head(`approved/${item.id}.png`)) !== null, true);
  assert.equal((await call(env, `/files/${item.id}`)).status, 200);
});

test("被拒绝的条目不能再通过（文件已删除）", async () => {
  const env = makeEnv();
  const form = submitForm({ ip: "10.7.2.1", file: fileOf(pngBytes(80, 80), "gone.png", "image/png") });
  await call(env, "/submit", { method: "POST", ip: "10.7.2.1", form: form.form });
  const item = (await (await call(env, "/review/items", { token: PASSWORD, ip: "10.7.2.1" })).json()).items[0];
  await call(env, "/review/items", { method: "POST", token: PASSWORD, ip: "10.7.2.1", payload: { action: "reject", id: item.id } });
  const again = await call(env, "/review/items", { method: "POST", token: PASSWORD, ip: "10.7.2.1", payload: { action: "approve", id: item.id, category: "solid" } });
  assert.equal(again.status, 409);
});

test("并发分类改动不会互相覆盖（catalog 乐观锁）", async () => {
  const env = makeEnv({ BUCKET: new FakeBucket({ latency: 3 }) });
  const names = ["甲", "乙", "丙"];
  const responses = await Promise.all(names.map((name, index) => call(env, "/review/catalog", {
    method: "POST",
    token: PASSWORD,
    ip: `10.8.0.${index + 1}`,
    payload: { action: "add-category", name, kind: "face", role: "plain" },
  })));
  assert.deepEqual(responses.map((response) => response.status), [200, 200, 200]);
  const catalog = await (await call(env, "/review/catalog", { token: PASSWORD, ip: "10.8.0.9" })).json();
  names.forEach((name) => assert.equal(catalog.categories.some((entry) => entry.name === name), true, `分类 ${name} 应保留`));
});

test("DELETE /review/password 需要当前口令，清除后回到 env 控制", async () => {
  const env = makeEnv();
  assert.equal((await call(env, "/review/password", { method: "DELETE", ip: "10.9.0.1" })).status, 401);
  await call(env, "/review/password", { method: "POST", token: PASSWORD, ip: "10.9.0.1", payload: { password: "rotated-password-1" } });
  assert.equal((await call(env, "/review/items", { token: "rotated-password-1", ip: "10.9.0.1" })).status, 200);
  const cleared = await call(env, "/review/password", { method: "DELETE", token: "rotated-password-1", ip: "10.9.0.1" });
  assert.equal(cleared.status, 200);
  assert.equal((await cleared.json()).source, "env");
  assert.equal((await call(env, "/review/items", { token: "rotated-password-1", ip: "10.9.0.1" })).status, 401);
  assert.equal((await call(env, "/review/items", { token: PASSWORD, ip: "10.9.0.1" })).status, 200);
});

test("JPEG 段长度非法时按不可信拒绝，避免绕过像素上限", async () => {
  const env = makeEnv();
  const bad = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0xff, 0xc0, 0x00, 0x11, 0x08, 0xff, 0xff, 0xff, 0xff, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9]);
  const response = await call(env, "/submit", { method: "POST", ip: "10.10.0.1", form: submitForm({ ip: "10.10.0.1", file: fileOf(bad, "bomb.jpg", "image/jpeg") }).form });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "size");
});
