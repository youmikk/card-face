# card-face

浏览器里的卡面设计工具。上传卡面、摆放支付 logo，导出 PNG。A browser card designer: upload a card, place payment logos, and export a PNG.

体验：[https://card.youmikk.me/](https://card.youmikk.me/)

纯静态页面，不需要后端。
 [English](README.en.md)

## 用法

- 点选预装的纯色卡面，会直接导入预览。也可以上传自己的卡面图片。图片会铺满卡面，可以缩放和拖动调整构图。手机上可以在预览区域双指缩放，电脑上可以滚动鼠标滚轮缩放。
 - 点「保存」把当前做好的卡面放进保存区，缩略图包含已摆好的 logo。点缩略图可以再打开修改，再点保存会更新这一张。保存区的「全部导出」会把已保存的卡面逐张下载成 PNG。保存只存在这台浏览器里，清空网站数据后会消失。上传的图片不会发到服务器。
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
