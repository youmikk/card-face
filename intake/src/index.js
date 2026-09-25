const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const FACE_CATS = ["solid", "bank", "transit", "other"];
const LOGO_CATS = ["banks", "transit", "official", "payment"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (url.pathname === "/manifest" && request.method === "GET") return manifest(request, env);
    if (url.pathname === "/submit" && request.method === "POST") return submit(request, env);
    if (url.pathname === "/review" && request.method === "GET") return reviewPage(request, env);
    if (url.pathname === "/review/items" && request.method === "GET") return reviewItems(request, env);
    if (url.pathname === "/review/items" && request.method === "POST") return reviewAction(request, env);
    const pending = url.pathname.match(/^\/review\/file\/([A-Za-z0-9_-]+)$/);
    if (pending && request.method === "GET") return reviewFile(request, env, pending[1]);
    const file = url.pathname.match(/^\/files\/([A-Za-z0-9_-]+)$/);
    if (file && request.method === "GET") return publicFile(request, env, file[1]);
    return new Response("not found", { status: 404 });
  },
};

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, { status: response.status, headers });
}

function json(data, status = 200) {
  return cors(Response.json(data, { status }));
}

async function manifest(request, env) {
  const origin = new URL(request.url).origin;
  const items = (await records(env)).filter((item) => item.status === "approved").map((item) => publicItem(item, origin));
  return json({ items });
}

async function submit(request, env) {
  let form;
  try { form = await request.formData(); }
  catch { return json({ error: "form" }, 400); }
  const name = String(form.get("name") || "").trim().slice(0, 40);
  const kind = String(form.get("kind") || "");
  const category = String(form.get("category") || "");
  const bank = String(form.get("bank") || "");
  const file = form.get("file");
  const allowed = kind === "face" ? FACE_CATS : kind === "logo" ? LOGO_CATS : null;
  if (!name || !allowed || !allowed.includes(category) || !(file instanceof File)) return json({ error: "fields" }, 400);
  if (kind === "logo" && category === "banks" && !/^[A-Za-z0-9_-]{2,16}$/.test(bank)) return json({ error: "bank" }, 400);
  const type = TYPES[file.type] || extOf(file.name);
  if (!type || file.size <= 0 || file.size > MAX_BYTES) return json({ error: "file" }, 400);
  const id = crypto.randomUUID().replace(/-/g, "");
  const key = `pending/${id}.${type}`;
  await env.BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: contentType(type) },
  });
  const items = await records(env);
  items.push({
    id,
    kind,
    name,
    category,
    bank: kind === "logo" && category === "banks" ? bank : "",
    type,
    key,
    status: "pending",
    created: new Date().toISOString(),
  });
  await saveRecords(env, items);
  return json({ ok: true });
}
async function publicFile(request, env, id) {
  const item = (await records(env)).find((entry) => entry.id === id && entry.status === "approved");
  if (!item) return new Response("not found", { status: 404 });
  return objectResponse(env, item, true);
}

async function reviewFile(request, env, id) {
  if (!authorized(request, env)) return new Response("unauthorized", { status: 401 });
  const item = (await records(env)).find((entry) => entry.id === id && entry.status !== "rejected");
  if (!item) return new Response("not found", { status: 404 });
  return objectResponse(env, item, false);
}

async function objectResponse(env, item, cache) {
  const object = await env.BUCKET.get(item.key);
  if (!object) return new Response("not found", { status: 404 });
  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType || contentType(item.type));
  headers.set("Cache-Control", cache ? "public, max-age=86400" : "private, no-store");
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(object.body, { headers });
}

function authorized(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const password = env.REVIEW_PASSWORD || "";
  if (!password || token.length !== password.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i += 1) diff |= token.charCodeAt(i) ^ password.charCodeAt(i);
  return diff === 0;
}

function reviewPage() {
  return new Response(PAGE, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function reviewItems(request, env) {
  if (!authorized(request, env)) return new Response("unauthorized", { status: 401 });
  const items = await records(env);
  return Response.json({ items: items.filter((item) => item.status !== "rejected") });
}

async function reviewAction(request, env) {
  if (!authorized(request, env)) return new Response("unauthorized", { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !body.id) return Response.json({ error: "fields" }, { status: 400 });
  const items = await records(env);
  const item = items.find((entry) => entry.id === body.id);
  if (!item) return Response.json({ error: "missing" }, { status: 404 });
  if (body.action === "reject") {
    item.status = "rejected";
  } else if (body.action === "approve") {
    const allowed = item.kind === "face" ? FACE_CATS : LOGO_CATS;
    if (!allowed.includes(body.category)) return Response.json({ error: "category" }, { status: 400 });
    if (item.kind === "logo" && body.category === "banks" && !/^[A-Za-z0-9_-]{2,16}$/.test(String(body.bank || ""))) {
      return Response.json({ error: "bank" }, { status: 400 });
    }
    item.category = body.category;
    item.bank = item.kind === "logo" && body.category === "banks" ? String(body.bank || "") : "";
    if (body.name) item.name = String(body.name).trim().slice(0, 40);
    const next = `approved/${item.id}.${item.type}`;
    if (item.key !== next) {
      const object = await env.BUCKET.get(item.key);
      if (!object) return Response.json({ error: "file" }, { status: 404 });
      await env.BUCKET.put(next, object.body, { httpMetadata: object.httpMetadata });
      await env.BUCKET.delete(item.key);
      item.key = next;
    }
    item.status = "approved";
  } else {
    return Response.json({ error: "action" }, { status: 400 });
  }
  await saveRecords(env, items);
  return Response.json({ ok: true });
}

function publicItem(item, origin) {
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    category: item.category,
    bank: item.bank || "",
    url: `${origin}/files/${item.id}`,
    width: 132,
  };
}

async function records(env) {
  const object = await env.BUCKET.get("records.json");
  if (!object) return [];
  const data = await object.json().catch(() => null);
  return Array.isArray(data) ? data : [];
}

async function saveRecords(env, items) {
  await env.BUCKET.put("records.json", JSON.stringify(items), {
    httpMetadata: { contentType: "application/json" },
  });
}

function extOf(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return "";
  if (match[1] === "png") return "png";
  if (match[1] === "jpg" || match[1] === "jpeg") return "jpg";
  if (match[1] === "webp") return "webp";
  if (match[1] === "svg") return "svg";
  return "";
}

function contentType(type) {
  if (type === "png") return "image/png";
  if (type === "jpg") return "image/jpeg";
  if (type === "webp") return "image/webp";
  return "image/svg+xml";
}

const PAGE = `<!doctype html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>审核</title>
<style>
  body { margin: 0; font: 15px/1.5 sans-serif; background: #f4f7fb; color: #172033; }
  main { max-width: 920px; margin: 0 auto; padding: 24px; }
  article { display: grid; grid-template-columns: 180px 1fr; gap: 16px; background: #fff; border-radius: 16px; padding: 16px; margin: 12px 0; }
  img, svg { width: 180px; height: 114px; object-fit: contain; background: #eef2f6; border-radius: 10px; }
  label { display: grid; gap: 4px; margin: 8px 0; }
  input, select { min-height: 36px; }
  .row { display: flex; gap: 8px; }
  button { min-height: 36px; border: 0; border-radius: 999px; padding: 0 14px; cursor: pointer; }
  .ok { background: #16324f; color: #fff; }
  .no { background: #efe7e4; }
  @media (max-width: 700px) { article { grid-template-columns: 1fr; } }
</style>
<main>
  <h1>待审核</h1>
  <div id="list"></div>
</main>
<script>
let token = "";
const faces = [["solid","纯色"],["bank","银行"],["transit","交通"],["other","其他"]];
const logos = [["banks","银行"],["transit","交通联合"],["official","官方"],["payment","支付"]];
const previews = [];
function auth() {
  return { Authorization: "Bearer " + token };
}
async function load() {
  previews.forEach((url) => URL.revokeObjectURL(url));
  previews.length = 0;
  token = sessionStorage.getItem("review-token") || "";
  let response = token ? await fetch("/review/items", { headers: auth() }) : { ok: false };
  while (!response.ok) {
    sessionStorage.removeItem("review-token");
    token = prompt("审核密码") || "";
    if (!token) {
      document.querySelector("#list").textContent = "需要审核密码";
      return;
    }
    sessionStorage.setItem("review-token", token);
    response = await fetch("/review/items", { headers: auth() });
  }
  const data = await response.json();
  const list = document.querySelector("#list");
  list.replaceChildren();
  for (const item of data.items) {
    const card = document.createElement("article");
    const preview = document.createElement("img");
    preview.alt = item.name;
    const file = await fetch("/review/file/" + item.id, { headers: auth() });
    if (file.ok) {
      const url = URL.createObjectURL(await file.blob());
      previews.push(url);
      preview.src = url;
    }
    const form = document.createElement("form");
    const name = field("名称", "text", item.name);
    const cats = item.kind === "face" ? faces : logos;
    const category = select("分类", cats, item.category);
    const bank = field("银行编号", "text", item.bank || "");
    bank.hidden = !(item.kind === "logo" && category.querySelector("select").value === "banks");
    category.querySelector("select").addEventListener("change", (event) => {
      bank.hidden = !(item.kind === "logo" && event.target.value === "banks");
    });
    const row = document.createElement("div");
    row.className = "row";
    const approve = document.createElement("button");
    approve.type = "button"; approve.className = "ok"; approve.textContent = item.status === "approved" ? "更新" : "通过";
    const reject = document.createElement("button");
    reject.type = "button"; reject.className = "no"; reject.textContent = "拒绝";
    const send = (action) => fetch("/review/items", {
      method: "POST", headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({
        action, id: item.id,
        name: name.querySelector("input").value,
        category: category.querySelector("select").value,
        bank: bank.querySelector("input").value,
      }),
    }).then(() => load());
    approve.addEventListener("click", () => send("approve"));
    reject.addEventListener("click", () => send("reject"));
    row.append(approve, reject);
    form.append(name, category, bank, row);
    card.append(preview, form);
    list.appendChild(card);
  }
  if (!data.items.length) list.textContent = "没有待审核的图片";
}
function field(label, type, value) {
  const node = document.createElement("label");
  node.append(label, Object.assign(document.createElement("input"), { type, value }));
  return node;
}
function select(label, options, value) {
  const node = document.createElement("label");
  const box = document.createElement("select");
  options.forEach(([id, text]) => box.append(Object.assign(document.createElement("option"), { value: id, textContent: text })));
  box.value = value;
  node.append(label, box);
  return node;
}
load();
</script>`;
