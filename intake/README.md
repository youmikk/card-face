# 提交审核

页面上的「提交图片 / 提交 logo」会把文件发到这个 Worker。文件先放进私有 R2，审核通过后才会出现在公开清单里。站点本身仍是 Cloudflare Pages，不需要为每次通过重新部署。

## 准备

1. 安装并登录 Wrangler：`npx wrangler login`
2. 创建标准存储桶：`npx wrangler r2 bucket create card-face-intake`
3. 设置审核密码（只存在 Cloudflare，不进仓库、不进页面）：

```
npx wrangler secret put REVIEW_PASSWORD
```

4. 在 `intake/` 目录部署：`npx wrangler deploy`

部署后终端会打印 `*.workers.dev` 地址。如果它不是 `card-face-intake.youmikk.workers.dev`，只改 `app.js` 里的 `INTAKE`。

## 审核

打开 `https://<worker 地址>/review`，输入上面的密码。可以改分类、通过或拒绝。通过后的图片任何人都能读取；拒绝的文件仍是私有的，也不会出现在清单里。

不要通过带卡号、姓名或真实银行卡照片的卡面。
