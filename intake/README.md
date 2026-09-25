# 提交审核

页面上的「提交图片 / 提交 logo」会把文件发到这个 Worker。文件先放进私有 R2，审核通过后才会出现在公开清单里。站点本身仍是 Cloudflare Pages，不需要为每次通过重新部署。

## 准备

1. 安装并登录 Wrangler：`npx wrangler login`
2. 创建标准存储桶：`npx wrangler r2 bucket create card-face-intake`
3. **先设置审核口令**（必须，最短 12 位）：`npx wrangler secret put REVIEW_PASSWORD`
4. 在 `intake/` 目录部署：`npx wrangler deploy`

顺序很重要：没有配置 `REVIEW_PASSWORD` 时，所有 `/review/*` 接口都会返回 503 而无法使用。这是故意的——旧版本允许任何人在页面上「首次设置口令」，等于把后台交给第一个访问者。

部署后终端会打印 `*.workers.dev` 地址。如果它不是 `review.youmikk.me`，只改 `app.js` 顶部的 `INTAKE`。

## 接口

| 路径 | 说明 |
| --- | --- |
| `GET /manifest` | 公开清单（已通过条目 + 分类），读派生对象 `manifest.json`，带 ETag |
| `POST /submit` | 提交素材（限速 20 次/小时/IP，待审上限 300 条，银行编号必须在白名单里） |
| `GET /files/<id>` | 公开读取已通过的文件（带 ETag，30 天 stale-while-revalidate） |
| `GET /review` | 审核页面（需要口令） |
| `GET /review/items` | 待审列表：`?q=` 搜索、`?limit=&offset=` 分页，返回 `total` 与 `banks` |
| `POST /review/items` | `approve` / `reject`（拒绝会删掉文件，记录保留 30 天） |
| `GET /review/catalog` | 分类、每类计数、隐藏列表、银行白名单；`?kind=&category=&q=&limit=&offset=` |
| `POST /review/catalog` | `add-category` / `rename-category` / `set-role` / `move-category` / `remove-category`（软删除）/ `update-item`（详细编辑）/ `hide-item` / `restore-item` / `delete-item`（彻底删除） |
| `GET/POST/DELETE /review/password` | 口令状态 / 轮换（需当前口令）/ 清除 R2 哈希回到 env 控制 |
| `GET /review/file/<id>` | 预览待审、已通过或已隐藏的文件（需要口令） |

## 安全设计

- 口令只来自 `REVIEW_PASSWORD`；比较前双方都做 SHA-256，再做定长时间比较，并按 IP 限制失败次数（10 次 / 10 分钟）。
- 审核页右上角「修改口令」可随时轮换，轮换要求先通过当前口令认证；R2 里只写 `sha256:<hash>`，从不写明文。`DELETE /review/password` 可让口令回到 env 控制。
- 上传内容按魔术字节判定真实类型（PNG / JPEG / WebP / SVG），不信任客户端声明的 MIME。SVG 会拒绝 `<script>`、`on*=`、`javascript:`、`foreignObject`、外链 `href`/`url()` 等构造（命中即拒绝，不做改写）。位图限制单边 12000 px、总量 4000 万像素以内。
- **银行编号按白名单校验**（`BANK_IDS`，与 `app.js` 的 `bankIndex` 同步）：格式合法但不存在的编号（例如 `ICBX`）会被拒绝，避免"审核通过后在站点上永远显示不出来"；历史上已经存在的编号仍可继续编辑。
- 提交时记录 `width/height/size/hash`（内容指纹）与 `reviewedAt`；审核台会显示这些元数据，公开清单里的初始 logo 宽度按真实高宽比换算（不再是固定 132）。
- `/files/*` 与 `/review/file/*` 带 `X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`、`Content-Security-Policy: … sandbox` 和 `ETag`（配合 `If-None-Match` 返回 304）。审核页自身使用 nonce + CSP，不加载任何外部资源。
- `records.json` / `catalog.json` 用 R2 条件写（ETag）做乐观锁，并发提交不会互相覆盖；运行时缺少 `onlyIf` 时自动降级为普通写入并打 `console.warn`。
- 可见性只有一个真相：`item.status`（`pending` / `approved` / `rejected` / `hidden`）。拒绝立即删文件、记录留 30 天；隐藏 30 天后连同文件一起删除；`delete-item` 是立即彻底删除。
- `GET /manifest` 读的是派生对象 `manifest.json`（每次状态变更后重建，带 ETag 和 60 秒缓存），前台访问不再解析整份记录；派生对象缺失时会即时构建自愈。
- 例行维护（打开审核页时触发）：清理"有对象、没记录"的孤儿文件（超过 1 天）、每天留一份 `backups/records-<日期>.json` 备份。

## 部署后建议验证

1. `curl -i https://<worker 地址>/review/items` 应返回 503（未配口令）或 401（配了口令），绝不能是 200。
2. `curl -i -X POST https://<worker 地址>/review/password -H 'content-type: application/json' -d '{"password":"attacker-password"}'` 应返回 503/401，且 R2 里不出现 `review-password.txt`。
3. 并发提交几张图片，确认审核列表里条数一致（验证条件写是否生效）。

## 建议额外配置

- 在 Cloudflare 面板给 `/review/*` 与 `/submit` 加 Rate Limiting 规则，或直接给 `/review` 挂 Cloudflare Access（最稳妥）。
- `intake/wrangler.json` 已设 `workers_dev: false`，只保留自定义域名；若面板里还挂着 `*.workers.dev` 路由，可以删掉。

## 审核台能做什么

打开 `https://<worker 地址>/review`，输入口令。每条素材都是一张可编辑卡片：

- **详细编辑**：改名称、改分类（换分组）、改银行编号（下拉）、改备注。待审条目点「通过」时一并生效；已通过 / 已隐藏条目点「保存修改」。
- **搜索**：顶部搜索框按 名称 / 备注 / 银行编号 / ID 过滤（服务端过滤，300ms 防抖）。
- **元数据**：每张卡片显示提交时间、审核时间、像素尺寸、文件大小、类型、内容指纹前 10 位、当前状态。
- **三种移除**：`隐藏`（软删除，30 天内可「恢复」）、`拒绝并删除文件`（待审专用，文件立即删、记录留 30 天）、`彻底删除`（文件与记录一起移除，不可恢复，需二次确认）。
- **分类管理**：改名、上/下移、设置角色（普通 / 银行 / 其他）、隐藏整个分类（其中条目转为隐藏，可逐个恢复）；分类行显示条目数量。
- 列表超过一屏时可点「加载更多」（服务端分页，每页 60 / 80 条）。

不要通过带卡号、姓名或真实银行卡照片的卡面。

## 新增银行后要做什么

`BANK_IDS` 是 `app.js` 里 `bankIndex` 的快照（154 家）。新增银行后请重新生成并粘回 `intake/src/index.js`：

```sh
node -e 'const fs=require("node:fs");const src=fs.readFileSync("app.js","utf8");const line=src.split(/\r?\n/).find(l=>l.trim().startsWith("const bankIndex"));const ids=[...new Set(JSON.parse(line.slice(line.indexOf("["),line.lastIndexOf("]")+1)).map(b=>b.id))].sort();console.log(JSON.stringify(ids))'
```

否则审核页的银行下拉里选不到新银行（服务端也会拒绝提交）。

## 从旧版本升级

旧版本允许在页面上设置口令，并把它明文写进 R2 的 `review-password.txt`。现在这种明文文件会被忽略（审核页会提示 legacy）。升级步骤：

1. `npx wrangler secret put REVIEW_PASSWORD` 并重新部署；
2. 在 R2 里删除 `review-password.txt`；
3. 若怀疑口令曾被他人设置过，删除该文件后即恢复由 `REVIEW_PASSWORD` 控制。

## 测试

```sh
cd intake
npm test    # node --test，无外部依赖
```

`main` 分支已配 GitHub Actions（`.github/workflows/ci.yml`）：每次 push / PR 会自动跑这套测试。

测试覆盖类型判定、SVG 净化、像素上限、口令与限速、并发不丢记录、软删除与恢复、越权访问，以及后台详细编辑、彻底删除、搜索分页、银行白名单、ETag 304、孤儿清扫与每日备份。
