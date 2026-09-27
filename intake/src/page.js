/**
 * 审核后台页面模板。
 * 说明：这里是模板字符串文本，页面脚本里不要出现反引号，也不要出现美元符号加花括号的插值序列
 *      （两个都会被外层模板字符串吃掉）。需要拼字符串时用单引号加号拼接。
 * 结构：样式令牌 → 顶栏（区域切换 / 搜索 / 汇总 / 状态条）→ 状态页签 → 面板 → 工具 → 对话框 → 页面脚本。
 * 约定：页面脚本是经典脚本（非 module），所有请求走同源相对路径，口令放在 sessionStorage 的 review-token。
 */
export const PAGE_TEMPLATE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="robots" content="noindex, nofollow">
<title>内容审核 · 后台</title>
<style>
  /* ---------------------------------------------------------------- 令牌 */
  :root {
    /* 表面 */
    --bg: #f4f6fa;
    --bg-2: #eaedf4;
    --panel: #ffffff;
    --sunken: #f7f9fc;
    /* 描边 */
    --line: #e3e8f0;
    --line-2: #ccd5e3;
    /* 文字 */
    --ink: #151d2b;
    --ink-2: #5a6678;
    --ink-3: #8b95a6;
    /* 唯一强调色 */
    --brand: #2f5ae8;
    --brand-2: #2043bd;
    --brand-soft: #eef2fe;
    --brand-ink: #1f3272;
    /* 语义色 */
    --ok: #0f7a52;
    --ok-soft: #e9f7f1;
    --ok-line: #bfe6d7;
    --warn: #8a5a12;
    --warn-soft: #fdf5e6;
    --warn-line: #f0dfb8;
    --bad: #b23b3b;
    --bad-soft: #fdeeee;
    --bad-line: #f2cccc;
    /* 圆角（4px 节奏） */
    --r-1: 8px;
    --r-2: 10px;
    --r-3: 14px;
    --r-4: 18px;
    /* 间距（4px / 8px 节奏） */
    --sp-1: 4px;
    --sp-2: 8px;
    --sp-3: 12px;
    --sp-4: 16px;
    --sp-5: 20px;
    --sp-6: 28px;
    /* 动效：状态变化用短缓动，不用 linear */
    --fast: 120ms cubic-bezier(.2, .8, .2, 1);
    --base: 200ms cubic-bezier(.2, .8, .2, 1);
    --shadow-1: 0 1px 2px rgba(17, 24, 39, .05);
    --shadow-2: 0 1px 2px rgba(17, 24, 39, .04), 0 10px 26px rgba(17, 24, 39, .07);
  }

  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font: 13px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  }
  h1, h2, h3, p, dl, dd, ul { margin: 0; }
  h1 { font-size: 16px; font-weight: 700; letter-spacing: .01em; }
  h2 { font-size: 14px; font-weight: 650; }
  h3 { font-size: 13px; font-weight: 650; }
  ul { padding: 0; list-style: none; }
  .fs12 { font-size: 12px; }
  .muted { color: var(--ink-2); }
  .sep { color: var(--ink-3); }
  :focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  input[type="search"]::-webkit-search-cancel-button { display: none; }

  /* ---------------------------------------------------------------- 顶栏 */
  .top {
    position: sticky;
    top: 0;
    z-index: 20;
    background: rgba(255, 255, 255, .94);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .top-in { width: min(1240px, 100% - 32px); margin: 0 auto; padding: 10px 0; display: grid; gap: 10px; }
  .topline { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .brand { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .brand .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--brand); box-shadow: 0 0 0 4px var(--brand-soft); flex: none; }
  .topactions { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-wrap: wrap; }

  /* 区域切换：卡面 / Logo */
  .seg { display: inline-flex; gap: 3px; padding: 3px; border: 1px solid var(--line); border-radius: var(--r-3); background: var(--bg-2); }
  .seg button {
    display: inline-flex; align-items: center; gap: 7px;
    height: 30px; padding: 0 14px;
    border: 0; border-radius: 9px; background: transparent;
    color: var(--ink-2); font: inherit; font-weight: 600; cursor: pointer;
    transition: background var(--fast), color var(--fast), box-shadow var(--fast);
  }
  .seg button:hover { color: var(--ink); }
  .seg button[aria-selected="true"] { background: var(--panel); color: var(--brand-ink); box-shadow: var(--shadow-1); }
  .seg .pill {
    min-width: 19px; height: 18px; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center;
    border-radius: 999px; background: var(--panel); color: var(--ink-2); font-size: 12px; font-weight: 650;
  }
  .seg button[aria-selected="true"] .pill { background: var(--brand); color: #fff; }

  /* 搜索 */
  .search { position: relative; display: flex; align-items: center; }
  .search input {
    width: min(280px, 44vw); height: 32px; padding: 0 28px 0 10px;
    border: 1px solid var(--line-2); border-radius: var(--r-2); background: var(--panel);
    font: inherit; color: inherit;
    transition: border-color var(--fast), box-shadow var(--fast);
  }
  .search input:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
  .search .clear {
    position: absolute; right: 3px; width: 24px; height: 24px; padding: 0;
    border: 0; border-radius: 50%; background: transparent; color: var(--ink-3);
    font: inherit; font-size: 15px; line-height: 1; cursor: pointer;
    transition: background var(--fast), color var(--fast);
  }
  .search .clear:hover { background: var(--bg-2); color: var(--ink); }

  /* 汇总 */
  .summary { display: flex; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--ink-2); }
  .sumchip {
    display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px;
    border: 1px solid var(--line); border-radius: 999px; background: var(--sunken);
  }
  .sumchip b { font-weight: 650; color: var(--ink); }
  .sumchip.on { border-color: #c9d5fb; background: var(--brand-soft); color: var(--brand-ink); }
  .sumchip.on b { color: var(--brand-ink); }

  /* 状态条 */
  .notice { padding: 8px 12px; border: 1px solid transparent; border-radius: var(--r-2); font-size: 12.5px; }
  .notice.info { background: var(--brand-soft); border-color: #d5ddfb; color: var(--brand-ink); }
  .notice.ok { background: var(--ok-soft); border-color: var(--ok-line); color: var(--ok); }
  .notice.warn { background: var(--warn-soft); border-color: var(--warn-line); color: var(--warn); }
  .notice.bad { background: var(--bad-soft); border-color: var(--bad-line); color: var(--bad); }

  /* 顶部加载条（比转圈更不打断视线） */
  .progress { position: fixed; left: 0; right: 0; top: 0; height: 2px; z-index: 60; overflow: hidden; }
  .progress::after {
    content: ""; position: absolute; top: 0; left: -40%; width: 40%; height: 100%;
    background: var(--brand); border-radius: 2px;
    animation: sweep 1.1s ease-in-out infinite;
  }
  @keyframes sweep { from { transform: translateX(0); } to { transform: translateX(350%); } }

  /* ---------------------------------------------------------------- 主体 */
  main { width: min(1240px, 100% - 32px); margin: 16px auto 64px; display: grid; gap: 14px; }

  .subtabs { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; border-bottom: 1px solid var(--line); }
  .subtab {
    display: inline-flex; align-items: center; gap: 7px;
    height: 36px; padding: 0 12px;
    border: 0; border-bottom: 2px solid transparent; border-radius: var(--r-1) var(--r-1) 0 0;
    background: transparent; color: var(--ink-2); font: inherit; font-weight: 600; cursor: pointer;
    transition: color var(--fast), background var(--fast), border-color var(--fast);
  }
  .subtab:hover { color: var(--ink); background: var(--sunken); }
  .subtab[aria-selected="true"] { color: var(--brand-ink); border-bottom-color: var(--brand); }
  .badge {
    min-width: 20px; height: 18px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: center;
    border-radius: 999px; background: var(--bg-2); color: var(--ink-2); font-size: 12px; font-weight: 650;
  }
  .subtab[aria-selected="true"] .badge { background: var(--brand-soft); color: var(--brand-ink); }
  .badge.hot { background: var(--warn-soft); color: var(--warn); }

  .panel { min-height: 180px; }
  .panel-head { display: grid; gap: 6px; margin-bottom: 12px; }
  .panel-hint { font-size: 12.5px; color: var(--ink-2); max-width: 78ch; }
  .panel-note {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    margin-bottom: 12px; padding: 8px 12px; border: 1px solid var(--line); border-radius: var(--r-2);
    background: var(--panel); font-size: 12.5px; color: var(--ink-2);
  }

  /* 卡片网格：min() 兜住窄屏，避免出现横向滚动 */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(330px, 100%), 1fr)); gap: 14px; align-items: start; }
  .usage-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 2px; color: var(--ink-2); }
  .usage-row .fs12 { overflow-wrap: anywhere; }
  .grid[data-anim="1"] > .card { animation: rise var(--base) both; animation-delay: calc(var(--i, 0) * 22ms); }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .skel {
    height: 232px; border: 1px solid var(--line); border-radius: var(--r-3);
    background: linear-gradient(90deg, var(--sunken), #eef2f8, var(--sunken));
    background-size: 200% 100%; animation: shimmer 1.5s ease-in-out infinite;
  }
  @keyframes shimmer { from { background-position: 0% 0; } to { background-position: 200% 0; } }
  .more { display: flex; justify-content: center; margin-top: 16px; }

  /* ---------------------------------------------------------------- 条目卡 */
  .card {
    /* 缩略图在左（固定小格）、文字在右：图片再大也不会把名称/元数据/字段挤出视野 */
    display: grid; grid-template-columns: 156px minmax(0, 1fr); align-items: stretch;
    grid-template-areas: "frame body" "actions actions";
    border: 1px solid var(--line); border-radius: var(--r-3); background: var(--panel);
    box-shadow: var(--shadow-1); overflow: hidden;
    transition: border-color var(--fast), box-shadow var(--fast);
  }
  .card:hover { border-color: var(--line-2); box-shadow: var(--shadow-2); }
  /* 已隐藏：虚线框 + 去饱和，一眼能和待审/已通过分开 */
  .card[data-status="hidden"] { border-style: dashed; background: #fbfcfe; }
  .card[data-status="hidden"] .frame img { filter: saturate(.45); }
  .frame {
    /* 固定高度 + 裁剪：图片只用 max-* 约束，绝不会按原始尺寸溢出遮挡名称/按钮 */
    position: relative; height: 168px; overflow: hidden; grid-area: frame;
    display: grid; place-items: center; padding: 6px;
    background: #f1f4f9; border-right: 1px solid var(--line);
  }
  .frame img { display: block; width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain; object-position: center; }
  .frame[data-state="loading"] { animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .6; } }
  .frame[data-state="missing"] { background: #fbfaf7; }
  .frame[data-state="missing"] img { display: none; }
  .ph { display: none; align-items: center; gap: 6px; padding: 6px 12px; border: 1px dashed var(--line-2); border-radius: var(--r-2); color: var(--ink-3); font-size: 12px; }
  .frame[data-state="missing"] .ph-missing { display: inline-flex; }
  .chips { position: absolute; left: 6px; top: 6px; right: 6px; display: flex; gap: 4px; flex-wrap: wrap; }
  .chip {
    border-radius: 999px; font-size: 12px; font-weight: 600;
    background: rgba(255, 255, 255, .93); color: var(--ink-2); box-shadow: inset 0 0 0 1px var(--line);
  }
  .chip.pending { color: var(--warn); box-shadow: inset 0 0 0 1px var(--warn-line); }
  .card-body { grid-area: body; padding: 12px 12px 6px; display: grid; gap: 10px; min-width: 0; }
  .card-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; min-width: 0; }

  .card-id { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--ink-3); flex: none; }

  .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(126px, 100%), 1fr)); gap: 3px 10px; font-size: 12px; }
  .meta > div { display: flex; gap: 6px; min-width: 0; }
  .meta dt { flex: none; color: var(--ink-3); }
  .meta dd { margin: 0; min-width: 0; color: var(--ink-2); overflow-wrap: anywhere; }
  .meta dd.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: 8px; }
  .field { display: grid; gap: 4px; font-size: 12px; }
  .field > span { font-weight: 600; color: var(--ink-2); }
  .field input, .field select {
    width: 100%; height: 32px; padding: 0 8px;
    border: 1px solid var(--line-2); border-radius: var(--r-1); background: var(--panel);
    font: inherit; color: inherit;
    transition: border-color var(--fast), box-shadow var(--fast);
  }
  .field input:focus, .field select:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
  .field-hint { font-size: 12px; color: var(--brand-ink); }

  /* 同图 */
  .dupes { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--warn-line); border-radius: var(--r-2); background: var(--warn-soft); }
  .dupes-head { font-size: 12.5px; font-weight: 650; color: var(--warn); }
  .dupe-list { display: grid; gap: 3px; font-size: 12px; color: #7a5a12; }
  .dupe-list li { display: flex; gap: 6px; min-width: 0; }
  .dupe-list li span:first-child { overflow-wrap: anywhere; }
  .dupes-actions { display: flex; flex-wrap: wrap; gap: 6px; }

  /* 动作按钮始终挨在一起：不把「彻底删除」单独推到最右（卡片改成左缩略图后正文变窄，会被挤到下一行） */
  /* 动作行横跨整卡：按钮不会被缩窄的正文列挤到下一行 */
  .actions { grid-area: actions; padding: 0 12px 12px; display: flex; flex-wrap: wrap; gap: 8px; }
  .actions .push { margin-left: 0; }

  /* ---------------------------------------------------------------- 按钮 */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    height: 32px; padding: 0 12px;
    border: 1px solid var(--line-2); border-radius: var(--r-1); background: var(--panel);
    color: var(--ink); font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap;
    transition: background var(--fast), border-color var(--fast), color var(--fast), transform 90ms ease-out;
  }
  .btn:hover { background: var(--sunken); }
  .btn:active { transform: translateY(1px); }
  .btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
  .btn.primary { background: var(--brand); border-color: var(--brand); color: #fff; }
  .btn.primary:hover { background: var(--brand-2); border-color: var(--brand-2); }
  .btn.danger { background: var(--panel); border-color: var(--bad-line); color: var(--bad); }
  .btn.danger:hover { background: var(--bad-soft); }
  .btn.ghost { background: transparent; border-color: transparent; color: var(--ink-2); }
  .btn.ghost:hover { background: var(--bg-2); color: var(--ink); }
  .btn.tiny { height: 26px; padding: 0 8px; font-size: 12px; border-radius: var(--r-1); }

  /* ---------------------------------------------------------------- 分类侧栏 */
  .split { display: grid; grid-template-columns: minmax(220px, 268px) 1fr; gap: 16px; align-items: start; }
  .list { min-width: 0; display: grid; }
  .rail {
    position: sticky; top: 112px; display: grid; gap: 8px;
    padding: 10px; border: 1px solid var(--line); border-radius: var(--r-3);
    background: var(--panel); box-shadow: var(--shadow-1);
  }
  .rail-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .cats { display: grid; gap: 6px; max-height: min(56vh, 560px); overflow: auto; overscroll-behavior: contain; }
  .cat { border: 1px solid var(--line); border-radius: var(--r-2); background: var(--sunken); overflow: hidden; transition: border-color var(--fast), background var(--fast); }
  .cat.on { border-color: #c9d5fb; background: var(--brand-soft); }
  .cat-main { display: flex; align-items: center; gap: 4px; padding: 4px; }
  .cat-open {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px;
    height: 30px; padding: 0 8px; border: 0; border-radius: var(--r-1); background: transparent;
    color: var(--ink); font: inherit; font-weight: 600; text-align: left; cursor: pointer;
    transition: background var(--fast), color var(--fast);
  }
  .cat-open:hover { background: rgba(255, 255, 255, .75); }
  .cat.on .cat-open { color: var(--brand-ink); }
  .cat-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .cat-role { flex: none; padding: 0 6px; border-radius: 999px; background: var(--panel); color: var(--ink-2); font-size: 12px; font-weight: 500; box-shadow: inset 0 0 0 1px var(--line); }
  .cat-toggle {
    flex: none; width: 28px; height: 28px; padding: 0;
    border: 1px solid transparent; border-radius: var(--r-1); background: transparent;
    color: var(--ink-3); font: inherit; font-size: 15px; line-height: 1; cursor: pointer;
    transition: background var(--fast), color var(--fast), border-color var(--fast);
  }
  .cat-toggle:hover { background: var(--panel); border-color: var(--line); color: var(--ink); }
  .cat-tools { display: grid; gap: 8px; padding: 8px; border-top: 1px solid var(--line); background: var(--panel); }
  .role-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-2); }
  .role-row select { flex: 1; min-width: 0; height: 28px; padding: 0 6px; border: 1px solid var(--line-2); border-radius: var(--r-1); background: var(--panel); font: inherit; font-size: 12px; }
  .cat-btns { display: flex; flex-wrap: wrap; gap: 4px; }
  .addcat { display: grid; gap: 6px; padding-top: 10px; border-top: 1px dashed var(--line-2); }
  .addcat-row { display: flex; gap: 6px; }
  .addcat input, .addcat select {
    height: 30px; border: 1px solid var(--line-2); border-radius: var(--r-1); background: var(--panel);
    font: inherit; font-size: 12.5px; color: inherit;
  }
  .addcat input { flex: 1; min-width: 0; padding: 0 8px; }
  .addcat select { max-width: 96px; padding: 0 4px; }
  .addcat input:focus, .addcat select:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }

  /* ---------------------------------------------------------------- 空态 / 工具 */
  .empty {
    display: grid; gap: 8px; justify-items: start;
    padding: 24px 20px; border: 1px dashed var(--line-2); border-radius: var(--r-3); background: var(--sunken);
    color: var(--ink-2);
  }
  .empty h2 { color: var(--ink); }
  .empty p { font-size: 12.5px; max-width: 62ch; }
  .empty .actions { margin-top: 4px; }

  .tools { border: 1px solid var(--line); border-radius: var(--r-3); background: var(--panel); box-shadow: var(--shadow-1); }
  .tools > summary {
    padding: 10px 14px; border-radius: var(--r-3); cursor: pointer; font-weight: 600; color: var(--ink-2);
    list-style: none; transition: color var(--fast), background var(--fast);
  }
  .tools > summary::-webkit-details-marker { display: none; }
  .tools > summary::before { content: "▸"; display: inline-block; width: 14px; color: var(--ink-3); }
  .tools[open] > summary::before { content: "▾"; }
  .tools > summary:hover { color: var(--ink); background: var(--sunken); }
  .tools-body { display: grid; gap: 10px; padding: 0 14px 14px; }

  /* ---------------------------------------------------------------- 对话框 */
  .dlg {
    width: min(440px, calc(100vw - 28px)); max-height: calc(100vh - 40px); overflow: auto;
    padding: 0; border: 0; border-radius: var(--r-4); background: var(--panel); color: var(--ink);
    box-shadow: 0 24px 60px rgba(17, 24, 39, .3);
  }
  .dlg::backdrop { background: rgba(17, 24, 39, .42); }
  .dlg[open] { animation: pop var(--base) both; }
  @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(.985); } to { opacity: 1; transform: none; } }
  .dlg-in { display: grid; gap: 12px; padding: 18px; }
  .dlg-msg { display: grid; gap: 6px; font-size: 12.5px; color: var(--ink-2); }
  .dlg-error { font-size: 12.5px; color: var(--bad); }
  .dlg-foot { display: flex; justify-content: flex-end; gap: 8px; }

  /* ---------------------------------------------------------------- 移动端 */
  @media (max-width: 1080px) {
    .split { grid-template-columns: 1fr; }
    .rail { position: static; }
    .cats { max-height: none; }
  }
  @media (max-width: 700px) {
    .top-in, main { width: calc(100% - 20px); }
    .topline { gap: 10px; }
    .search { flex: 1; min-width: 170px; }
    .search input { width: 100%; }
    .card { grid-template-columns: 1fr; grid-template-areas: "frame" "body" "actions"; }
    .grid { grid-template-columns: 1fr; }
    .frame { height: 140px; min-height: 0; max-height: none; border-right: 0; border-bottom: 1px solid var(--line); }
    .card-body { padding: 10px; }
    .actions { gap: 6px; }
    .actions .push { margin-left: 0; }
    .actions .btn { flex: 1 1 auto; }
    .field input, .field select, .btn { height: 36px; }
    .btn.tiny { height: 30px; }
    .subtabs { gap: 2px; }
    .subtab { padding: 0 9px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
    .progress::after { animation: none; left: 0; width: 100%; opacity: .5; }
    .grid[data-anim="1"] > .card { animation: none; }
  }
</style>
</head>
<body>
<header class="top">
  <div class="top-in">
    <div class="topline">
      <div class="brand"><span class="dot" aria-hidden="true"></span><h1>内容审核</h1></div>
      <div class="seg" role="tablist" aria-label="内容区域（卡面 / Logo）" id="kind-tabs"></div>
      <div class="topactions">
        <div class="search">
          <input id="search" type="search" placeholder="搜索名称 / 备注 / 银行 / ID" aria-label="搜索（按斜杠键聚焦）" autocomplete="off">
          <button type="button" class="clear" id="search-clear" aria-label="清除搜索" hidden>×</button>
        </div>
        <button type="button" class="btn ghost" id="change-password">修改口令</button>
      </div>
    </div>
    <div class="summary" id="summary"></div>
    <p class="notice" id="notice" role="status" aria-live="polite" hidden></p>
  </div>
</header>

<main>
  <div class="subtabs" role="tablist" aria-label="审核状态" id="tab-tabs"></div>
  <section class="panel" id="panel" role="tabpanel" tabindex="-1"></section>
  <div class="usage-row">
    <span class="fs12" id="usage-line">R2 存储：读取中…</span>
    <button type="button" class="btn tiny" id="usage-refresh">刷新用量</button>
  </div>

  <details class="tools">
    <summary>工具</summary>
    <div class="tools-body">
      <p class="fs12 muted">只在数据需要修复时使用，日常审核不需要这两个按钮。</p>
      <div class="actions">
        <button type="button" class="btn" id="tool-restore">找回内置分类</button>
        <button type="button" class="btn" id="tool-fix-kinds">修正历史类型</button>
      </div>
    </div>
  </details>
</main>

<datalist id="bank-names"></datalist>

<dialog class="dlg" id="dlg" aria-labelledby="dlg-title">
  <div class="dlg-in">
    <h2 id="dlg-title">确认</h2>
    <div class="dlg-msg" id="dlg-body"></div>
    <label class="field" id="dlg-field" hidden><span id="dlg-field-label">输入</span><input id="dlg-input" type="text" autocomplete="off"></label>
    <p class="dlg-error" id="dlg-error" hidden></p>
    <div class="dlg-foot">
      <button type="button" class="btn" id="dlg-cancel">取消</button>
      <button type="button" class="btn primary" id="dlg-ok">确定</button>
    </div>
  </div>
</dialog>

<div class="progress" id="progress" hidden></div>

<script nonce="__NONCE__">
(function () {
  'use strict';

  /* ================================================================ 常量 */
  var TOKEN_KEY = 'review-token';
  var PENDING_PAGE = 60;      /* 待处理每页条数 */
  var APPROVED_PAGE = 60;     /* 已通过每页条数 */
  var SEARCH_DEBOUNCE = 300;  /* 服务端搜索防抖 */
  var STAGGER_CAP = 10;       /* 列表入场最多错开 10 级 */
  var PREVIEW_CACHE_MAX = 300;
  var DUPE_LIST_MAX = 6;      /* 同图列表最多列几条，其余用计数说明 */

  /* ================================================================ 小工具 */
  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function txt(value) { return value === null || value === undefined ? '' : String(value); }
  function num(value) { var n = Number(value); return isFinite(n) ? n : 0; }
  function esc(value) {
    return txt(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function pad2(value) { return (value < 10 ? '0' : '') + value; }

  function fmtTime(value) {
    if (!value) return '—';
    var time = new Date(value);
    if (isNaN(time.getTime())) return '—';
    return time.getFullYear() + '-' + pad2(time.getMonth() + 1) + '-' + pad2(time.getDate())
      + ' ' + pad2(time.getHours()) + ':' + pad2(time.getMinutes());
  }
  function fmtSize(bytes) {
    var n = num(bytes);
    if (!n) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  var STATUS_TEXT = { pending: '待审核', approved: '已通过', hidden: '已隐藏', rejected: '已拒绝' };
  var ROLE_TEXT = { plain: '普通', bank: '银行', other: '其他' };
  function statusText(status) { return STATUS_TEXT[status] || '未知'; }
  function kindText(kind) { return kind === 'logo' ? 'Logo' : '卡面'; }
  function roleText(role) { return ROLE_TEXT[role] || '普通'; }
  function roleHint(kind, role) {
    if (role === 'bank') return kind === 'logo' ? '这个分类要求审核时填银行名称（可从名单里选，也能自己填）。' : '这个分类的角色是「银行」。';
    if (role === 'other') return '这个分类要求审核时填备注。';
    return '';
  }

  /* ================================================================ 状态 */
  var state = {
    kind: 'face',
    tab: 'pending',
    q: '',
    token: '',
    password: { ready: null, source: 'none', legacy: false },
    locked: false,
    loading: false,
    seq: 0,
    /* 汇总：pending 来自 /review/items，approved / hidden 来自 /review/catalog */
    summary: { pending: { face: 0, logo: 0 }, approved: { face: 0, logo: 0 }, hidden: { face: 0, logo: 0 } },
    cats: [],
    counts: {},
    category: { face: '', logo: '' },
    openTools: {},
    pending: [],
    pendingTotal: 0,
    approved: [],
    approvedTotal: 0,
    hidden: [],
    hiddenTotal: 0,
    bankNames: [],
    orphans: 0,
    searching: false,
    otherKindHits: 0,
    errors: { items: '', catalog: '' }
  };

  /* ================================================================ 请求 */
  function readToken() {
    if (state.token) return state.token;
    try { state.token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch (error) { state.token = ''; }
    return state.token;
  }
  function saveToken(value) {
    state.token = txt(value).trim();
    try {
      if (state.token) sessionStorage.setItem(TOKEN_KEY, state.token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (error) { /* 隐私模式下 sessionStorage 可能不可用，忽略 */ }
  }
  function withQuery(path, params) {
    var parts = [];
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === '') return;
      parts.push(key + '=' + encodeURIComponent(String(value)));
    });
    return parts.length ? path + '?' + parts.join('&') : path;
  }
  function request(path, options) {
    var config = Object.assign({}, options || {});
    var headers = Object.assign({}, config.headers || {});
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    config.headers = headers;
    return fetch(path, config);
  }
  async function jsonRequest(path, options) {
    var response = await request(path, options);
    var payload = null;
    try { payload = await response.json(); } catch (error) { payload = null; }
    return { ok: response.ok, status: response.status, payload: payload };
  }
  function postJson(path, body) {
    return jsonRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  function failureText(result, what) {
    if (result.status === 401) return '口令不正确或已过期，请重新输入口令。';
    if (result.status === 429) return '操作太频繁，请等一分钟再试。';
    if (result.status === 503) return '服务端还没有配置审核口令（REVIEW_PASSWORD）。';
    var code = result.payload && result.payload.error ? result.payload.error : result.status;
    return what + '失败（' + code + '）。';
  }
  function failureKind(result) { return result.status === 429 ? 'warn' : 'bad'; }

  /* ================================================================ 状态条 */
  var noticeTimer = 0;
  function notice(message, kind) {
    var node = $('#notice');
    clearTimeout(noticeTimer);
    if (!message) { node.hidden = true; node.className = 'notice'; node.textContent = ''; return; }
    node.hidden = false;
    node.className = 'notice ' + (kind || 'info');
    node.textContent = message;
    if (kind === 'ok' || kind === 'info') {
      noticeTimer = setTimeout(function () { notice(''); }, 6000);
    }
  }
  function setProgress(on) { $('#progress').hidden = !on; }

  /* ================================================================ 对话框 */
  var dialogResolve = null;
  var dialogValidate = null;

  function askDialog(options) {
    return new Promise(function (resolve) {
      var dlg = $('#dlg');
      var input = $('#dlg-input');
      var error = $('#dlg-error');
      var field = $('#dlg-field');
      var body = $('#dlg-body');
      $('#dlg-title').textContent = options.title || '确认';
      body.replaceChildren();
      (options.lines || []).forEach(function (line) {
        var node = document.createElement('p');
        node.textContent = line;
        body.append(node);
      });
      var ok = $('#dlg-ok');
      ok.textContent = options.confirmText || '确定';
      ok.className = 'btn ' + (options.danger ? 'danger' : 'primary');
      var cancel = $('#dlg-cancel');
      cancel.textContent = '取消';
      cancel.hidden = options.cancelText === false;
      error.hidden = true;
      error.textContent = '';
      if (options.input) {
        field.hidden = false;
        $('#dlg-field-label').textContent = options.input.label || '输入';
        input.type = options.input.type || 'text';
        input.value = options.input.value || '';
        input.placeholder = options.input.placeholder || '';
        input.maxLength = options.input.maxLength || 200;
        input.autocomplete = options.input.type === 'password' ? 'current-password' : 'off';
      } else {
        field.hidden = true;
      }
      dialogValidate = options.validate || null;
      dialogResolve = resolve;
      dlg.showModal();
      setTimeout(function () { (options.input ? input : ok).focus(); if (options.input) input.select(); }, 0);
    });
  }
  function closeDialog(value) {
    var dlg = $('#dlg');
    if (dlg.open) dlg.close();
    var resolve = dialogResolve;
    dialogResolve = null;
    dialogValidate = null;
    if (resolve) resolve(value);
  }
  function submitDialog() {
    var dlg = $('#dlg');
    if (!dlg.open) return;
    var field = $('#dlg-field');
    var input = $('#dlg-input');
    var error = $('#dlg-error');
    var value = field.hidden ? true : input.value.trim();
    if (dialogValidate) {
      var problem = dialogValidate(value);
      if (problem) { error.hidden = false; error.textContent = problem; if (!field.hidden) input.focus(); return; }
    }
    closeDialog(value);
  }
  function askConfirm(options) {
    return askDialog(Object.assign({}, options, { input: null })).then(function (value) { return value === true; });
  }
  function askText(options) {
    return askDialog(Object.assign({}, options, { input: options.input || { label: '名称' } })).then(function (value) {
      return typeof value === 'string' ? value : null;
    });
  }
  function initDialog() {
    var dlg = $('#dlg');
    $('#dlg-ok').addEventListener('click', submitDialog);
    $('#dlg-cancel').addEventListener('click', function () { closeDialog(null); });
    dlg.addEventListener('cancel', function (event) { event.preventDefault(); closeDialog(null); });
    dlg.addEventListener('click', function (event) { if (event.target === dlg) closeDialog(null); });
    $('#dlg-input').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); submitDialog(); }
    });
  }

  /* ================================================================ 预览 */
  var previewCache = new Map();
  var previewPending = new Map();
  var previewObserver = null;
  var primed = false;

  function fileUrl(item, thumb) {
    var query = 't=' + encodeURIComponent(item.type || 'png');
    if (thumb) query += '&thumb=1';
    return '/review/file/' + encodeURIComponent(item.id) + '?' + query;
  }
  function previewSources(item) {
    /* thumbUrl 是服务端给的小图；老数据没有时退回原图 url */
    var thumb = item.thumbUrl || fileUrl(item, true);
    var full = item.url || fileUrl(item, false);
    return thumb === full ? [thumb] : [thumb, full];
  }
  function findItem(id) {
    var pools = [state.pending, state.approved, state.hidden];
    for (var index = 0; index < pools.length; index += 1) {
      var hit = pools[index].find(function (row) { return row.id === id; });
      if (hit) return hit;
    }
    return null;
  }
  function rememberPreview(id, url) {
    if (previewCache.size >= PREVIEW_CACHE_MAX) {
      var oldest = previewCache.keys().next().value;
      var used = previewCache.get(oldest);
      var onScreen = $$('img').some(function (img) { return img.src === used; });
      if (!onScreen) { URL.revokeObjectURL(used); previewCache.delete(oldest); }
    }
    previewCache.set(id, url);
  }
  function markMissing(img) {
    var frame = img.closest('.frame');
    if (frame) frame.setAttribute('data-state', 'missing');
    img.removeAttribute('src');
  }
  function applyPreview(img, url) {
    var frame = img.closest('.frame');
    if (frame) frame.setAttribute('data-state', 'ready');
    img.src = url;
  }
  async function fetchPreview(item) {
    var sources = previewSources(item);
    for (var index = 0; index < sources.length; index += 1) {
      try {
        var response = await request(sources[index]);
        if (!response.ok) continue;
        var blob = await response.blob();
        if (!blob || !blob.size) continue;
        var url = URL.createObjectURL(blob);
        rememberPreview(item.id, url);
        return url;
      } catch (error) { /* 这一路取不到就试下一路（小图 → 原图） */ }
    }
    return '';
  }
  function startPreview(img) {
    var id = img.getAttribute('data-preview-id');
    if (!id) return;
    var cached = previewCache.get(id);
    if (cached) { applyPreview(img, cached); return; }
    var item = findItem(id);
    if (!item) { markMissing(img); return; }
    var running = previewPending.get(id);
    if (!running) {
      running = fetchPreview(item);
      previewPending.set(id, running);
    }
    running.then(function (url) {
      if (!url) { previewPending.delete(id); markMissing(img); return; }
      if (img.isConnected) applyPreview(img, url);
    }).catch(function () { markMissing(img); });
  }
  /** 懒加载：卡片进入视口附近才下载；同一个 id 只下载一次，重画直接复用 blob URL */
  function hydratePreviews(root) {
    var imgs = $$('img[data-preview-id]', root);
    if (!imgs.length) return;
    if (!('IntersectionObserver' in window)) {
      imgs.slice(0, 16).forEach(startPreview);
      return;
    }
    if (!previewObserver) {
      previewObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          previewObserver.unobserve(entry.target);
          startPreview(entry.target);
        });
      }, { rootMargin: '360px 0px' });
    }
    imgs.forEach(function (img) {
      if (previewCache.has(img.getAttribute('data-preview-id'))) { startPreview(img); return; }
      previewObserver.observe(img);
    });
    setTimeout(primeFallback, 700);
  }
  /** 兜底：视口高度为 0 等情况下交叉观察器不触发，先直接拉前几张 */
  function primeFallback() {
    if (primed || previewCache.size > 0) return;
    var imgs = $$('img[data-preview-id]').filter(function (img) { return !img.getAttribute('src'); });
    if (!imgs.length) return;
    primed = true;
    imgs.slice(0, 6).forEach(startPreview);
  }

  /* ================================================================ 片段 */
  function categoryOf(id) {
    return state.cats.find(function (entry) { return entry.id === id; }) || null;
  }
  function categoryName(id) {
    var hit = categoryOf(id);
    return hit ? hit.name : (id || '未分类');
  }
  function sameHashOthers(item) {
    if (!item.hash) return [];
    var seen = {};
    var rows = [];
    [state.pending, state.approved, state.hidden].forEach(function (pool) {
      pool.forEach(function (row) {
        if (row.id === item.id || row.hash !== item.hash || seen[row.id]) return;
        seen[row.id] = true;
        rows.push(row);
      });
    });
    return rows;
  }
  function keepKind(items, kind) {
    /* 服务端已按 kind 过滤；万一老版本没有 kind 字段就不过滤，避免条目凭空消失 */
    var tagged = items.some(function (item) { return item.kind === 'face' || item.kind === 'logo'; });
    if (!tagged) return items;
    return items.filter(function (item) { return !item.kind || item.kind === kind; });
  }
  function roleOptionsHtml(current) {
    return ['plain', 'bank', 'other'].map(function (role) {
      return '<option value="' + role + '"' + (role === current ? ' selected' : '') + '>' + roleText(role) + '</option>';
    }).join('');
  }
  function categoryOptionsHtml(item) {
    var list = state.cats.filter(function (entry) { return entry.kind === item.kind; });
    var known = list.some(function (entry) { return entry.id === item.category; });
    var html = '';
    if (item.category && !known) {
      html += '<option value="' + esc(item.category) + '" selected>' + esc(item.category) + '（分类已删除）</option>';
    }
    if (!item.category) html += '<option value="" selected>未分类</option>';
    list.forEach(function (entry) {
      html += '<option value="' + esc(entry.id) + '"' + (entry.id === item.category ? ' selected' : '') + '>' + esc(entry.name) + '</option>';
    });
    return html;
  }
  function metaHtml(item) {
    var rows = [['提交', fmtTime(item.created)]];
    if (item.reviewedAt) rows.push(['审核', fmtTime(item.reviewedAt)]);
    if (item.width && item.height) rows.push(['尺寸', num(item.width) + ' × ' + num(item.height)]);
    rows.push(['大小', fmtSize(item.size)]);
    rows.push(['类型', txt(item.type).toUpperCase() || '—']);
    rows.push(['指纹', item.hash ? txt(item.hash).slice(0, 10) : '—']);
    if (item.bankName) rows.push(['银行', item.bankName + (item.bankBuiltin ? '' : '（自定义）')]);
    rows.push(['状态', statusText(item.status)]);
    return '<dl class="meta">' + rows.map(function (row) {
      var mono = row[0] === '指纹';
      var dd = '<dd' + (mono ? ' class="mono"' : '') + '>' + esc(row[1]) + '</dd>';
      return '<div><dt>' + esc(row[0]) + '</dt>' + dd + '</div>';
    }).join('') + '</dl>';
  }
  function fieldsHtml(item) {
    var target = categoryOf(item.category);
    var hint = roleHint(item.kind, target ? target.role : 'plain');
    var bankPlaceholder = item.kind === 'logo' ? '可从名单里选，也能自己填' : '选填';
    return ''
      + '<div class="fields">'
      + '<label class="field"><span>名称</span><input type="text" data-field="name" maxlength="40" autocomplete="off" value="' + esc(item.name || '') + '"></label>'
      + '<label class="field"><span>分类</span><select data-field="category">' + categoryOptionsHtml(item) + '</select></label>'
      + '<label class="field"><span>银行名称</span><input type="text" data-field="bank" list="bank-names" maxlength="24" autocomplete="off" placeholder="' + esc(bankPlaceholder) + '" value="' + esc(item.bankName || item.bank || '') + '"></label>'
      + '<label class="field"><span>备注</span><input type="text" data-field="label" maxlength="24" autocomplete="off" value="' + esc(item.label || '') + '"></label>'
      + '</div>'
      + '<p class="field-hint" data-hint' + (hint ? '' : ' hidden') + '>' + esc(hint) + '</p>';
  }
  function dupesHtml(item) {
    var count = num(item.sameHash);
    if (count <= 0) return '';
    var others = sameHashOthers(item);
    var html = '<div class="dupes">';
    html += '<p class="dupes-head">同图另有 ' + count + ' 条</p>';
    if (others.length) {
      html += '<ul class="dupe-list">' + others.slice(0, DUPE_LIST_MAX).map(function (row) {
        return '<li><span>' + esc(row.name || row.id) + '</span><span class="sep">·</span><span>' + esc(categoryName(row.category)) + '</span><span class="sep">·</span><span>' + statusText(row.status) + '</span></li>';
      }).join('') + '</ul>';
      if (others.length > DUPE_LIST_MAX) html += '<p class="fs12">另有 ' + (others.length - DUPE_LIST_MAX) + ' 条同图条目未列出。</p>';
    } else {
      html += '<p class="fs12">同图条目不在当前列表里（可能属于另一个区域）。</p>';
    }
    html += '<div class="dupes-actions">';
    if (item.status === 'pending') {
      html += '<button type="button" class="btn tiny primary" data-act="approve-dupes">同图一起通过</button>';
      html += '<button type="button" class="btn tiny danger" data-act="reject-dupes">同图一起拒绝</button>';
    }
    html += '<button type="button" class="btn tiny" data-act="merge-dupes">合并为一条（其余删除）</button>';
    html += '</div></div>';
    return html;
  }
  function actionsHtml(item) {
    var html = '<div class="actions">';
    if (item.status === 'pending') {
      html += '<button type="button" class="btn primary" data-act="approve">通过</button>';
      html += '<button type="button" class="btn" data-act="reject">拒绝并删除文件</button>';
    } else if (item.status === 'hidden') {
      html += '<button type="button" class="btn primary" data-act="update-item">保存修改</button>';
      html += '<button type="button" class="btn" data-act="restore-item">恢复</button>';
    } else {
      html += '<button type="button" class="btn primary" data-act="update-item">保存修改</button>';
      html += '<button type="button" class="btn" data-act="hide-item">隐藏</button>';
    }
    html += '<button type="button" class="btn danger push" data-act="delete-item">彻底删除</button>';
    html += '</div>';
    return html;
  }
  function cardHtml(item, index) {
    var status = item.status || 'pending';
    var delay = Math.min(index, STAGGER_CAP);
    var html = '<article class="card" data-id="' + esc(item.id) + '" data-status="' + esc(status) + '" style="--i:' + delay + '">';
    html += '<div class="frame" data-state="loading">';
    html += '<img data-preview-id="' + esc(item.id) + '" alt="' + esc(item.name || item.id) + '" draggable="false" decoding="async">';
    html += '<span class="ph ph-missing">文件缺失</span>';
    html += '<div class="chips"><span class="chip ' + esc(status) + '">' + statusText(status) + '</span></div>';
    html += '</div>';
    html += '<div class="card-body">';
    html += '<div class="card-head"><h3 class="card-title">' + esc(item.name || '未命名') + '</h3><span class="card-id">' + esc(txt(item.id).slice(0, 8)) + '</span></div>';
    html += metaHtml(item);
    html += fieldsHtml(item);
    html += dupesHtml(item);
    html += '</div>';
    html += actionsHtml(item);
    html += '</article>';
    return html;
  }
  function gridHtml(items) {
    return '<div class="grid" data-anim="1">' + items.map(cardHtml).join('') + '</div>';
  }
  function skeletonHtml() {
    var html = '';
    for (var index = 0; index < 4; index += 1) html += '<div class="skel" aria-hidden="true"></div>';
    return '<div class="grid" aria-hidden="true">' + html + '</div>';
  }
  function emptyHtml(title, body, actionHtml) {
    return '<div class="empty"><h2>' + esc(title) + '</h2><p>' + esc(body) + '</p>'
      + (actionHtml ? '<div class="actions">' + actionHtml + '</div>' : '') + '</div>';
  }
  function moreHtml(act, label) {
    return '<div class="more"><button type="button" class="btn" data-act="' + act + '">' + esc(label) + '</button></div>';
  }
  function panelHeadHtml(title, hint) {
    return '<div class="panel-head"><h2>' + esc(title) + '</h2>'
      + (hint ? '<p class="panel-hint">' + esc(hint) + '</p>' : '') + '</div>';
  }
  function searchNoteHtml() {
    if (!state.q) return '';
    var extra = '';
    if (state.otherKindHits > 0) {
      extra = '当前结果里还有 ' + state.otherKindHits + ' 条属于 ' + kindText(state.kind === 'face' ? 'logo' : 'face') + ' 区。';
    }
    return '<div class="panel-note"><span>搜索「' + esc(state.q) + '」：跨分类匹配，只显示当前区域的内容。' + extra + '</span>'
      + '<button type="button" class="btn tiny" data-act="clear-search">清除搜索</button>'
      + (state.otherKindHits > 0 ? '<button type="button" class="btn tiny" data-act="switch-kind">切到 ' + kindText(state.kind === 'face' ? 'logo' : 'face') + ' 区</button>' : '')
      + '</div>';
  }
  function catRowHtml(entry, count, current, isFirst, isLast) {
    var key = state.kind + ':' + entry.id;
    var open = state.openTools[key] === true;
    var html = '<div class="cat' + (current ? ' on' : '') + '" data-cat="' + esc(entry.id) + '">';
    html += '<div class="cat-main">';
    html += '<button type="button" class="cat-open" data-cat-act="open"' + (current ? ' aria-current="true"' : '') + '>'
      + '<span class="cat-name">' + esc(entry.name) + '</span>'
      + (entry.role && entry.role !== 'plain' ? '<span class="cat-role">' + roleText(entry.role) + '</span>' : '')
      + '<span class="badge">' + count + '</span></button>';
    if (entry.id) {
      html += '<button type="button" class="cat-toggle" data-cat-act="manage" aria-expanded="' + (open ? 'true' : 'false') + '"'
        + ' aria-controls="cattools-' + esc(state.kind + '-' + entry.id) + '"'
        + ' title="管理分类：' + esc(entry.name) + '" aria-label="管理分类：' + esc(entry.name) + '">⋯</button>';
    }
    html += '</div>';
    if (entry.id) {
      html += '<div class="cat-tools" id="cattools-' + esc(state.kind + '-' + entry.id) + '"' + (open ? '' : ' hidden') + '>';
      html += '<label class="role-row"><span>角色</span><select data-cat-act="role">' + roleOptionsHtml(entry.role) + '</select></label>';
      html += '<div class="cat-btns">';
      html += '<button type="button" class="btn tiny" data-cat-act="rename">改名</button>';
      html += '<button type="button" class="btn tiny" data-cat-act="up"' + (isFirst ? ' disabled' : '') + '>上移</button>';
      html += '<button type="button" class="btn tiny" data-cat-act="down"' + (isLast ? ' disabled' : '') + '>下移</button>';
      html += '<button type="button" class="btn tiny danger" data-cat-act="hide">隐藏分类</button>';
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }
  function railHtml() {
    var kind = state.kind;
    var cats = state.cats.filter(function (entry) { return entry.kind === kind; });
    var current = state.category[kind] || '';
    var html = '<aside class="rail" aria-label="分类">';
    html += '<div class="rail-head"><h2>分类</h2><span class="fs12 muted">' + cats.length + ' 个</span></div>';
    html += '<div class="cats">';
    html += catRowHtml({ id: '', name: '全部分类', role: '' }, num(state.summary.approved[kind]), current === '', true, true);
    cats.forEach(function (entry, index) {
      var count = num(state.counts[kind + ':' + entry.id]);
      html += catRowHtml(entry, count, current === entry.id, index === 0, index === cats.length - 1);
    });
    if (state.orphans) {
      html += '<div class="cat' + (current === '__orphan__' ? ' on' : '') + '" data-cat="__orphan__">'
        + '<div class="cat-main"><button type="button" class="cat-open" data-cat-act="open"' + (current === '__orphan__' ? ' aria-current="true"' : '') + '>'
        + '<span class="cat-name">未归类</span><span class="badge">' + state.orphans + '</span></button></div>'
        + '<p class="fs12 muted" style="padding:0 8px 8px">分类已被删除的条目，两个区域合计 ' + state.orphans + ' 条。</p></div>';
    }
    html += '</div>';
    html += '<div class="addcat">'
      + '<div class="fs12 muted">新增分类（归入 ' + kindText(kind) + ' 区）</div>'
      + '<div class="addcat-row">'
      + '<input type="text" id="new-cat-name" maxlength="16" placeholder="分类名称" aria-label="新分类名称" autocomplete="off">'
      + '<select id="new-cat-role" aria-label="新分类角色">' + roleOptionsHtml('plain') + '</select>'
      + '</div>'
      + '<div class="actions"><button type="button" class="btn tiny" data-cat-act="add">添加分类</button></div>'
      + '</div>';
    html += '</aside>';
    return html;
  }

  /* ================================================================ 渲染 */
  function kindTabsHtml() {
    return ['face', 'logo'].map(function (kind) {
      return '<button type="button" role="tab" id="kind-tab-' + kind + '" data-kind="' + kind + '" aria-controls="panel" aria-selected="false" tabindex="-1">'
        + '<span>' + kindText(kind) + '</span><span class="pill">0</span></button>';
    }).join('');
  }
  function subTabsHtml() {
    return [['pending', '待处理'], ['approved', '已通过'], ['hidden', '已隐藏']].map(function (entry) {
      return '<button type="button" role="tab" id="tab-' + entry[0] + '" data-tab="' + entry[0] + '" class="subtab" aria-controls="panel" aria-selected="false" tabindex="-1">'
        + entry[1] + '<span class="badge">0</span></button>';
    }).join('');
  }
  function renderKindTabs() {
    var box = $('#kind-tabs');
    if (!$$('[data-kind]', box).length) box.innerHTML = kindTabsHtml();
    $$('[data-kind]', box).forEach(function (button) {
      var kind = button.getAttribute('data-kind');
      var on = state.kind === kind;
      button.setAttribute('aria-selected', on ? 'true' : 'false');
      button.tabIndex = on ? 0 : -1;
      $('.pill', button).textContent = String(num(state.summary.pending[kind]));
    });
  }
  function renderSubTabs() {
    var box = $('#tab-tabs');
    if (!$$('[data-tab]', box).length) box.innerHTML = subTabsHtml();
    var counts = {
      pending: num(state.summary.pending[state.kind]),
      approved: num(state.summary.approved[state.kind]),
      hidden: num(state.summary.hidden[state.kind])
    };
    $$('[data-tab]', box).forEach(function (button) {
      var tab = button.getAttribute('data-tab');
      var on = state.tab === tab;
      button.setAttribute('aria-selected', on ? 'true' : 'false');
      button.tabIndex = on ? 0 : -1;
      var badge = $('.badge', button);
      badge.textContent = String(counts[tab]);
      badge.classList.toggle('hot', tab === 'pending' && counts.pending > 0);
    });
    $('#panel').setAttribute('aria-labelledby', 'kind-tab-' + state.kind);
  }
  function renderSummary() {
    $('#summary').innerHTML = ['face', 'logo'].map(function (kind) {
      var on = state.kind === kind;
      return '<p class="sumchip' + (on ? ' on' : '') + '"><b>' + kindText(kind) + '</b>'
        + '<span>待审 ' + num(state.summary.pending[kind]) + '</span><span class="sep" aria-hidden="true">·</span>'
        + '<span>已通过 ' + num(state.summary.approved[kind]) + '</span><span class="sep" aria-hidden="true">·</span>'
        + '<span>已隐藏 ' + num(state.summary.hidden[kind]) + '</span></p>';
    }).join('');
  }
  function renderBankNames() {
    var node = $('#bank-names');
    node.replaceChildren();
    state.bankNames.forEach(function (name) {
      var option = document.createElement('option');
      option.value = name;
      node.append(option);
    });
  }
  function currentError() {
    return state.tab === 'pending' ? state.errors.items : state.errors.catalog;
  }
  function tabHasData() {
    if (state.tab === 'pending') return state.pending.length > 0;
    if (state.tab === 'approved') return state.approved.length > 0 || state.cats.length > 0;
    return state.hidden.length > 0;
  }
  function pendingHtml() {
    var html = panelHeadHtml('待处理 · ' + kindText(state.kind),
      state.q ? '' : '新投稿会先出现在这里；通过后会进入「已通过」，并出现在站点上。');
    html += searchNoteHtml();
    if (!state.pending.length) {
      html += emptyHtml(
        state.q ? '没有匹配的待审内容' : '没有待审的' + kindText(state.kind),
        state.q ? '换个关键词试试，或清除搜索查看全部待审内容。' : '收到新投稿后会自动出现在这个列表里。',
        state.q ? '<button type="button" class="btn tiny" data-act="clear-search">清除搜索</button>' : ''
      );
    } else {
      html += gridHtml(state.pending);
    }
    var remaining = state.pendingTotal - state.pending.length;
    if (remaining > 0) html += moreHtml('more-pending', '加载更多（还有 ' + remaining + ' 条）');
    return html;
  }
  function approvedHtml() {
    var kind = state.kind;
    var current = state.category[kind] || '';
    var title = '已通过 · ' + kindText(kind) + ' · ' + (state.searching ? '搜索结果' : current === '__orphan__' ? '未归类' : current ? categoryName(current) : '全部分类');
    var role = current ? (categoryOf(current) || {}).role : '';
    var hint = state.q
      ? '共匹配 ' + state.approvedTotal + ' 条；这里只显示 ' + kindText(kind) + ' 区的内容。'
      : '共 ' + state.approvedTotal + ' 条。' + (role ? '分类角色：' + roleText(role) + '。' : '');
    var html = '<div class="split">';
    html += railHtml();
    html += '<div class="list">';
    html += panelHeadHtml(title, hint);
    html += searchNoteHtml();
    if (!state.approved.length) {
      html += emptyHtml(
        state.q ? '没有匹配的已通过内容' : current === '__orphan__' ? '没有未归类的条目' : '这里还没有内容',
        state.q ? '换个关键词试试，或清除搜索。' : '在「待处理」里点通过后，内容会出现在这里。',
        state.q ? '<button type="button" class="btn tiny" data-act="clear-search">清除搜索</button>' : ''
      );
    } else {
      html += gridHtml(state.approved);
    }
    var remaining = state.approvedTotal - state.approved.length;
    if (remaining > 0) html += moreHtml('more-approved', '加载更多（还有 ' + remaining + ' 条）');
    html += '</div></div>';
    return html;
  }
  function hiddenHtml() {
    var html = panelHeadHtml('已隐藏 · ' + kindText(state.kind),
      state.q ? '' : '隐藏的内容不会出现在站点上，可以随时恢复；超过保留期的会被自动清理。');
    html += searchNoteHtml();
    if (!state.hidden.length) {
      html += emptyHtml(
        state.q ? '没有匹配的已隐藏内容' : '没有隐藏的' + kindText(state.kind),
        state.q ? '换个关键词试试，或清除搜索。' : '在「已通过」里点隐藏后，内容会出现在这里。',
        state.q ? '<button type="button" class="btn tiny" data-act="clear-search">清除搜索</button>' : ''
      );
    } else {
      html += gridHtml(state.hidden);
      if (state.hiddenTotal > state.hidden.length) {
        html += '<p class="fs12 muted" style="margin-top:12px">还有 ' + (state.hiddenTotal - state.hidden.length) + ' 条已隐藏内容没有显示（服务端一次最多返回 200 条）。</p>';
      }
    }
    return html;
  }
  function renderPanel() {
    var panel = $('#panel');
    panel.setAttribute('aria-busy', state.loading ? 'true' : 'false');
    if (state.password.ready === false) {
      panel.innerHTML = emptyHtml('审核口令还没配置',
        '先在 Cloudflare Worker 的「设置 → 变量和密钥」里加上 REVIEW_PASSWORD（至少 12 位），重新部署后刷新这个页面。');
      return;
    }
    if (state.locked) {
      panel.innerHTML = emptyHtml('需要审核口令',
        '口令只保存在本次浏览会话里（sessionStorage），关闭标签页就失效。',
        '<button type="button" class="btn primary" data-act="login">输入口令</button>');
      return;
    }
    if (currentError()) {
      panel.innerHTML = emptyHtml('加载失败', currentError(),
        '<button type="button" class="btn" data-act="retry">重试</button>');
      return;
    }
    if (state.loading && !tabHasData()) {
      panel.innerHTML = skeletonHtml();
      return;
    }
    if (state.tab === 'pending') panel.innerHTML = pendingHtml();
    else if (state.tab === 'approved') panel.innerHTML = approvedHtml();
    else panel.innerHTML = hiddenHtml();
    hydratePreviews(panel);
  }
  function render() {
    renderKindTabs();
    renderSubTabs();
    renderSummary();
    renderBankNames();
    renderPanel();
    updateSearchClear();
  }
  function updateSearchClear() {
    var input = $('#search');
    $('#search-clear').hidden = !input.value;
  }

  /* ================================================================ 动作 */
  function busy(button, on, label) {
    if (!button) return;
    if (on) {
      button.dataset.label = button.textContent;
      button.textContent = label || '处理中…';
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      return;
    }
    if (button.dataset.label) {
      button.textContent = button.dataset.label;
      delete button.dataset.label;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
  async function runAction(button, work) {
    busy(button, true);
    try { await work(); } finally { busy(button, false); }
  }
  function cardFields(card) {
    return {
      name: $('[data-field="name"]', card).value.trim(),
      category: $('[data-field="category"]', card).value,
      bank: $('[data-field="bank"]', card).value.trim(),
      label: $('[data-field="label"]', card).value.trim()
    };
  }
  function updateRoleHint(card) {
    if (!card) return;
    var item = findItem(card.getAttribute('data-id'));
    if (!item) return;
    var select = $('[data-field="category"]', card);
    var target = categoryOf(select.value);
    var hint = roleHint(item.kind, target ? target.role : 'plain');
    var node = $('[data-hint]', card);
    if (!node) return;
    node.textContent = hint;
    node.hidden = !hint;
  }

  async function approve(card, button, batched) {
    var body = Object.assign({ action: batched ? 'approve-dupes' : 'approve', id: card.getAttribute('data-id') }, cardFields(card));
    await runAction(button, async function () {
      var result = await postJson('/review/items', body);
      if (!result.ok) { notice(failureText(result, batched ? '同图一起通过' : '通过'), failureKind(result)); return; }
      var count = result.payload && result.payload.approved ? num(result.payload.approved) : 0;
      notice(batched ? '已通过这一组同图条目' + (count > 1 ? '（共 ' + count + ' 条）' : '') + '。' : '已通过。', 'ok');
      await load();
    });
  }
  async function reject(button, batched, sameHash) {
    var ok = await askConfirm({
      title: batched ? '同图一起拒绝？' : '拒绝并删除文件？',
      lines: batched
        ? ['这一条和同图的其它 ' + sameHash + ' 条会一起被标记为已拒绝，服务器上的文件会被删除，无法恢复。']
        : ['服务器上的图片文件会被删除，记录标记为已拒绝，无法恢复。'],
      confirmText: batched ? '一起拒绝并删除' : '拒绝并删除',
      danger: true
    });
    if (!ok) return;
    await runAction(button, async function () {
      var card = button.closest('.card');
      var result = await postJson('/review/items', { action: batched ? 'reject-dupes' : 'reject', id: card.getAttribute('data-id') });
      if (!result.ok) { notice(failureText(result, '拒绝'), failureKind(result)); return; }
      notice(batched ? '已拒绝这一组同图条目。' : '已拒绝并删除文件。', 'ok');
      await load();
    });
  }
  async function saveItem(card, button) {
    var body = Object.assign({ action: 'update-item', id: card.getAttribute('data-id') }, cardFields(card));
    await runAction(button, async function () {
      var result = await postJson('/review/catalog', body);
      if (!result.ok) { notice(failureText(result, '保存修改'), failureKind(result)); return; }
      notice('已保存修改。', 'ok');
      await load();
    });
  }
  async function hideItem(card, button) {
    var ok = await askConfirm({
      title: '隐藏这条内容？',
      lines: ['隐藏后不会出现在站点上，可以随时恢复；超过保留期的会被自动清理。'],
      confirmText: '隐藏'
    });
    if (!ok) return;
    await runAction(button, async function () {
      var result = await postJson('/review/catalog', { action: 'hide-item', id: card.getAttribute('data-id') });
      if (!result.ok) { notice(failureText(result, '隐藏'), failureKind(result)); return; }
      notice('已隐藏。', 'ok');
      await load();
    });
  }
  async function restoreItem(card, button) {
    await runAction(button, async function () {
      var result = await postJson('/review/catalog', { action: 'restore-item', id: card.getAttribute('data-id') });
      if (!result.ok) { notice(failureText(result, '恢复'), failureKind(result)); return; }
      notice('已恢复，内容重新出现在站点上。', 'ok');
      await load();
    });
  }
  async function deleteItem(card, button) {
    var ok = await askConfirm({
      title: '彻底删除这条内容？',
      lines: ['文件与记录都会被移除，无法恢复。'],
      confirmText: '彻底删除',
      danger: true
    });
    if (!ok) return;
    await runAction(button, async function () {
      var result = await postJson('/review/catalog', { action: 'delete-item', id: card.getAttribute('data-id'), confirm: true });
      if (!result.ok) { notice(failureText(result, '删除'), failureKind(result)); return; }
      notice('已彻底删除。', 'ok');
      await load();
    });
  }
  async function mergeDupes(card, button, sameHash) {
    var ok = await askConfirm({
      title: '合并为一条？',
      lines: ['保留这条「' + ($('[data-field="name"]', card).value.trim() || '未命名') + '」，把同图的其它 ' + sameHash + ' 条（连文件）删掉。'],
      confirmText: '合并',
      danger: true
    });
    if (!ok) return;
    await runAction(button, async function () {
      var result = await postJson('/review/catalog', { action: 'merge-dupes', id: card.getAttribute('data-id'), confirm: true });
      if (!result.ok) { notice(failureText(result, '合并'), failureKind(result)); return; }
      var merged = result.payload && result.payload.merged ? num(result.payload.merged) : 0;
      notice('已合并：删掉 ' + merged + ' 条同图条目。', 'ok');
      await load();
    });
  }

  function toggleCatTools(row) {
    var toggle = $('[data-cat-act="manage"]', row);
    var tools = $('.cat-tools', row);
    if (!toggle || !tools) return;
    var open = tools.hidden;
    tools.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    state.openTools[state.kind + ':' + row.getAttribute('data-cat')] = open;
  }
  function openCategory(id) {
    state.category[state.kind] = id;
    if (state.q) { clearSearchInput(); notice('已清除搜索，切到指定分类。', 'info'); }
    load();
  }
  async function addCategory(button) {
    var input = $('#new-cat-name');
    var name = input.value.trim();
    if (!name) { notice('先填分类名称。', 'warn'); input.focus(); return; }
    var role = $('#new-cat-role').value;
    await runAction(button, async function () {
      var result = await postJson('/review/catalog', { action: 'add-category', name: name, kind: state.kind, role: role });
      if (!result.ok) { notice(failureText(result, '添加分类'), failureKind(result)); return; }
      input.value = '';
      notice('已添加分类「' + name + '」。', 'ok');
      await load();
    });
  }
  async function setRole(id, role, select) {
    var result = await postJson('/review/catalog', { action: 'set-role', id: id, role: role });
    if (!result.ok) { notice(failureText(result, '设置角色'), failureKind(result)); await load(); return; }
    notice('分类角色已改为「' + roleText(role) + '」。', 'ok');
    if (select) { select.disabled = true; setTimeout(function () { select.disabled = false; }, 200); }
    await load();
  }
  async function renameCategory(id, row, button) {
    var current = $('.cat-name', row).textContent;
    var name = await askText({
      title: '分类改名',
      lines: ['改名只影响后台和站点上的显示名称，分类里的内容不受影响。'],
      input: { label: '分类名称', value: current, maxLength: 16 },
      confirmText: '保存',
      validate: function (value) { return value ? '' : '分类名称不能为空。'; }
    });
    if (!name || name === current) return;
    await runAction(button, async function () {
      var result = await postJson('/review/catalog', { action: 'rename-category', id: id, name: name });
      if (!result.ok) { notice(failureText(result, '改名'), failureKind(result)); return; }
      notice('分类已改名为「' + name + '」。', 'ok');
      await load();
    });
  }
  async function moveCategory(id, direction, button) {
    await runAction(button, async function () {
      var result = await postJson('/review/catalog', { action: 'move-category', id: id, direction: direction });
      if (!result.ok) { notice(failureText(result, '排序'), failureKind(result)); return; }
      await load();
    });
  }
  async function hideCategory(id, row, button) {
    var name = $('.cat-name', row).textContent;
    await runAction(button, async function () {
      var first = await postJson('/review/catalog', { action: 'remove-category', id: id });
      if (!first.ok) { notice(failureText(first, '隐藏分类'), failureKind(first)); return; }
      if (!first.payload || first.payload.needConfirm !== true) { notice('已隐藏分类「' + name + '」。', 'ok'); await load(); return; }
      var affected = first.payload.affected && first.payload.affected.items ? num(first.payload.affected.items) : 0;
      var ok = await askConfirm({
        title: '隐藏分类「' + name + '」？',
        lines: ['这个分类里的 ' + affected + ' 条内容会一起被隐藏（不会删除文件），隐藏后可以恢复，超过保留期的会被自动清理。'],
        confirmText: '隐藏分类及其内容',
        danger: true
      });
      if (!ok) return;
      var second = await postJson('/review/catalog', { action: 'remove-category', id: id, confirm: true });
      if (!second.ok) { notice(failureText(second, '隐藏分类'), failureKind(second)); return; }
      state.category[state.kind] = '';
      notice('已隐藏分类「' + name + '」。', 'ok');
      await load();
    });
  }
  async function restoreDefaults(button) {
    var ok = await askConfirm({
      title: '找回内置分类？',
      lines: ['被删掉的内置分类会补回来（纯色 / 银行 / 交通 / 其他、银行 / 交通联合 / 卡组织素材 / 支付方式）。已存在的不动，内容也不受影响。'],
      confirmText: '找回分类'
    });
    if (!ok) return;
    await runAction(button, async function () {
      var result = await postJson('/review/catalog', { action: 'restore-defaults' });
      if (!result.ok) { notice(failureText(result, '找回分类'), failureKind(result)); return; }
      var restored = result.payload && result.payload.restored ? num(result.payload.restored) : 0;
      notice('已找回 ' + restored + ' 个内置分类。', 'ok');
      await load();
    });
  }
  async function fixKinds(button) {
    var ok = await askConfirm({
      title: '修正历史类型？',
      lines: ['按分类把历史条目的类型（卡面 / Logo）写回记录，只改类型字段，不动图片和分类。'],
      confirmText: '开始修正'
    });
    if (!ok) return;
    await runAction(button, async function () {
      var result = await postJson('/review/catalog', { action: 'fix-kinds' });
      if (!result.ok) { notice(failureText(result, '修正类型'), failureKind(result)); return; }
      var fixed = result.payload && result.payload.fixed ? num(result.payload.fixed) : 0;
      notice('已修正 ' + fixed + ' 条条目的类型。', 'ok');
      await load();
    });
  }
  async function changePassword() {
    var value = await askDialog({
      title: '修改审核口令',
      lines: ['新口令立刻生效（哈希保存在 R2）。至少 12 位，改完当前会话会直接使用新口令。'],
      input: { type: 'password', label: '新口令', placeholder: '至少 12 位', maxLength: 128 },
      confirmText: '保存新口令',
      validate: function (typed) { return typed && typed.length >= 12 ? '' : '口令至少 12 位。'; }
    });
    if (!value) return;
    setProgress(true);
    var result = await postJson('/review/password', { password: value });
    setProgress(false);
    if (result.ok) {
      saveToken(value);
      state.locked = false;
      notice('口令已更新，当前会话已换用新口令。', 'ok');
      await load();
      return;
    }
    if (result.status === 503) { notice('服务端没有配置 REVIEW_PASSWORD，无法轮换口令。', 'warn'); return; }
    if (result.status === 401) { notice('当前口令不正确，无法修改。', 'bad'); return; }
    notice(failureText(result, '修改口令'), failureKind(result));
  }
  async function login(button) {
    var value = await askDialog({
      title: '输入审核口令',
      lines: ['口令只保存在本次浏览会话里（sessionStorage），关闭标签页即失效。'],
      input: { type: 'password', label: '审核口令', placeholder: '至少 12 位', maxLength: 128 },
      confirmText: '进入后台'
    });
    if (!value) return;
    saveToken(value);
    state.locked = false;
    notice('');
    await load();
    if (button) busy(button, false);
  }
  async function loadMore(button, act) {
    var pending = act === 'more-pending';
    var offset = pending ? state.pending.length : state.approved.length;
    await runAction(button, async function () {
      var result = pending
        ? await jsonRequest(withQuery('/review/items', { kind: state.kind, limit: PENDING_PAGE, offset: offset, q: state.q }))
        : await jsonRequest(withQuery('/review/catalog', { kind: state.kind, category: state.category[state.kind], limit: APPROVED_PAGE, offset: offset, q: state.q }));
      if (!result.ok) { notice(failureText(result, '加载更多'), failureKind(result)); return; }
      var payload = result.payload || {};
      var items = keepKind(payload.items || [], state.kind);
      if (!items.length) { notice('没有更多内容了。', 'info'); return; }
      if (pending) {
        state.pending = state.pending.concat(items);
        state.pendingTotal = num(payload.total) || state.pendingTotal;
      } else {
        state.approved = state.approved.concat(items);
        state.approvedTotal = num(payload.total) || state.approvedTotal;
      }
      appendCards(items);
      syncMore(act, pending ? state.pendingTotal - state.pending.length : state.approvedTotal - state.approved.length);
    });
  }
  function appendCards(items) {
    var grid = $('.grid', $('#panel'));
    if (!grid) { renderPanel(); return; }
    var holder = document.createElement('div');
    holder.innerHTML = items.map(cardHtml).join('');
    while (holder.firstElementChild) grid.append(holder.firstElementChild);
    hydratePreviews(grid);
  }
  function syncMore(act, remaining) {
    var button = $('[data-act="' + act + '"]');
    if (!button) return;
    if (remaining > 0) { button.textContent = '加载更多（还有 ' + remaining + ' 条）'; return; }
    var box = button.closest('.more');
    if (box) box.remove();
  }

  /** 条目按钮统一入口（事件委托，卡片重画也不需要重新绑定） */
  async function handleItemAct(button) {
    var act = button.getAttribute('data-act');
    if (act === 'clear-search') { clearSearch(); return; }
    if (act === 'switch-kind') { setKind(state.kind === 'face' ? 'logo' : 'face'); return; }
    if (act === 'retry') { load(); return; }
    if (act === 'login') { await login(button); return; }
    if (act === 'more-pending' || act === 'more-approved') { await loadMore(button, act); return; }
    var card = button.closest('.card');
    if (!card) return;
    var item = findItem(card.getAttribute('data-id'));
    var sameHash = item ? num(item.sameHash) : 0;
    if (act === 'approve') { await approve(card, button, false); return; }
    if (act === 'approve-dupes') { await approve(card, button, true); return; }
    if (act === 'reject') { await reject(button, false, sameHash); return; }
    if (act === 'reject-dupes') { await reject(button, true, sameHash); return; }
    if (act === 'update-item') { await saveItem(card, button); return; }
    if (act === 'hide-item') { await hideItem(card, button); return; }
    if (act === 'restore-item') { await restoreItem(card, button); return; }
    if (act === 'delete-item') { await deleteItem(card, button); return; }
    if (act === 'merge-dupes') { await mergeDupes(card, button, sameHash); return; }
  }
  async function handleCatAct(node) {
    var act = node.getAttribute('data-cat-act');
    if (act === 'add') { await addCategory(node); return; }
    var row = node.closest('.cat');
    if (!row) return;
    var id = row.getAttribute('data-cat');
    if (act === 'manage') { toggleCatTools(row); return; }
    if (act === 'open') { openCategory(id); return; }
    if (!id) return;
    if (act === 'role') { await setRole(id, node.value, node); return; }
    if (act === 'rename') { await renameCategory(id, row, node); return; }
    if (act === 'up' || act === 'down') { await moveCategory(id, act, node); return; }
    if (act === 'hide') { await hideCategory(id, row, node); return; }
  }

  /* ================================================================ 加载 */
  function setKind(kind) {
    if (state.kind === kind) return;
    state.kind = kind;
    state.errors.items = '';
    state.errors.catalog = '';
    load();
  }
  function setTab(tab) {
    if (state.tab === tab) return;
    state.tab = tab;
    render();
  }
  function clearSearchInput() {
    state.q = '';
    var input = $('#search');
    if (input) input.value = '';
    updateSearchClear();
  }
  function clearSearch() {
    clearSearchInput();
    load();
  }
  function applyItems(payload) {
    state.pending = keepKind(payload.items || [], state.kind);
    state.pendingTotal = num(payload.total);
    if (payload.pendingByKind) {
      state.summary.pending = {
        face: num(payload.pendingByKind.face),
        logo: num(payload.pendingByKind.logo)
      };
    }
    if (payload.bankNames && payload.bankNames.length) state.bankNames = payload.bankNames;
  }
  function applyCatalog(payload) {
    state.cats = payload.categories || [];
    state.counts = payload.counts || {};
    state.orphans = num(payload.orphans);
    state.searching = payload.searching === true;
    if (payload.approvedByKind) {
      state.summary.approved = { face: num(payload.approvedByKind.face), logo: num(payload.approvedByKind.logo) };
    }
    if (payload.hiddenByKind) {
      state.summary.hidden = { face: num(payload.hiddenByKind.face), logo: num(payload.hiddenByKind.logo) };
    }
    var raw = payload.items || [];
    state.otherKindHits = raw.filter(function (item) { return item.kind && item.kind !== state.kind; }).length;
    state.approved = keepKind(raw, state.kind);
    state.approvedTotal = num(payload.total);
    state.hidden = keepKind(payload.hidden || [], state.kind);
    state.hiddenTotal = num(payload.hiddenTotal);
    if (payload.bankNames && payload.bankNames.length) state.bankNames = payload.bankNames;
  }
  async function load() {
    if (!state.usageLoaded) { state.usageLoaded = true; loadUsage(false); }
    if (state.password.ready === false || state.locked) { render(); return; }
    var seq = ++state.seq;
    state.loading = true;
    state.errors.items = '';
    state.errors.catalog = '';
    setProgress(true);
    if (!tabHasData()) renderPanel();
    var urls = [
      withQuery('/review/items', { kind: state.kind, limit: PENDING_PAGE, offset: 0, q: state.q }),
      withQuery('/review/catalog', {
        kind: state.kind,
        category: state.category[state.kind],
        limit: APPROVED_PAGE,
        offset: 0,
        q: state.q
      })
    ];
    var results = await Promise.all([jsonRequest(urls[0]), jsonRequest(urls[1])]);
    if (seq !== state.seq) return;
    var itemsResult = results[0];
    var catalogResult = results[1];
    if (itemsResult.status === 401 || catalogResult.status === 401) {
      saveToken('');
      state.locked = true;
      state.loading = false;
      setProgress(false);
      notice('口令不正确或已过期，请重新输入。', 'warn');
      render();
      return;
    }
    if (itemsResult.ok) {
      applyItems(itemsResult.payload || {});
    } else {
      state.pending = [];
      state.errors.items = failureText(itemsResult, '待处理列表');
    }
    if (catalogResult.ok) {
      applyCatalog(catalogResult.payload || {});
    } else {
      state.approved = [];
      state.hidden = [];
      state.searching = false;
      state.otherKindHits = 0;
      state.errors.catalog = failureText(catalogResult, '分类与已通过内容');
    }
    state.loading = false;
    setProgress(false);
    render();
  }
  async function boot() {
    initDialog();
    initPanelEvents();
    initTabs();
    initSearch();
    initTools();
    renderPanel();
    renderSubTabs();
    renderKindTabs();
    var info = null;
    try {
      var response = await fetch('/review/password');
      info = await response.json();
    } catch (error) { info = null; }
    if (!info) {
      state.errors.items = '读不到服务端的口令状态，请检查网络后重试。';
      render();
      return;
    }
    state.password = { ready: info.ready !== false, source: info.source || 'none', legacy: info.legacy === true };
    if (state.password.legacy) {
      notice('检测到旧版明文口令文件（review-password.txt），已忽略；口令以 REVIEW_PASSWORD 为准，建议在 R2 里删掉它。', 'warn');
    }
    if (!state.password.ready) { render(); return; }
    if (!readToken()) {
      state.locked = true;
      notice('这个后台需要审核口令。', 'info');
      render();
      return;
    }
    await load();
  }

  /* ================================================================ 交互 */
  function initPanelEvents() {
    var panel = $('#panel');
    panel.addEventListener('click', function (event) {
      var itemButton = event.target.closest('button[data-act]');
      if (itemButton) { handleItemAct(itemButton); return; }
      var catNode = event.target.closest('[data-cat-act]');
      if (catNode && catNode.tagName !== 'SELECT') handleCatAct(catNode);
    });
    panel.addEventListener('change', function (event) {
      var role = event.target.closest('select[data-cat-act="role"]');
      if (role) { handleCatAct(role); return; }
      var field = event.target.closest('select[data-field="category"]');
      if (field) updateRoleHint(field.closest('.card'));
    });
    panel.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || event.target.id !== 'new-cat-name') return;
      event.preventDefault();
      addCategory($('[data-cat-act="add"]'));
    });
  }
  function initTabs() {
    bindTablist($('#kind-tabs'), 'data-kind', function (value) { setKind(value); });
    bindTablist($('#tab-tabs'), 'data-tab', function (value) { setTab(value); });
  }
  function bindTablist(box, attribute, onSelect) {
    box.addEventListener('click', function (event) {
      var button = event.target.closest('button[role="tab"]');
      if (!button) return;
      onSelect(button.getAttribute(attribute));
    });
    box.addEventListener('keydown', function (event) {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key) < 0) return;
      var buttons = $$('button[role="tab"]', box);
      var index = buttons.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      var next = event.key === 'Home' ? 0
        : event.key === 'End' ? buttons.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
      onSelect(buttons[next].getAttribute(attribute));
    });
  }
  function initSearch() {
    var input = $('#search');
    var timer = 0;
    input.addEventListener('input', function () {
      var value = input.value.trim();
      updateSearchClear();
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (value === state.q) return;
        state.q = value;
        load();
      }, SEARCH_DEBOUNCE);
    });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && input.value) { event.preventDefault(); clearSearch(); }
    });
    $('#search-clear').addEventListener('click', function () { clearSearch(); input.focus(); });
    $('#change-password').addEventListener('click', changePassword);
    document.addEventListener('keydown', function (event) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      var tag = (event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || event.target.isContentEditable) return;
      event.preventDefault();
      input.focus();
      input.select();
    });
  }
  function formatBytes(value) {
    var n = num(value);
    if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return n + ' B';
  }
  /** R2 用量：服务端列出本桶对象求和（默认 30 分钟缓存，force 时重算）。 */
  async function loadUsage(force) {
    var line = $('#usage-line');
    if (!line) return;
    line.textContent = 'R2 存储：读取中…';
    var headers = {};
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    var response;
    try {
      response = await fetch('/review/usage' + (force ? '?refresh=1' : ''), { headers: headers });
    } catch (error) {
      line.textContent = 'R2 存储：读不到（网络错误）';
      return;
    }
    if (!response.ok) { line.textContent = 'R2 存储：读不到（' + response.status + '）'; return; }
    var data = await response.json().catch(function () { return null; });
    if (!data) { line.textContent = 'R2 存储：读不到（返回异常）'; return; }
    var used = num(data.bytes);
    var free = num(data.freeLimitBytes) || 10 * 1024 * 1024 * 1024;
    var detail = Object.keys(data.byPrefix || {}).sort().map(function (key) {
      var row = data.byPrefix[key] || {};
      return key + ' ' + formatBytes(row.bytes) + '／' + num(row.objects) + ' 个';
    }).join('、');
    line.textContent = 'R2 存储：已用 ' + formatBytes(used) + ' ／ 免费额度 ' + formatBytes(free)
      + '（还剩 ' + formatBytes(Math.max(0, free - used)) + '）· 共 ' + num(data.objects) + ' 个对象'
      + (detail ? '（' + detail + '）' : '')
      + (data.cached ? ' · 缓存于 ' + fmtTime(data.at) : ' · 刚刚更新');
  }
  function initTools() {
    $('#tool-restore').addEventListener('click', function () { restoreDefaults(this); });
    $('#tool-fix-kinds').addEventListener('click', function () { fixKinds(this); });
    var refresh = $('#usage-refresh');
    if (refresh) refresh.addEventListener('click', function () { loadUsage(true); });
  }

  boot();
})();
</script>
</body>
</html>`;
