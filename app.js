const card = document.querySelector("#card");
const base = document.querySelector("#base");
const reference = document.querySelector("#reference");
const baseCtx = base.getContext("2d");
const refCtx = reference.getContext("2d");
const layers = document.querySelector("#layers");

const CARD_W = 1536;
const CARD_H = 969;
const RADIUS = Math.round((3.18 / 85.6) * CARD_W);

const dictionaries = {
  zh: {
    styles: { flat: "直角", "flat-rounded": "圆角", logo: "标志", "logo-border": "描边", mono: "单色", "mono-outline": "线框" },
    brands: { visa: "Visa", mastercard: "万事达", amex: "美国运通", unionpay: "银联", jcb: "JCB", discover: "Discover", diners: "大来", alipay: "支付宝", paypal: "PayPal", maestro: "Maestro", elo: "Elo", mir: "Mir", generic: "通用卡" },
    payments: { applePay: "Apple Pay", googlePay: "Google Pay", weChatPay: "微信支付", visa: "Visa", mastercard: "万事达", amex: "美国运通", unionPay: "银联", alipay: "支付宝", payPal: "PayPal", jcb: "JCB", discover: "Discover", klarna: "Klarna" },
    groups: { official: "卡组织素材", payment: "支付方式" },
    locked: "已锁定",
    logoReady: "可多选，支持 SVG、PNG、JPG、WebP",
    logoNeed: "请先上传卡面图片",
    none: "暂无 logo",
  },
  en: {
    styles: { flat: "Flat", "flat-rounded": "Rounded", logo: "Logo", "logo-border": "Border", mono: "Mono", "mono-outline": "Outline" },
    brands: { visa: "Visa", mastercard: "Mastercard", amex: "American Express", unionpay: "UnionPay", jcb: "JCB", discover: "Discover", diners: "Diners", alipay: "Alipay", paypal: "PayPal", maestro: "Maestro", elo: "Elo", mir: "Mir", generic: "Generic" },
    payments: { applePay: "Apple Pay", googlePay: "Google Pay", weChatPay: "WeChat Pay", visa: "Visa", mastercard: "Mastercard", amex: "Amex", unionPay: "UnionPay", alipay: "Alipay", payPal: "PayPal", jcb: "JCB", discover: "Discover", klarna: "Klarna" },
    groups: { official: "Brand assets", payment: "Payments" },
    locked: "Locked",
    logoReady: "Multiple files: SVG, PNG, JPG, WebP",
    logoNeed: "Upload a card image first",
    none: "No logos yet",
  },
};
const uiText = {
  zh: { title: "卡面设计生成器", theme: "深色", themeLight: "浅色", github: "GitHub 项目", preview: "卡面预览", export: "导出 PNG", emptyTitle: "上传一张图片作为卡面", emptyText: "图片会按 1.586 : 1 铺满并居中，之后可以缩放和拖动调整构图。", choose: "选择图片", rounded: "按 3.18 mm 圆角呈现（导出同步）", dragCard: "拖动卡面", dragRef: "拖动参考图", clear: "清空", uploadLogo: "上传自己的 logo", requestLogo: "提交 logo", cardImage: "卡面图片", dropCard: "拖拽图片到此处，或点击选择", refit: "重新匹配", zoom: "缩放", cardNote: "图片会等比缩放并居中填满卡面，超出部分自动裁掉。", reference: "参考图", dropRef: "拖拽参考图到此处，或点击选择", refHint: "只用于对位，不会出现在导出的 PNG 里", showRef: "显示参考图", opacity: "透明度", adjust: "调整", selectLogo: "点击卡面上的 logo 进行编辑", size: "大小", rotate: "旋转", lock: "锁定", up: "上移", down: "下移", delete: "删除", layers: "图层", noLogo: "暂无 logo", legal: "输出只是视觉设计文件，不代表任何机构发行的卡片。图标来自公开素材库，使用前请确认你有相应授权。" },
  en: { title: "Card Design Generator", theme: "Dark", themeLight: "Light", github: "GitHub project", preview: "Card preview", export: "Export PNG", emptyTitle: "Upload an image for the card", emptyText: "The image fills the 1.586:1 card and can then be zoomed and dragged.", choose: "Choose image", rounded: "Show 3.18 mm rounded corners (also exported)", dragCard: "Move card", dragRef: "Move reference", clear: "Clear", uploadLogo: "Upload your own logos", requestLogo: "Submit a logo", cardImage: "Card image", dropCard: "Drop an image here, or click to choose", refit: "Refit", zoom: "Zoom", cardNote: "The image is scaled and centered to fill the card. Overflow is cropped.", reference: "Reference", dropRef: "Drop a reference here, or click to choose", refHint: "Used for alignment only. It is not included in the PNG.", showRef: "Show reference", opacity: "Opacity", adjust: "Adjust", selectLogo: "Click a logo on the card to edit it", size: "Size", rotate: "Rotate", lock: "Lock", up: "Up", down: "Down", delete: "Delete", layers: "Layers", noLogo: "No logos yet", legal: "The output is a visual design file only. Logos come from public asset libraries; confirm permission before publishing." },
};
let language = localStorage.getItem("card-lang") || "zh";
const copy = () => dictionaries[language];

function buildGroups() {
  const text = copy();
  return [
    ...Object.entries(text.brands).filter(([id]) => id !== "generic").map(([id, name]) => ({
      id, name,
      marks: Object.entries(text.styles).map(([style, label]) => ({ id: `${id}-${style}`, name: label, src: `assets/icons/${style}/${id}.svg`, width: style.startsWith("logo") ? 92 : 132 })),
    })),
    { id: "official", name: text.groups.official, marks: [
      { id: "official-visa", name: "Visa", src: "assets/visa.png", width: 180 },
      { id: "official-mastercard", name: text.brands.mastercard, src: "assets/mastercard.svg", width: 112 },
      { id: "official-amex", name: text.brands.amex, src: "assets/amex.png", width: 124 },
      { id: "official-amex-square", name: text.brands.amex, src: "assets/amex-square.png", width: 112 },
      { id: "official-up", name: text.brands.unionpay, src: "assets/unionpay-horizontal.png", width: 124 },
      { id: "official-up-white", name: text.brands.unionpay, src: "assets/unionpay-horizontal-white.png", width: 124 },
    ] },
    { id: "payment", name: text.groups.payment, marks: Object.entries(text.payments).map(([id, name]) => ({ id: `pay-${id}`, name, src: `assets/icons/payment/${id}.svg`, width: 132 })) },
  ];
}
let groups = buildGroups();
let marks = Object.fromEntries(groups.flatMap((group) => group.marks.map((mark) => [mark.id, mark])));

let cardImage = null;
let cardView = { scale: 1, x: 0.5, y: 0.5 };
let refImage = null;
let refView = { scale: 1, x: 0.5, y: 0.5 };
let refOpacity = 0.45;
let refVisible = true;
let rounded = true;
let dragMode = "card";
let items = [];
let selected = null;
let drag = null;
let activeGroup = groups[0].id;
let seq = 1;
const imageCache = {};

function roundedPath(context, width, height, radius) {
  context.beginPath();
  context.moveTo(radius, 0);
  context.arcTo(width, 0, width, height, radius);
  context.arcTo(width, height, 0, height, radius);
  context.arcTo(0, height, 0, 0, radius);
  context.arcTo(0, 0, width, 0, radius);
  context.closePath();
}

function paintImage(context, image, view) {
  context.clearRect(0, 0, CARD_W, CARD_H);
  if (!image) return;
  context.save();
  if (rounded) {
    roundedPath(context, CARD_W, CARD_H, RADIUS);
    context.clip();
  }
  const cover = Math.max(CARD_W / image.width, CARD_H / image.height) * view.scale;
  const dw = image.width * cover;
  const dh = image.height * cover;
  context.drawImage(image, (CARD_W - dw) * view.x, (CARD_H - dh) * view.y, dw, dh);
  context.restore();
}

function paint() {
  card.classList.toggle("round", rounded);
  paintImage(baseCtx, cardImage, cardView);
  reference.style.opacity = refVisible ? refOpacity : 0;
  paintImage(refCtx, refImage, refView);
  document.querySelector("#empty").hidden = Boolean(cardImage);
  document.querySelector("#ref-controls").hidden = !refImage;
}

function renderTabs() {
  const box = document.querySelector("#tabs");
  box.replaceChildren();
  groups.forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab" + (group.id === activeGroup ? " active" : "");
    button.textContent = group.name;
    button.addEventListener("click", () => { activeGroup = group.id; renderTabs(); renderLibrary(); });
    box.appendChild(button);
  });
}

function renderLibrary() {
  const box = document.querySelector("#library");
  const group = groups.find((entry) => entry.id === activeGroup);
  box.replaceChildren();
  group.marks.forEach((mark) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lib-btn";
    button.innerHTML = `<img src="${mark.src}" alt="" /><span>${mark.name}</span>`;
    button.addEventListener("click", () => addLogo({ name: `${group.name} · ${mark.name}`, src: mark.src, width: mark.width }));
    box.appendChild(button);
  });
}

function addLogo({ name, src, width }) {
  if (!cardImage) { remindCardFirst(); return; }
  const item = { id: seq++, name, src, x: 78, y: 78 - (items.length % 4) * 14, width, rotate: 0, opacity: 1, locked: false };
  items.push(item);
  selected = item.id;
  renderLogos();
}
function renderLogos() {
  layers.replaceChildren();
  items.forEach((item) => {
    const node = document.createElement("div");
    node.className = "badge" + (item.id === selected ? " selected" : "") + (item.locked ? " locked" : "");
    node.style.left = item.x + "%";
    node.style.top = item.y + "%";
    node.style.width = item.width + "px";
    node.style.opacity = item.opacity;
    node.style.transform = `translate(-50%, -50%) rotate(${item.rotate}deg)`;
    const image = document.createElement("img");
    image.src = item.src;
    image.alt = item.name;
    image.draggable = false;
    node.append(image);
    node.addEventListener("pointerdown", (event) => startLogoDrag(event, item));
    if (item.id === selected) node.append(makeLock(item));
    if (item.id === selected && !item.locked) node.append(makeHandle("scale", item), makeHandle("rotate", item));
    layers.appendChild(node);
  });
  renderLayers();
  syncEditor();
  document.querySelector("#logo-count").textContent = items.length;
  document.querySelector("#layer-count").textContent = items.length;
}

function renderLayers() {
  const box = document.querySelector("#layer-list");
  if (!items.length) {
    box.innerHTML = `<p class="muted">${copy().none}</p>`;
    return;
  }
  box.replaceChildren();
  [...items].reverse().forEach((item) => {
    const button = document.createElement("button");
    button.className = "layer" + (item.id === selected ? " active" : "");
    button.textContent = item.name + (item.locked ? ` · ${copy().locked}` : "");
    button.addEventListener("click", () => { selected = item.id; renderLogos(); });
  });
}

function current() { return items.find((item) => item.id === selected) || null; }

function makeLock(item) {
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "handle lock";
  handle.setAttribute("aria-label", copy().locked);
  handle.innerHTML = item.locked
    ? `<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>`
    : `<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  handle.addEventListener("pointerdown", (event) => event.stopPropagation());
  handle.addEventListener("click", (event) => {
    event.stopPropagation();
    item.locked = !item.locked;
    renderLogos();
  });
  return handle;
}

function makeHandle(mode, item) {
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "handle " + mode;
  handle.addEventListener("pointerdown", (event) => startTransform(event, item, mode));
  return handle;
}

function startTransform(event, item, mode) {
  event.stopPropagation();
  if (item.locked) return;
  const rect = card.getBoundingClientRect();
  const centerX = rect.left + (item.x / 100) * rect.width;
  const centerY = rect.top + (item.y / 100) * rect.height;
  drag = { type: mode, id: item.id, pointerId: event.pointerId, centerX, centerY, startWidth: item.width, startDistance: Math.hypot(event.clientX - centerX, event.clientY - centerY), startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX), startRotate: item.rotate };
  card.setPointerCapture(event.pointerId);
}
function syncEditor() {
  const item = current();
  document.querySelector("#props").hidden = Boolean(item);
  document.querySelector("#editor").hidden = !item;
  if (!item) return;
  document.querySelector("#obj-name").textContent = item.name;
  document.querySelector("#scale").value = item.width;
  document.querySelector("#rotate").value = item.rotate;
  document.querySelector("#opacity").value = Math.round(item.opacity * 100);
  document.querySelector("#lock").checked = item.locked;
  document.querySelector("#editor").classList.toggle("locked", item.locked);
}

function startLogoDrag(event, item) {
  event.stopPropagation();
  selected = item.id;
  if (item.locked) {
    renderLogos();
    return;
  }
  const rect = card.getBoundingClientRect();
  drag = { type: "logo", id: item.id, pointerId: event.pointerId, dx: event.clientX - rect.left - (item.x / 100) * rect.width, dy: event.clientY - rect.top - (item.y / 100) * rect.height };
  card.setPointerCapture(event.pointerId);
  renderLogos();
}

card.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".badge")) return;
  const image = dragMode === "reference" ? refImage : cardImage;
  if (!image) return;
  const view = dragMode === "reference" ? refView : cardView;
  drag = { type: dragMode, pointerId: event.pointerId, x: view.x, y: view.y, clientX: event.clientX, clientY: event.clientY };
  card.setPointerCapture(event.pointerId);
});

card.addEventListener("pointermove", (event) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const rect = card.getBoundingClientRect();
  const item = items.find((entry) => entry.id === drag.id);
  if (drag.type === "scale" || drag.type === "rotate") {
    if (drag.type === "scale") {
      const distance = Math.hypot(event.clientX - drag.centerX, event.clientY - drag.centerY);
      item.width = clamp(drag.startWidth * (distance / Math.max(drag.startDistance, 1)), 36, 520);
    } else {
      const angle = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX);
      item.rotate = Math.round(drag.startRotate + ((angle - drag.startAngle) * 180) / Math.PI);
    }
    const node = layers.querySelector(".badge.selected");
    node.style.width = item.width + "px";
    node.style.transform = `translate(-50%, -50%) rotate(${item.rotate}deg)`;
    syncEditor();
    return;
  }
  if (drag.type === "logo") {
    item.x = clamp(((event.clientX - rect.left - drag.dx) / rect.width) * 100, 2, 98);
    item.y = clamp(((event.clientY - rect.top - drag.dy) / rect.height) * 100, 3, 97);
    const node = layers.children[items.indexOf(item)];
    if (node) { node.style.left = item.x + "%"; node.style.top = item.y + "%"; }
    return;
  }
  const image = drag.type === "reference" ? refImage : cardImage;
  const view = drag.type === "reference" ? refView : cardView;
  pan(view, image, event);
  paint();
});

function pan(view, image, event) {
  const rect = card.getBoundingClientRect();
  const cover = Math.max(CARD_W / image.width, CARD_H / image.height) * view.scale;
  const extraX = image.width * cover - CARD_W;
  const extraY = image.height * cover - CARD_H;
  if (extraX > 0) view.x = clamp(drag.x - ((event.clientX - drag.clientX) / rect.width) * (CARD_W / extraX), 0, 1);
  if (extraY > 0) view.y = clamp(drag.y - ((event.clientY - drag.clientY) / rect.height) * (CARD_H / extraY), 0, 1);
}

function endDrag(event) { if (drag && (!event.pointerId || event.pointerId === drag.pointerId)) drag = null; }
card.addEventListener("pointerup", endDrag);
card.addEventListener("pointercancel", endDrag);

document.querySelector("#modes").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  dragMode = button.dataset.mode;
  document.querySelectorAll("#modes button").forEach((node) => node.classList.toggle("active", node === button));
});

document.querySelector("#rounded").addEventListener("change", (event) => { rounded = event.target.checked; paint(); });
document.querySelector("#card-scale").addEventListener("input", (event) => { cardView.scale = Number(event.target.value) / 100; paint(); });
document.querySelector("#fit-card").addEventListener("click", () => { cardView = { scale: 1, x: 0.5, y: 0.5 }; document.querySelector("#card-scale").value = 100; paint(); });
document.querySelector("#fit-ref").addEventListener("click", () => { refView = { scale: 1, x: 0.5, y: 0.5 }; paint(); });
document.querySelector("#ref-show").addEventListener("change", (event) => { refVisible = event.target.checked; paint(); });
document.querySelector("#ref-opacity").addEventListener("input", (event) => { refOpacity = Number(event.target.value) / 100; paint(); });

function bindRange(id, apply) {
  document.querySelector(id).addEventListener("input", (event) => {
    const item = current();
    if (!item || item.locked) return;
    apply(item, event.target.value);
    const node = layers.children[items.indexOf(item)];
    if (!node) return;
    node.style.width = item.width + "px";
    node.style.opacity = item.opacity;
    node.style.transform = `translate(-50%, -50%) rotate(${item.rotate}deg)`;
  });
}
bindRange("#scale", (item, value) => { item.width = Number(value); });
bindRange("#rotate", (item, value) => { item.rotate = Number(value); });
bindRange("#opacity", (item, value) => { item.opacity = Number(value) / 100; });

document.querySelector("#remove").addEventListener("click", () => {
  items = items.filter((item) => item.id !== selected);
  selected = items.at(-1)?.id ?? null;
  renderLogos();
});
document.querySelector("#layer-up").addEventListener("click", () => moveLayer(1));
document.querySelector("#layer-down").addEventListener("click", () => moveLayer(-1));

function moveLayer(direction) {
  const index = items.findIndex((item) => item.id === selected);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= items.length) return;
  const [item] = items.splice(index, 1);
  items.splice(next, 0, item);
  renderLogos();
}

function readFile(file) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = URL.createObjectURL(file);
  });
}
document.querySelector("#photo").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  cardImage = await readFile(file);
  cardView = { scale: 1, x: 0.5, y: 0.5 };
  document.querySelector("#card-scale").value = 100;
  paint();
  syncLogoAvailability();
});
document.querySelector("#pick-empty").addEventListener("click", () => document.querySelector("#photo").click());
document.querySelector("#ref-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  refImage = await readFile(file);
  refView = { scale: 1, x: 0.5, y: 0.5 };
  refVisible = true;
  paint();
});
document.querySelector("#logo-file").addEventListener("change", (event) => {
  [...event.target.files].forEach((file) => addLogo({ name: file.name.replace(/\.[^.]+$/, ""), src: URL.createObjectURL(file), width: 150 }));
});

["#photo", "#ref-file", "#logo-file"].forEach((selector) => {
  const input = document.querySelector(selector);
  const zone = input.parentElement;
  ["dragover", "dragenter"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.style.borderColor = "var(--teal)"; }));
  zone.addEventListener("dragleave", () => { zone.style.borderColor = ""; });
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.style.borderColor = "";
    if (input.disabled) return;
    input.files = event.dataTransfer.files;
    input.dispatchEvent(new Event("change"));
  });
});

document.querySelector("#clear").addEventListener("click", () => {
  cardImage = null; refImage = null; items = []; selected = null;
  cardView = { scale: 1, x: 0.5, y: 0.5 }; refView = { scale: 1, x: 0.5, y: 0.5 };
  paint(); renderLogos(); syncLogoAvailability();
});

document.querySelector("#export").addEventListener("click", async () => {
  const out = document.createElement("canvas");
  out.width = CARD_W; out.height = CARD_H;
  const context = out.getContext("2d");
  context.drawImage(base, 0, 0);
  for (const item of items) {
    const image = await loadImage(item.src);
    const width = (item.width / card.clientWidth) * CARD_W;
    const height = width * (image.height / image.width);
    context.save();
    context.translate((item.x / 100) * CARD_W, (item.y / 100) * CARD_H);
    context.rotate((item.rotate * Math.PI) / 180);
    context.globalAlpha = item.opacity;
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.restore();
  }
  const link = document.createElement("a");
  link.download = "card-face.png";
  link.href = out.toDataURL("image/png");
  link.click();
});

function loadImage(src) {
  if (imageCache[src]) return Promise.resolve(imageCache[src]);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { imageCache[src] = image; resolve(image); };
    image.onerror = reject;
    image.src = src;
  });
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

let toastTimer = 0;
function remindCardFirst() {
  const toast = document.querySelector("#toast");
  const drop = document.querySelector("#photo").parentElement;
  toast.textContent = copy().logoNeed;
  toast.hidden = false;
  drop.classList.remove("pulse");
  void drop.offsetWidth;
  drop.classList.add("pulse");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; drop.classList.remove("pulse"); }, 2200);
}

function syncLogoAvailability() {
  const panel = document.querySelector(".logo-panel");
  const input = document.querySelector("#logo-file");
  panel.classList.toggle("disabled", !cardImage);
  input.disabled = !cardImage;
  document.querySelector("#logo-hint").textContent = cardImage ? copy().logoReady : copy().logoNeed;
}

document.querySelector("#lock").addEventListener("change", (event) => {
  const item = current();
  if (!item) return;
  item.locked = event.target.checked;
  renderLogos();
});

function applyLanguage() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = uiText[language].title;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = uiText[language][node.dataset.i18n];
  });
  document.querySelector("#lang-toggle").textContent = language === "zh" ? "EN" : "中";
  const requestTitle = language === "zh" ? "提交 logo" : "Submit a logo";
  const requestBody = language === "zh" ? "银行卡：\n\n请附上 SVG 或 PNG。\n" : "Card:\n\nPlease attach an SVG or PNG.\n";
  document.querySelector("#request-logo").href = `https://github.com/youmikk/card-face/issues/new?title=${encodeURIComponent(requestTitle)}&body=${encodeURIComponent(requestBody)}`;
  groups = buildGroups();
  marks = Object.fromEntries(groups.flatMap((group) => group.marks.map((mark) => [mark.id, mark])));
  renderTabs();
  renderLibrary();
  renderLogos();
  syncLogoAvailability();
}

document.querySelector("#lang-toggle").addEventListener("click", () => {
  language = language === "zh" ? "en" : "zh";
  localStorage.setItem("card-lang", language);
  applyLanguage();
});

document.querySelector("#theme-toggle").addEventListener("click", () => {
  const dark = !document.body.classList.contains("dark");
  document.body.classList.toggle("dark", dark);
  localStorage.setItem("card-theme", dark ? "dark" : "light");
});
if (localStorage.getItem("card-theme") === "dark") document.body.classList.add("dark");
applyLanguage();
paint();
renderLogos();
