# card-face

浏览器里的卡面设计工具。上传卡面、摆放支付 logo，导出 PNG。A browser card designer: upload a card, place payment logos, and export a PNG.

体验：[https://card.youmikk.me/](https://card.youmikk.me/)

页面本身是静态文件。自己上传并保存的卡面只留在这台浏览器里。「提交图片」和「提交 logo」会把素材送到审核，通过后出现在对应分类，不需要重新部署网站。
 [English](README.en.md)

## 用法

- 点选预装的纯色卡面，会直接导入预览。也可以上传自己的卡面图片。图片会铺满卡面，可以缩放和拖动调整构图。手机上可以在预览区域双指缩放，电脑上可以滚动鼠标滚轮缩放。
 - 点「保存」把当前做好的卡面放进保存区，缩略图包含已摆好的 logo。点缩略图可以再打开修改，再点保存会更新这一张。保存区的「全部导出」会把已保存的卡面逐张下载成 PNG。保存只存在这台浏览器里，清空网站数据后会消失。
- 没有卡面时可以浏览 logo，但不能添加。点选时会提示先上传卡面。
- 可以先选择银行，再选择它的标志或带名称的组合标识。素材库也包含支付标识和交通联合。
- 也可以一次上传多个自己的 logo（SVG、PNG、JPG、WebP）。
- 选中 logo 后可以拖动、缩放、旋转、调整透明度，也可以锁定、删除和调整图层顺序。
- 图层面板里，点名字选中 logo，点右侧按钮删除。按住名字并拖动可以调整叠放顺序，最上面的图层在最上层。
- 参考图叠在卡面之上、logo 之下，只用于对位，不会进入导出的 PNG。
- 圆角默认开启，同时作用于预览和导出。
- 支持中文 / English，以及浅色 / 深色。语言、主题和首次使用确认会记在本地。
- 首次打开时会显示使用条款。导出的 PNG 只是视觉设计文件。

直接打开 `index.html` 即可使用。

## 图标来源

- [svg-credit-card-payment-icons](https://github.com/aaronfagan/svg-credit-card-payment-icons)
- [payment-and-carrier-icons](https://github.com/Ricki-BumbleDev/payment-and-carrier-icons)
- [card-logos](https://github.com/Yaqioooong/card-logos)
- [SVGLOGO](https://github.com/HeyHuazi/SVGLOGO)

这些标识只用于设计预览。公开使用前请确认你有相应授权。导出的文件只是视觉设计，不代表任何机构发行的卡片。

## 提交素材

「提交图片」和「提交 logo」会把文件上传到审核服务（Cloudflare Worker，`review.youmikk.me`），先放进私有存储；只有审核通过后才会公开出现在对应分类里，未通过的内容不会公开。提交前必须在表单里勾选确认第七条（图片会上传，通过后会公开）。卡面可选纯色、银行、交通、其他；logo 沿用现有分类，角色为「银行」的分类要填银行名称（可以从内置银行列表里选，也可以自己填一个新名称，新银行会以这张图作为图标出现在站点上）。不要提交带卡号、姓名或真实银行卡照片的图片。

审核服务在 `intake/`，部署步骤和安全说明见 `intake/README.md`。**部署前必须先执行 `npx wrangler secret put REVIEW_PASSWORD`（至少 12 位）**：没有配置口令时审核接口会返回 503 直接关闭。审核页在 `<worker 地址>/review`，口令只能通过该页面用当前口令轮换。

## 安全说明

- 站点是纯静态托管，图片编辑、参考图对位和导出都在浏览器里完成；只有「提交」功能会把图片发到审核服务。
- `_headers` 已开启 CSP、`nosniff`、`no-referrer` 与 `frame-ancestors`。修改 `app.js` / `styles.css` 后请同步更新 `index.html` 里的 `?v=` 版本号（这两个文件按长期缓存下发）。
- 服务器端的安全约定、限速建议与旧版本升级步骤见 `intake/README.md`。
