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
  const allowed = kind === "face" ? FACE_CATS : kind === "logo" ? LOGO_CATS : null;
  if (!name || !allowed || !allowed.includes(category) || !(file instanceof File)) return json({ error: "fields" }, 400);
  const label = String(form.get("label") || "").trim().slice(0, 24);
  if (category === "other" && !label) return json({ error: "label" }, 400);
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
    label: category === "other" ? label : "",
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
  return Response.json({ items: items.filter((item) => item.status !== "rejected") });
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
    const allowed = item.kind === "face" ? FACE_CATS : LOGO_CATS;
    if (!allowed.includes(body.category)) return Response.json({ error: "category" }, { status: 400 });
    const label = String(body.label || item.label || "").trim().slice(0, 24);
    if (body.category === "other" && !label) return Response.json({ error: "label" }, { status: 400 });
    if (item.kind === "logo" && body.category === "banks" && !/^[A-Za-z0-9_-]{2,16}$/.test(String(body.bank || ""))) {
      return Response.json({ error: "bank" }, { status: 400 });
    }
    item.category = body.category;
    item.bank = item.kind === "logo" && body.category === "banks" ? String(body.bank || "") : "";
    if (body.name) item.name = String(body.name).trim().slice(0, 40);
    item.label = body.category === "other" ? label : "";
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
   const categories = Array.isArray(data?.categories) && data.categories.length ? data.categories : DEFAULT_FACE_CATS.map((entry) => ({ ...entry }));
   return { categories, hidden: Array.isArray(data?.hidden) ? data.hidden : [] };
 }
 async function saveCatalog(env, data) {
   await env.BUCKET.put("catalog.json", JSON.stringify(data), { httpMetadata: { contentType: "application/json" } });
 }
 async function catalogGet(request, env) {
   if (!(await authorized(request, env))) return new Response("unauthorized", { status: 401 });
   const data = await catalog(env);
   const items = (await records(env)).filter((item) => item.kind === "face" && item.status === "approved" && !data.hidden.includes(item.id));
   return Response.json({ categories: data.categories, items });
 }
 async function catalogAction(request, env) {
   if (!(await authorized(request, env))) return new Response("unauthorized", { status: 401 });
   const body = await request.json().catch(() => null);
   if (!body) return Response.json({ error: "fields" }, { status: 400 });
   const data = await catalog(env);
   if (body.action === "add-category") {
     const name = String(body.name || "").trim().slice(0, 16);
     if (!name) return Response.json({ error: "name" }, { status: 400 });
     data.categories.push({ id: crypto.randomUUID().replace(/-/g, "").slice(0, 12), name });
   } else if (body.action === "remove-category") {
     if (!data.categories.some((entry) => entry.id === body.id) || data.categories.length < 2) return Response.json({ error: "category" }, { status: 400 });
     const fallback = data.categories.find((entry) => entry.id !== body.id).id;
     data.categories = data.categories.filter((entry) => entry.id !== body.id);
     const items = await records(env);
     items.forEach((item) => { if (item.kind === "face" && item.category === body.id) item.category = fallback; });
     await saveRecords(env, items);
   } else if (body.action === "move-category") {
     const index = data.categories.findIndex((entry) => entry.id === body.id);
     const next = index + (body.direction === "up" ? -1 : 1);
     if (index < 0 || next < 0 || next >= data.categories.length) return Response.json({ error: "move" }, { status: 400 });
     const [entry] = data.categories.splice(index, 1);
     data.categories.splice(next, 0, entry);
   } else if (body.action === "move-face") {
     if (!data.categories.some((entry) => entry.id === body.category)) return Response.json({ error: "category" }, { status: 400 });
     const items = await records(env);
     const item = items.find((entry) => entry.id === body.id && entry.kind === "face");
     if (!item) return Response.json({ error: "missing" }, { status: 404 });
     item.category = body.category;
     await saveRecords(env, items);
   } else if (body.action === "hide-face") {
     if (!data.hidden.includes(body.id)) data.hidden.push(body.id);
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
   <section id="catalog"></section>
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
   const state = await fetch("/review/password").then((response) => response.json());
   if (!state.ready) {
     const created = (prompt("设置审核密码，设置后不能在页面里修改") || "").trim();
     if (created.length < 4) {
       document.querySelector("#list").textContent = "请先设置至少 4 位的审核密码";
       return;
     }
     const saved = await fetch("/review/password", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ password: created }),
     });
     if (!saved.ok) {
       document.querySelector("#list").textContent = "审核密码设置失败";
       return;
     }
     token = created;
     sessionStorage.setItem("review-token", token);
   }
   token = sessionStorage.getItem("review-token") || "";
   let response = token ? await fetch("/review/items", { headers: auth() }) : { ok: false, status: 401 };
   while (response.status === 401) {
     sessionStorage.removeItem("review-token");
     token = (prompt("审核密码") || "").trim();
     if (!token) {
       document.querySelector("#list").textContent = "需要审核密码";
       return;
     }
     sessionStorage.setItem("review-token", token);
     response = await fetch("/review/items", { headers: auth() });
   }
   if (!response.ok) {
     document.querySelector("#list").textContent = "审核列表加载失败";
     return;
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
    const custom = field("自定义分类", "text", item.label || "");
    bank.hidden = !(item.kind === "logo" && category.querySelector("select").value === "banks");
    custom.hidden = category.querySelector("select").value !== "other";
    category.querySelector("select").addEventListener("change", (event) => {
      bank.hidden = !(item.kind === "logo" && event.target.value === "banks");
      custom.hidden = event.target.value !== "other";
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
        label: custom.querySelector("input").value,
      }),
    }).then(() => load());
    approve.addEventListener("click", () => send("approve"));
    reject.addEventListener("click", () => send("reject"));
    row.append(approve, reject);
    form.append(name, category, bank, custom, row);
    card.append(preview, form);
    list.appendChild(card);
  }
  if (!data.items.length) list.textContent = "没有待审核的图片";
 }
 async function catalogSend(body) {
   await fetch("/review/catalog", { method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
   await loadCatalog();
 }
 async function loadCatalog() {
   const response = await fetch("/review/catalog", { headers: auth() });
   const box = document.querySelector("#catalog");
   if (!response.ok) { box.textContent = ""; return; }
   const data = await response.json();
   box.replaceChildren();
   const title = document.createElement("h2");
   title.textContent = "网页卡面";
   const cats = document.createElement("div");
   data.categories.forEach((entry, index) => {
     const row = document.createElement("div");
     row.className = "row";
     const name = document.createElement("strong");
     name.textContent = entry.name;
     const up = document.createElement("button");
     up.type = "button"; up.textContent = "上移"; up.disabled = index === 0;
     up.addEventListener("click", () => catalogSend({ action: "move-category", id: entry.id, direction: "up" }));
     const down = document.createElement("button");
     down.type = "button"; down.textContent = "下移"; down.disabled = index === data.categories.length - 1;
     down.addEventListener("click", () => catalogSend({ action: "move-category", id: entry.id, direction: "down" }));
     const remove = document.createElement("button");
     remove.type = "button"; remove.className = "no"; remove.textContent = "删除分类";
     remove.addEventListener("click", () => catalogSend({ action: "remove-category", id: entry.id }));
     row.append(name, up, down, remove);
     cats.append(row);
   });
   const add = document.createElement("form");
   add.className = "row";
   const input = document.createElement("input");
   input.placeholder = "新分类名称"; input.maxLength = 16; input.required = true;
   const submit = document.createElement("button");
   submit.className = "ok"; submit.textContent = "添加分类";
   add.append(input, submit);
   add.addEventListener("submit", (event) => { event.preventDefault(); catalogSend({ action: "add-category", name: input.value }); });
   const cards = document.createElement("div");
   data.items.forEach((item) => {
     const row = document.createElement("div");
     row.className = "row";
     const name = document.createElement("span");
     name.textContent = item.name;
     const category = document.createElement("select");
     data.categories.forEach((entry) => category.append(Object.assign(document.createElement("option"), { value: entry.id, textContent: entry.name })));
     category.value = data.categories.some((entry) => entry.id === item.category) ? item.category : data.categories[0].id;
     category.addEventListener("change", () => catalogSend({ action: "move-face", id: item.id, category: category.value }));
     const remove = document.createElement("button");
     remove.type = "button"; remove.className = "no"; remove.textContent = "从网页删除";
     remove.addEventListener("click", () => catalogSend({ action: "hide-face", id: item.id }));
     row.append(name, category, remove);
     cards.append(row);
   });
   if (!data.items.length) cards.textContent = "网页上还没有已通过的卡面";
   box.append(title, cats, add, cards);
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
 load().then(loadCatalog);
</script>`;
