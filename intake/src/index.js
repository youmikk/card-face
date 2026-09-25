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
     if (url.pathname === "/review" && request.method === "GET") return reviewPage();
     if (url.pathname === "/review/password" && request.method === "GET") return passwordState(env);
     if (url.pathname === "/review/password" && request.method === "POST") return passwordSet(request, env);
     if (url.pathname === "/review/catalog" && request.method === "GET") return catalogGet(request, env);
     if (url.pathname === "/review/catalog" && request.method === "POST") return catalogAction(request, env);
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
   const hidden = new Set((await catalog(env)).hidden || []);
   const items = (await records(env)).filter((item) => item.status === "approved" && !hidden.has(item.id)).map((item) => publicItem(item, origin));
   return json({ items, categories: publicCategories(await catalog(env)) });
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
   const cats = await catalog(env);
   const allowed = cats.categories.filter((entry) => (entry.kind || "face") === kind).map((entry) => entry.id);
   if (!name || (kind !== "face" && kind !== "logo") || !allowed.includes(category) || !(file instanceof File)) return json({ error: "fields" }, 400);
   const label = String(form.get("label") || "").trim().slice(0, 24);
   const needsBank = kind === "logo" && (cats.categories.find((entry) => entry.id === category)?.name === "银行");
   if (needsBank && !/^[A-Za-z0-9_-]{2,16}$/.test(bank)) return json({ error: "bank" }, 400);
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
     bank: needsBank ? bank : "",
     label,
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
   if (!(await authorized(request, env))) return new Response("unauthorized", { status: 401 });
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
 async function passwordState(env) {
   const saved = await env.BUCKET.get("review-password.txt");
   return Response.json({ ready: Boolean(saved) });
 }
 async function passwordSet(request, env) {
   if (await env.BUCKET.get("review-password.txt")) return new Response("already set", { status: 409 });
   const body = await request.json().catch(() => null);
   const password = String(body?.password || "").trim();
   if (password.length < 4 || password.length > 80) return Response.json({ error: "password" }, { status: 400 });
   await env.BUCKET.put("review-password.txt", password, { httpMetadata: { contentType: "text/plain" } });
   return Response.json({ ok: true });
 }
 async function storedPassword(env) {
   const saved = await env.BUCKET.get("review-password.txt");
   if (!saved) return String(env.REVIEW_PASSWORD || "").trim();
   if (typeof saved.text === "function") return (await saved.text()).trim();
   return new TextDecoder().decode(await new Response(saved.body).arrayBuffer()).trim();
 }
 async function authorized(request, env) {
   const header = request.headers.get("Authorization") || "";
   const token = (header.startsWith("Bearer ") ? header.slice(7) : "").trim();
   const password = await storedPassword(env);
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
   if (!(await authorized(request, env))) return new Response("unauthorized", { status: 401 });
  const items = await records(env);
   return Response.json({ items: items.filter((item) => item.status === "pending") });
}

 async function reviewAction(request, env) {
   if (!(await authorized(request, env))) return new Response("unauthorized", { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !body.id) return Response.json({ error: "fields" }, { status: 400 });
  const items = await records(env);
  const item = items.find((entry) => entry.id === body.id);
  if (!item) return Response.json({ error: "missing" }, { status: 404 });
  if (body.action === "reject") {
    item.status = "rejected";
  } else if (body.action === "approve") {
     const cats = await catalog(env);
     const allowed = cats.categories.filter((entry) => (entry.kind || "face") === item.kind).map((entry) => entry.id);
     if (!allowed.includes(body.category)) return Response.json({ error: "category" }, { status: 400 });
     const label = String(body.label || item.label || "").trim().slice(0, 24);
     const needsBank = item.kind === "logo" && cats.categories.find((entry) => entry.id === body.category)?.name === "银行";
     if (needsBank && !/^[A-Za-z0-9_-]{2,16}$/.test(String(body.bank || ""))) {
       return Response.json({ error: "bank" }, { status: 400 });
     }
     item.category = body.category;
     item.bank = needsBank ? String(body.bank || "") : "";
     if (body.name) item.name = String(body.name).trim().slice(0, 40);
     item.label = label;
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
 const DEFAULT_FACE_CATS = [{ id: "solid", name: "纯色" }, { id: "bank", name: "银行" }, { id: "transit", name: "交通" }, { id: "other", name: "其他" }];
 function publicCategories(data) {
   return (data.categories || DEFAULT_FACE_CATS).filter((entry) => entry && entry.id && entry.name);
 }
 async function catalog(env) {
   const object = await env.BUCKET.get("catalog.json");
   const data = object ? await object.json().catch(() => null) : null;
   const categories = Array.isArray(data?.categories) ? data.categories : DEFAULT_FACE_CATS.map((entry) => ({ ...entry }));
   return { categories, hidden: Array.isArray(data?.hidden) ? data.hidden : [] };
 }
 async function saveCatalog(env, data) {
   await env.BUCKET.put("catalog.json", JSON.stringify(data), { httpMetadata: { contentType: "application/json" } });
 }
 async function catalogGet(request, env) {
   if (!(await authorized(request, env))) return new Response("unauthorized", { status: 401 });
   const data = await catalog(env);
   const items = (await records(env)).filter((item) => item.status === "approved" && !data.hidden.includes(item.id));
   return Response.json({ categories: data.categories, items });
 }
 async function catalogAction(request, env) {
   if (!(await authorized(request, env))) return new Response("unauthorized", { status: 401 });
   const body = await request.json().catch(() => null);
   if (!body) return Response.json({ error: "fields" }, { status: 400 });
   const data = await catalog(env);
   if (body.action === "add-category" || body.action === "rename-category") {
     const name = String(body.name || "").trim().slice(0, 16);
     if (!name) return Response.json({ error: "name" }, { status: 400 });
     if (body.action === "rename-category") {
       const target = data.categories.find((entry) => entry.id === body.id);
       if (!target) return Response.json({ error: "category" }, { status: 400 });
       target.name = name;
     } else data.categories.push({ id: crypto.randomUUID().replace(/-/g, "").slice(0, 12), name, kind: body.kind === "logo" ? "logo" : "face" });
   } else if (body.action === "remove-category") {
     const target = data.categories.find((entry) => entry.id === body.id);
     if (!target) return Response.json({ error: "category" }, { status: 400 });
     const siblings = data.categories.filter((entry) => (entry.kind || "face") === (target.kind || "face") && entry.id !== target.id);
     data.categories = data.categories.filter((entry) => entry.id !== target.id);
     const items = await records(env);
     const matched = items.filter((item) => item.kind === (target.kind || "face") && item.category === target.id);
     if (siblings.length) matched.forEach((item) => { item.category = siblings[0].id; });
     else await Promise.all(matched.map((item) => env.BUCKET.delete(item.key)));
     await saveRecords(env, siblings.length ? items : items.filter((item) => !matched.includes(item)));
   } else if (body.action === "move-category") {
     const index = data.categories.findIndex((entry) => entry.id === body.id);
     const next = index + (body.direction === "up" ? -1 : 1);
     if (index < 0 || next < 0 || next >= data.categories.length) return Response.json({ error: "move" }, { status: 400 });
     if ((data.categories[index].kind || "face") !== (data.categories[next].kind || "face")) return Response.json({ error: "move" }, { status: 400 });
     const [entry] = data.categories.splice(index, 1);
     data.categories.splice(next, 0, entry);
   } else if (body.action === "move-face") {
     const items = await records(env);
     const item = items.find((entry) => entry.id === body.id);
     if (!item) return Response.json({ error: "missing" }, { status: 404 });
     const allowed = data.categories.filter((entry) => (entry.kind || "face") === item.kind).map((entry) => entry.id);
     if (!allowed.includes(body.category)) return Response.json({ error: "category" }, { status: 400 });
     item.category = body.category;
     if (item.kind === "logo") item.bank = "";
     await saveRecords(env, items);
   } else if (body.action === "rename-item") {
     const items = await records(env);
     const item = items.find((entry) => entry.id === body.id);
     const name = String(body.name || "").trim().slice(0, 40);
     if (!item || !name) return Response.json({ error: "name" }, { status: 400 });
     item.name = name;
     await saveRecords(env, items);
   } else if (body.action === "hide-face") {
     const items = await records(env);
     const item = items.find((entry) => entry.id === body.id);
     if (item) {
       await env.BUCKET.delete(item.key);
       await saveRecords(env, items.filter((entry) => entry.id !== body.id));
     }
   } else return Response.json({ error: "action" }, { status: 400 });
   await saveCatalog(env, data);
   return Response.json({ ok: true });
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
   body { margin: 0; background: #f4f6f8; color: #1d2733; font: 14px/1.5 "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
   header { position: sticky; top: 0; z-index: 2; display: flex; align-items: baseline; gap: 12px; padding: 16px 22px; background: rgba(255,255,255,.94); border-bottom: 1px solid #e4e8ee; }
   header strong { font-size: 18px; }
   header span, .muted { color: #667385; }
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
   input, select { min-height: 38px; border: 1px solid #e4e8ee; border-radius: 10px; padding: 0 10px; background: #fff; color: #1d2733; }
   .add { margin-top: 12px; }
   .add input { flex: 1; min-width: 160px; }
   button { min-height: 34px; border: 0; border-radius: 10px; padding: 0 12px; background: #eef2f6; color: #1d2733; cursor: pointer; }
   button:disabled { opacity: .4; cursor: default; }
   .ok { background: #1b2b40; color: #fff; }
   .no { background: #fff; color: #c44747; box-shadow: inset 0 0 0 1px #f0d0d0; }
   .empty { margin: 8px 0 0; }
   @media (max-width: 700px) { article { grid-template-columns: 1fr; } }
 </style>
 <header><strong>卡面审核</strong><span>管理分类和已经出现在网页上的卡面</span></header>
 <main>
   <section id="catalog"></section>
   <section><h2>待处理</h2><div id="list"></div></section>
 </main>
 <script>
 let token = "";
 let openCategory = "";
 let faceCats = [];
 const previews = [];
 function auth() { return { Authorization: "Bearer " + token }; }
 function catalogSend(body) {
   return fetch("/review/catalog", { method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((response) => { if (response.ok) return load(); });
 }
 function drawCatalog(data) {
   data.categories.forEach((entry) => { entry.kind = entry.kind || "face"; });
   faceCats = data.categories.filter((entry) => entry.kind === "face").map((entry) => [entry.id, entry.name]);
   const groups = data.categories.map((entry) => ({ id: entry.id, name: entry.name, kind: entry.kind }));
   if (!groups.some((entry) => entry.kind + ":" + entry.id === openCategory)) openCategory = groups.length ? groups[0].kind + ":" + groups[0].id : "";
   const current = groups.find((entry) => entry.kind + ":" + entry.id === openCategory);
   const box = document.querySelector("#catalog");
   box.replaceChildren();
   const title = document.createElement("h2");
   title.textContent = "分类";
   const note = document.createElement("p");
   note.className = "muted";
   note.textContent = "先添加分类。点开一个分类后，只显示里面的卡面或 logo。";
   const cats = document.createElement("div");
   cats.className = "cats";
   groups.forEach((entry) => {
     const row = document.createElement("div");
     row.className = "cat" + (entry === current ? " active" : "");
     const open = document.createElement("button");
     open.type = "button"; open.className = "name"; open.textContent = (entry.kind === "face" ? "卡面 · " : "Logo · ") + entry.name;
     open.addEventListener("click", () => { openCategory = entry.kind + ":" + entry.id; drawCatalog(data); });
     const rename = document.createElement("button");
     rename.type = "button"; rename.textContent = "改名";
     rename.addEventListener("click", () => {
       const name = prompt("分类名称", entry.name);
       if (name && name.trim() && name.trim() !== entry.name) catalogSend({ action: "rename-category", id: entry.id, name });
     });
     const same = groups.filter((item) => item.kind === entry.kind);
     const index = same.indexOf(entry);
     const up = document.createElement("button");
     up.type = "button"; up.textContent = "上移"; up.disabled = index === 0;
     up.addEventListener("click", () => catalogSend({ action: "move-category", id: entry.id, direction: "up" }));
     const down = document.createElement("button");
     down.type = "button"; down.textContent = "下移"; down.disabled = index === same.length - 1;
     down.addEventListener("click", () => catalogSend({ action: "move-category", id: entry.id, direction: "down" }));
     const remove = document.createElement("button");
     remove.type = "button"; remove.className = "no"; remove.textContent = "删除分类";
     remove.addEventListener("click", () => catalogSend({ action: "remove-category", id: entry.id }));
     row.append(open, rename, up, down, remove);
     cats.append(row);
   });
   const add = document.createElement("form");
   add.className = "add";
   const kind = document.createElement("select");
   [["face","卡面"],["logo","Logo"]].forEach(([id, text]) => kind.append(Object.assign(document.createElement("option"), { value: id, textContent: text })));
   const input = document.createElement("input");
   input.placeholder = "新分类名称"; input.maxLength = 16; input.required = true;
   const submit = document.createElement("button");
   submit.className = "ok"; submit.textContent = "添加分类";
   add.append(kind, input, submit);
   add.addEventListener("submit", (event) => { event.preventDefault(); openCategory = kind.value + ":new"; catalogSend({ action: "add-category", name: input.value, kind: kind.value }); });
   box.append(title, note, cats, add);
   if (!current) return;
   const heading = document.createElement("h2");
   heading.textContent = (current.kind === "face" ? "卡面 · " : "Logo · ") + current.name;
   const cards = document.createElement("div");
   cards.className = "cards";
   const visible = data.items.filter((item) => item.kind === current.kind && item.category === current.id);
   const choices = data.categories.filter((entry) => entry.kind === current.kind);
   visible.forEach((item) => {
     const card = document.createElement("article");
     card.className = "card";
     const preview = document.createElement("img");
     preview.alt = item.name; preview.src = "/files/" + item.id;
     const body = document.createElement("div");
     const name = document.createElement("input");
     name.value = item.name; name.maxLength = 40;
     name.addEventListener("change", () => catalogSend({ action: "rename-item", id: item.id, name: name.value }));
     const category = document.createElement("select");
     choices.forEach((entry) => category.append(Object.assign(document.createElement("option"), { value: entry.id, textContent: entry.name })));
     category.value = current.id;
     category.addEventListener("change", () => { openCategory = current.kind + ":" + category.value; catalogSend({ action: "move-face", id: item.id, category: category.value }); });
     const remove = document.createElement("button");
     remove.type = "button"; remove.className = "no"; remove.textContent = "删除";
     remove.addEventListener("click", () => catalogSend({ action: "hide-face", id: item.id }));
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
   box.append(title, note, cats, add, heading, cards);
 }
 async function load() {
   previews.forEach((url) => URL.revokeObjectURL(url));
   previews.length = 0;
   const state = await fetch("/review/password").then((response) => response.json());
   if (!state.ready) {
     const created = (prompt("设置审核密码，设置后不能在页面里修改") || "").trim();
     if (created.length < 4) { document.querySelector("#list").textContent = "请先设置至少 4 位的审核密码"; return; }
     const saved = await fetch("/review/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: created }) });
     if (!saved.ok) { document.querySelector("#list").textContent = "审核密码设置失败"; return; }
     token = created;
     sessionStorage.setItem("review-token", token);
   }
   token = sessionStorage.getItem("review-token") || "";
   let response = token ? await fetch("/review/items", { headers: auth() }) : { ok: false, status: 401 };
   while (response.status === 401) {
     sessionStorage.removeItem("review-token");
     token = (prompt("审核密码") || "").trim();
     if (!token) { document.querySelector("#list").textContent = "需要审核密码"; return; }
     sessionStorage.setItem("review-token", token);
     response = await fetch("/review/items", { headers: auth() });
   }
   if (!response.ok) { document.querySelector("#list").textContent = "审核列表加载失败"; return; }
   const catalog = await fetch("/review/catalog", { headers: auth() });
   if (catalog.ok) drawCatalog(await catalog.json());
   const data = await response.json();
   const list = document.querySelector("#list");
   list.replaceChildren();
   for (const item of data.items) {
     const card = document.createElement("article");
     const preview = document.createElement("img");
     const file = await fetch("/review/file/" + item.id, { headers: auth() });
     if (file.ok) {
       const url = URL.createObjectURL(await file.blob());
       previews.push(url);
       preview.src = url;
     }
     const form = document.createElement("form");
     const name = field("名称", "text", item.name);
     const options = data.categories.filter((entry) => (entry.kind || "face") === item.kind).map((entry) => [entry.id, entry.name]);
     if (!options.some(([id]) => id === item.category)) options.push([item.category, item.category]);
     const category = select("分类", options, item.category);
     const bank = field("银行编号", "text", item.bank || "");
     const custom = field("备注", "text", item.label || "");
     const selected = () => data.categories.find((entry) => entry.id === category.querySelector("select").value);
     bank.hidden = !(item.kind === "logo" && selected()?.name === "银行");
     custom.hidden = selected()?.name !== "其他";
     category.querySelector("select").addEventListener("change", () => {
       bank.hidden = !(item.kind === "logo" && selected()?.name === "银行");
       custom.hidden = selected()?.name !== "其他";
     });
     const row = document.createElement("div");
     row.className = "row";
     const approve = document.createElement("button");
     approve.type = "button"; approve.className = "ok"; approve.textContent = item.status === "approved" ? "更新" : "通过";
     const reject = document.createElement("button");
     reject.type = "button"; reject.className = "no"; reject.textContent = "拒绝";
     const send = (action) => fetch("/review/items", {
       method: "POST", headers: { ...auth(), "Content-Type": "application/json" },
       body: JSON.stringify({ action, id: item.id, name: name.querySelector("input").value, category: category.querySelector("select").value, bank: bank.querySelector("input").value, label: custom.querySelector("input").value }),
     }).then(() => load());
     approve.addEventListener("click", () => send("approve"));
     reject.addEventListener("click", () => send("reject"));
     row.append(approve, reject);
     form.append(name, category, bank, custom, row);
     card.append(preview, form);
     list.appendChild(card);
   }
   if (!data.items.length) {
     const empty = document.createElement("p");
     empty.className = "muted empty";
     empty.textContent = "没有待处理的图片。";
     list.append(empty);
   }
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
