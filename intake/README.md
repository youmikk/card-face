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
| `GET /manifest` | 公开清单（已通过且未隐藏的条目 + 分类） |
| `POST /submit` | 提交素材（限速 20 次/小时/IP，队列上限 300 条待审） |
| `GET /files/<id>` | 公开读取已通过的文件 |
| `GET /review` | 审核页面（需要口令） |
| `GET/POST /review/items` | 待审列表 / 通过、拒绝 |
| `GET/POST /review/catalog` | 分类、角色、隐藏与恢复 |
| `GET/POST /review/password` | 口令状态 / 轮换（轮换需要当前口令） |
| `GET /review/file/<id>` | 预览待审文件（需要口令） |

## 安全设计

- 口令只来自 `REVIEW_PASSWORD`；比较前双方都做 SHA-256，再做定长时间比较，并按 IP 限制失败次数（10 次 / 10 分钟）。
- 审核页右上角「修改口令」可以随时轮换，轮换接口要求先通过当前口令认证；R2 里只写 `sha256:<hash>`，从不写明文。
- 上传内容按魔术字节判定真实类型（PNG / JPEG / WebP / SVG），不信任客户端声明的 MIME。SVG 会拒绝 `<script>`、`on*=`、`javascript:`、`foreignObject`、外链 `href`/`url()` 等构造（命中即拒绝，不做改写）。位图限制单边 12000 px、总量 4000 万像素以内。
- `/files/*` 与 `/review/file/*` 的响应带 `X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer` 和 `Content-Security-Policy: … sandbox`，即使有人直接打开也无法执行脚本。审核页自身使用 nonce + CSP，不加载任何外部资源。
- `records.json` / `catalog.json` 用 R2 条件写（ETag）做乐观锁，并发提交不会互相覆盖；如果运行时缺少 `onlyIf` 能力，会自动降级为普通写入（此时并发提交有极小概率丢记录，建议部署后按下节验证）。
- 拒绝某个提交时立即删除服务器上的文件；被拒绝的记录 30 天后清理，隐藏超过 30 天的内容连同文件一起删除。
- 删除分类或隐藏条目都是软删除（`status=hidden` + `catalog.hidden`），审核页「已隐藏」区可以一键恢复。

## 部署后建议验证

1. `curl -i https://<worker 地址>/review/items` 应返回 503（未配口令）或 401（配了口令），绝不能是 200。
2. `curl -i -X POST https://<worker 地址>/review/password -H 'content-type: application/json' -d '{"password":"attacker-password"}'` 应返回 503/401，且 R2 里不出现 `review-password.txt`。
3. 并发提交几张图片，确认审核列表里条数一致（验证条件写是否生效）。

## 建议额外配置

- 在 Cloudflare 面板给 `/review/*` 与 `/submit` 加 Rate Limiting 规则，或直接给 `/review` 挂 Cloudflare Access（最稳妥）。
- 关闭 `workers.dev` 子域、只保留自定义域名，减少暴露面。

## 审核

打开 `https://<worker 地址>/review`，输入口令。可以改分类名与角色（普通 / 银行 / 其他）、改条目名称、隐藏与恢复内容，以及通过或拒绝。通过后的图片任何人可读；拒绝的文件会被删除。

不要通过带卡号、姓名或真实银行卡照片的卡面。

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

测试覆盖类型判定、SVG 净化、像素上限、口令与限速、并发提交不丢记录、软删除与恢复、越权访问等。
