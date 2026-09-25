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
    groups: { official: "卡组织素材", payment: "支付方式", banks: "银行", transit: "交通联合", bankMark: "标志", bankLockup: "组合" },
    locked: "已锁定",
    logoReady: "可多选，支持 SVG、PNG、JPG、WebP",
    logoNeed: "请先上传卡面图片",
    none: "暂无 logo",
    saved: "已保存",
     saveKept: "已保存。原图较大，下次打开只用缩略图。",
     saveFailed: "保存失败，请删掉一些已保存的卡面后再试。",
     exportFailed: "导出失败，请换一张卡面后再试。",
     submitSent: "已提交，审核通过后会出现在对应分类里。",
     submitFailed: "提交失败，请稍后再试。",
     submitBig: "图片不能超过 4 MB。",
     submitType: "请使用 PNG、JPG、WebP 或 SVG。",
     nothingSaved: "保存区还是空的",
     exportDone: "已开始下载",
     replaceTitle: "换卡面会清掉上面的 logo",
     replaceText: "当前摆放不会保留。要继续吗？",
     cardName: "卡面",
  },
  en: {
    styles: { flat: "Flat", "flat-rounded": "Rounded", logo: "Logo", "logo-border": "Border", mono: "Mono", "mono-outline": "Outline" },
    brands: { visa: "Visa", mastercard: "Mastercard", amex: "American Express", unionpay: "UnionPay", jcb: "JCB", discover: "Discover", diners: "Diners", alipay: "Alipay", paypal: "PayPal", maestro: "Maestro", elo: "Elo", mir: "Mir", generic: "Generic" },
    payments: { applePay: "Apple Pay", googlePay: "Google Pay", weChatPay: "WeChat Pay", visa: "Visa", mastercard: "Mastercard", amex: "Amex", unionPay: "UnionPay", alipay: "Alipay", payPal: "PayPal", jcb: "JCB", discover: "Discover", klarna: "Klarna" },
    groups: { official: "Brand assets", payment: "Payments", banks: "Banks", transit: "T-Union", bankMark: "Mark", bankLockup: "Lockup" },
    locked: "Locked",
    logoReady: "Multiple files: SVG, PNG, JPG, WebP",
    logoNeed: "Upload a card image first",
    none: "No logos yet",
    saved: "Saved",
     saveKept: "Saved. The photo was large, so reopening uses the thumbnail.",
     saveFailed: "Could not save. Delete some saved cards and try again.",
     exportFailed: "Export failed. Try another card image.",
     submitSent: "Submitted. It appears in that category after review.",
     submitFailed: "Could not submit. Try again later.",
     submitBig: "The image must be 4 MB or smaller.",
     submitType: "Use a PNG, JPG, WebP, or SVG.",
     nothingSaved: "Nothing saved yet",
     exportDone: "Download started",
     replaceTitle: "Changing the card removes its logos",
     replaceText: "The current layout will not be kept. Continue?",
     cardName: "Card",
  },
};
const uiText = {
   zh: { title: "卡面设计生成器", theme: "深色", themeLight: "浅色", github: "GitHub 项目", support: "赞赏", afdian: "爱发电", wechatSupport: "微信赞赏码", close: "关闭", termsTitle: "使用条款", termsAccept: "我已阅读并同意", preview: "卡面预览", save: "保存", export: "导出 PNG", exportAll: "全部导出", savedCards: "保存区", emptyTitle: "上传一张图片作为卡面", emptyText: "图片会按 1.586 : 1 铺满并居中，之后可以缩放和拖动调整构图。", choose: "选择图片", requestFace: "提交卡面", rounded: "3.18 mm 圆角", dragCard: "拖动卡面", dragRef: "拖动参考图", resetZoom: "复原", clear: "清空", uploadLogo: "上传自己的 logo", requestLogo: "提交 logo", banks: "银行", cardImage: "卡面图片", dropCard: "拖拽图片到此处，或点击选择", refit: "重新匹配", zoom: "缩放", cardNote: "图片会等比缩放并居中填满卡面，超出部分自动裁掉。", saveNote: "点保存记下当前卡面。点缩略图可以再打开修改。只存在这台浏览器里。", reference: "参考图", dropRef: "拖拽参考图到此处，或点击选择", refHint: "只用于对位，不会出现在导出的 PNG 里", showRef: "显示参考图", opacity: "透明度", adjust: "调整", selectLogo: "点击卡面上的 logo 进行编辑", size: "大小", rotate: "旋转", lock: "锁定", up: "上移", down: "下移", delete: "删除", layers: "图层", noLogo: "暂无 logo", legal: "输出只是视觉设计文件，不代表任何机构发行的卡片。图标来自公开素材库，使用前请确认你有相应授权。", submitTitle: "提交", submitName: "名称", submitKind: "类型", submitCategory: "分类", submitCustom: "自定义分类", submitFile: "图片", submitSend: "发送", kindFace: "卡面", kindLogo: "Logo", catSolid: "纯色", catBank: "银行", catTransit: "交通", catOther: "其他", submitFaceNote: "不要提交带卡号、姓名或真实银行卡照片的图片。审核通过后才会公开。", submitLogoNote: "只提交你有权公开使用的标识。审核通过后才会公开。" },
   en: { title: "Card Design Generator", theme: "Dark", themeLight: "Light", github: "GitHub project", support: "Support", afdian: "Afdian", wechatSupport: "WeChat", close: "Close", termsTitle: "Terms of use", termsAccept: "I have read and agree", preview: "Card preview", save: "Save", export: "Export PNG", exportAll: "Export all", savedCards: "Saved", emptyTitle: "Upload an image for the card", emptyText: "The image fills the 1.586:1 card and can then be zoomed and dragged.", choose: "Choose image", requestFace: "Submit a card", rounded: "3.18 mm corners", dragCard: "Move card", dragRef: "Move reference", resetZoom: "Reset zoom", clear: "Clear", uploadLogo: "Upload your own logos", requestLogo: "Submit a logo", banks: "Banks", cardImage: "Card image", dropCard: "Drop an image here, or click to choose", refit: "Refit", zoom: "Zoom", cardNote: "The image is scaled and centered to fill the card. Overflow is cropped.", saveNote: "Save stores the current card. Open a thumbnail to edit it again. It stays in this browser only.", reference: "Reference", dropRef: "Drop a reference here, or click to choose", refHint: "Used for alignment only. It is not included in the PNG.", showRef: "Show reference", opacity: "Opacity", adjust: "Adjust", selectLogo: "Click a logo on the card to edit it", size: "Size", rotate: "Rotate", lock: "Lock", up: "Up", down: "Down", delete: "Delete", layers: "Layers", noLogo: "No logos yet", legal: "The output is a visual design file only. Logos come from public asset libraries; confirm permission before publishing.", submitTitle: "Submit", submitName: "Name", submitKind: "Type", submitCategory: "Category", submitCustom: "Custom category", submitFile: "Image", submitSend: "Send", kindFace: "Card", kindLogo: "Logo", catSolid: "Solid", catBank: "Bank", catTransit: "Transit", catOther: "Other", submitFaceNote: "Do not submit card numbers, names, or photos of real bank cards. It stays private until it is approved.", submitLogoNote: "Submit only marks you have the right to publish. It stays private until it is approved." },
};
let language = localStorage.getItem("card-lang") || "zh";
const copy = () => dictionaries[language];
const terms = {
  zh: [
    ["一、独立工具", "本网站是独立的卡面设计工具，与 Apple、Visa、Mastercard、银联、交通联合及任何银行、支付机构或交通机构不存在合作、授权、隶属或背书关系。第三方商标及相关权利归各自权利人所有。"],
    ["二、你对自己上传的内容负责", "你上传的卡面、参考图、logo 和文字由你负责。本网站不会也无法核验这些内容的权利状态。"],
    ["三、商标与第三方权利", "如果内容包含他人的商标、品牌标识、美术作品或肖像，你应确保已有合法依据或必要授权，并自行承担责任。请勿移除或篡改他人的权利标记。"],
    ["四、素材库", "网站提供的银行、支付和交通标识只用于设计预览，不构成任何授权。公开使用前，请自行确认你有相应权利。"],
    ["五、禁止用途", "不得将本网站或其导出结果用于伪造、仿冒真实卡片，或用于欺诈、身份冒用、洗钱及其他违法活动。"],
    ["六、输出的性质", "导出的 PNG 只是视觉设计文件，不代表任何机构发行的支付卡、交通卡或其他凭证，也不能用于制作可交易或可验证的凭证。设计稿、艺术卡、收藏卡等非凭证用途不在此限。"],
     ["七、本地处理", "图片处理和导出都在你的浏览器本地完成，上传内容不会发送到服务器。点保存后的卡面只存在这台浏览器里，清除站点数据后会消失。请自行保管导出结果。"],
    ["八、按现状提供", "本网站按现状提供，不对导出结果的合法性、准确性或适用性作出保证。"],
    ["九、条款变更", "本条款可能更新。更新后继续使用，即视为接受更新后的内容。"],
  ],
  en: [
    ["1. An independent tool", "This is an independent card-design tool. It is not affiliated with, endorsed by, or authorized by Apple, Visa, Mastercard, UnionPay, T-Union, or any bank, payment network, or transit operator. Third-party marks belong to their owners."],
    ["2. You are responsible for uploads", "You are responsible for every card image, reference, logo, and text you upload. This site cannot verify who owns that content."],
    ["3. Trademarks and other rights", "If content includes someone else’s trademark, artwork, or portrait, make sure you have a lawful basis or the required permission. Do not remove or alter rights notices."],
    ["4. The asset library", "Bank, payment, and transit marks supplied here are layout previews only. They are not a license, and you must confirm your own right before publishing them."],
    ["5. Prohibited use", "Do not use the site or its output to forge or imitate a real card, or for fraud, impersonation, money laundering, or any unlawful activity."],
    ["6. What the output is", "An exported PNG is only a visual design file. It is not an issued payment, transit, or other credential, and it must not be made into one that can be used for a transaction. Design drafts, art cards, and collectible cards are outside this limit."],
     ["7. Local processing", "Editing and export happen in your browser. Uploads are not sent to a server. Cards you save stay in this browser until its site data is cleared. Keep your own copy of anything you export."],
    ["8. Provided as is", "The site is provided as is, without any warranty that the output is lawful, accurate, or suitable for a particular purpose."],
    ["9. Changes", "These terms may be updated. Continuing to use the site after an update means you accept the updated terms."],
  ],
};

function renderTerms() {
  const body = document.querySelector("#terms-body");
  body.replaceChildren();
  terms[language].forEach(([heading, text]) => {
    const title = document.createElement("h3");
    title.textContent = heading;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    body.append(title, paragraph);
  });
}


const bankIndex = [{"id":"BOSC","name":"上海银行","icon":"assets/banks/BOSC.svg","wordmark":"assets/banks/BOSC_wordmark.svg"},{"id":"SRBANK","name":"上饶银行","icon":"assets/banks/SRBANK.svg"},{"id":"BOD","name":"东莞银行","icon":"assets/banks/BOD.svg","wordmark":"assets/banks/BOD_wordmark.svg"},{"id":"DYCCB","name":"东营银行","icon":"assets/banks/DYCCB.svg","wordmark":"assets/banks/DYCCB_wordmark.svg"},{"id":"CITIC","name":"中信银行","icon":"assets/banks/CITIC.svg","wordmark":"assets/banks/CITIC_wordmark.svg"},{"id":"ZYBANK","name":"中原银行","icon":"assets/banks/ZYBANK.svg","wordmark":"assets/banks/ZYBANK_wordmark.svg"},{"id":"PBOC","name":"中国人民银行","icon":"assets/banks/PBOC.svg","wordmark":"assets/banks/PBOC_wordmark.svg"},{"id":"CEB","name":"中国光大银行","icon":"assets/banks/CEB.svg","wordmark":"assets/banks/CEB_wordmark.svg"},{"id":"ADBC","name":"中国农业发展银行","icon":"assets/banks/ADBC.svg"},{"id":"ABC","name":"中国农业银行","icon":"assets/banks/ABC.svg","wordmark":"assets/banks/ABC_wordmark.svg"},{"id":"ICBC","name":"中国工商银行","icon":"assets/banks/ICBC.svg","wordmark":"assets/banks/ICBC_wordmark.svg"},{"id":"CCB","name":"中国建设银行","icon":"assets/banks/CCB.svg","wordmark":"assets/banks/CCB_wordmark.svg"},{"id":"CMBC","name":"中国民生银行","icon":"assets/banks/CMBC.svg","wordmark":"assets/banks/CMBC_wordmark.svg"},{"id":"EIBOF","name":"中国进出口银行","icon":"assets/banks/EIBOF.svg","wordmark":"assets/banks/EIBOF_wordmark.svg"},{"id":"PSBC","name":"中国邮政储蓄银行","icon":"assets/banks/PSBC.svg","wordmark":"assets/banks/PSBC_wordmark.svg"},{"id":"BOC","name":"中国银行","icon":"assets/banks/BOC.svg","wordmark":"assets/banks/BOC_wordmark.svg"},{"id":"LSBC","name":"临商银行","icon":"assets/banks/LSBC.svg","wordmark":"assets/banks/LSBC_wordmark.svg"},{"id":"BODD","name":"丹东银行","icon":"assets/banks/BODD.svg","wordmark":"assets/banks/BODD_wordmark.svg"},{"id":"WHBANK","name":"乌海银行","icon":"assets/banks/WHBANK.svg","wordmark":"assets/banks/WHBANK_wordmark.svg"},{"id":"UCCB","name":"乌鲁木齐市商业银行","icon":"assets/banks/UCCB.svg","wordmark":"assets/banks/UCCB_wordmark.svg"},{"id":"LSCCB","name":"乐山市商业银行","icon":"assets/banks/LSCCB.svg","wordmark":"assets/banks/LSCCB_wordmark.svg"},{"id":"JJCCB","name":"九江银行","icon":"assets/banks/JJCCB.svg","wordmark":"assets/banks/JJCCB_wordmark.svg"},{"id":"YNHTBANK","name":"云南红塔银行","icon":"assets/banks/YNHTBANK.svg","wordmark":"assets/banks/YNHTBANK_wordmark.svg"},{"id":"COMM","name":"交通银行","icon":"assets/banks/COMM.svg","wordmark":"assets/banks/COMM_wordmark.svg"},{"id":"BOBD","name":"保定银行","icon":"assets/banks/BOBD.svg","wordmark":"assets/banks/BOBD_wordmark.svg"},{"id":"LZBANK","name":"兰州银行","icon":"assets/banks/LZBANK.svg","wordmark":"assets/banks/LZBANK_wordmark.svg"},{"id":"CIB","name":"兴业银行","icon":"assets/banks/CIB.svg","wordmark":"assets/banks/CIB_wordmark.svg"},{"id":"H3CB","name":"内蒙古银行","icon":"assets/banks/H3CB.svg"},{"id":"BOB","name":"北京银行","icon":"assets/banks/BOB.svg","wordmark":"assets/banks/BOB_wordmark.svg"},{"id":"HXB","name":"华夏银行","icon":"assets/banks/HXB.svg","wordmark":"assets/banks/HXB_wordmark.svg"},{"id":"HRXJB","name":"华融湘江银行","icon":"assets/banks/HRXJB.svg","wordmark":"assets/banks/HRXJB_wordmark.svg"},{"id":"NJCB","name":"南京银行","icon":"assets/banks/NJCB.svg","wordmark":"assets/banks/NJCB_wordmark.svg"},{"id":"XMINTB","name":"厦门国际银行","icon":"assets/banks/XMINTB.svg","wordmark":"assets/banks/XMINTB_wordmark.svg"},{"id":"XMBANK","name":"厦门银行","icon":"assets/banks/XMBANK.svg","wordmark":"assets/banks/XMBANK_wordmark.svg"},{"id":"TZBANK","name":"台州银行","icon":"assets/banks/TZBANK.svg","wordmark":"assets/banks/TZBANK_wordmark.svg"},{"id":"BOJL","name":"吉林银行","icon":"assets/banks/BOJL.svg","wordmark":"assets/banks/BOJL_wordmark.svg"},{"id":"HMCCB","name":"哈密市商业银行","icon":"assets/banks/HMCCB.svg","wordmark":"assets/banks/HMCCB_wordmark.svg"},{"id":"HRBCB","name":"哈尔滨银行","icon":"assets/banks/HRBCB.svg","wordmark":"assets/banks/HRBCB_wordmark.svg"},{"id":"BOTS","name":"唐山银行","icon":"assets/banks/BOTS.svg","wordmark":"assets/banks/BOTS_wordmark.svg"},{"id":"JXBANK","name":"嘉兴银行","icon":"assets/banks/JXBANK.svg","wordmark":"assets/banks/JXBANK_wordmark.svg"},{"id":"SCTFB","name":"四川天府银行","icon":"assets/banks/SCTFB.svg","wordmark":"assets/banks/SCTFB_wordmark.svg"},{"id":"SCB","name":"四川银行","icon":"assets/banks/SCB.svg","wordmark":"assets/banks/SCB_wordmark.svg"},{"id":"CDB","name":"国家开发银行","icon":"assets/banks/CDB.svg","wordmark":"assets/banks/CDB_wordmark.svg"},{"id":"DTB","name":"大同银行","icon":"assets/banks/DTB.svg","wordmark":"assets/banks/DTB_wordmark.svg"},{"id":"DLB","name":"大连银行","icon":"assets/banks/DLB.svg","wordmark":"assets/banks/DLB_wordmark.svg"},{"id":"BOTJ","name":"天津银行","icon":"assets/banks/BOTJ.svg","wordmark":"assets/banks/BOTJ_wordmark.svg"},{"id":"WHCCB","name":"威海市商业银行","icon":"assets/banks/WHCCB.svg","wordmark":"assets/banks/WHCCB_wordmark.svg"},{"id":"NXBANK","name":"宁夏银行","icon":"assets/banks/NXBANK.svg","wordmark":"assets/banks/NXBANK_wordmark.svg"},{"id":"NDHB","name":"宁波东海银行","icon":"assets/banks/NDHB.svg"},{"id":"NBCMB","name":"宁波通商银行","icon":"assets/banks/NBCMB.svg","wordmark":"assets/banks/NBCMB_wordmark.svg"},{"id":"NBCB","name":"宁波银行","icon":"assets/banks/NBCB.svg","wordmark":"assets/banks/NBCB_wordmark.svg"},{"id":"YBCCB","name":"宜宾市商业银行","icon":"assets/banks/YBCCB.svg","wordmark":"assets/banks/YBCCB_wordmark.svg"},{"id":"FDBANK","name":"富滇银行","icon":"assets/banks/FDBANK.svg","wordmark":"assets/banks/FDBANK_wordmark.svg"},{"id":"SPABANK","name":"平安银行","icon":"assets/banks/SPABANK.svg","wordmark":"assets/banks/SPABANK_wordmark.svg"},{"id":"BOP","name":"平顶山银行","icon":"assets/banks/BOP.svg","wordmark":"assets/banks/BOP_wordmark.svg"},{"id":"GHB","name":"广东华兴银行","icon":"assets/banks/GHB.svg","wordmark":"assets/banks/GHB_wordmark.svg"},{"id":"NYBANK","name":"广东南粤银行","icon":"assets/banks/NYBANK.svg","wordmark":"assets/banks/NYBANK_wordmark.svg"},{"id":"GDB","name":"广发银行","icon":"assets/banks/GDB.svg","wordmark":"assets/banks/GDB_wordmark.svg"},{"id":"GZCB","name":"广州银行","icon":"assets/banks/GZCB.svg","wordmark":"assets/banks/GZCB_wordmark.svg"},{"id":"BGB","name":"广西北部湾银行","icon":"assets/banks/BGB.svg","wordmark":"assets/banks/BGB_wordmark.svg"},{"id":"KCCCB","name":"库尔勒市商业银行","icon":"assets/banks/KCCCB.svg","wordmark":"assets/banks/KCCCB_wordmark.svg"},{"id":"BOLF","name":"廊坊银行","icon":"assets/banks/BOLF.svg","wordmark":"assets/banks/BOLF_wordmark.svg"},{"id":"ZJKCCB","name":"张家口银行","icon":"assets/banks/ZJKCCB.svg","wordmark":"assets/banks/ZJKCCB_wordmark.svg"},{"id":"DZBANK","name":"德州银行","icon":"assets/banks/DZBANK.svg","wordmark":"assets/banks/DZBANK_wordmark.svg"},{"id":"HSBANK","name":"徽商银行","icon":"assets/banks/HSBANK.svg","wordmark":"assets/banks/HSBANK_wordmark.svg"},{"id":"EGBANK","name":"恒丰银行","icon":"assets/banks/EGBANK.svg","wordmark":"assets/banks/EGBANK_wordmark.svg"},{"id":"CDCB","name":"成都银行","icon":"assets/banks/CDCB.svg","wordmark":"assets/banks/CDCB_wordmark.svg"},{"id":"CDBANK","name":"承德银行","icon":"assets/banks/CDBANK.svg","wordmark":"assets/banks/CDBANK_wordmark.svg"},{"id":"FSCB","name":"抚顺银行","icon":"assets/banks/FSCB.svg","wordmark":"assets/banks/FSCB_wordmark.svg"},{"id":"CMB","name":"招商银行","icon":"assets/banks/CMB.svg","wordmark":"assets/banks/CMB_wordmark.svg"},{"id":"XJHB","name":"新疆汇和银行","icon":"assets/banks/XJHB.svg","wordmark":"assets/banks/XJHB_wordmark.svg"},{"id":"XJB","name":"新疆银行","icon":"assets/banks/XJB.svg"},{"id":"RZB","name":"日照银行","icon":"assets/banks/RZB.svg","wordmark":"assets/banks/RZB_wordmark.svg"},{"id":"KLB","name":"昆仑银行","icon":"assets/banks/KLB.svg","wordmark":"assets/banks/KLB_wordmark.svg"},{"id":"JZB","name":"晋中银行","icon":"assets/banks/JZB.svg"},{"id":"JSB","name":"晋商银行","icon":"assets/banks/JSB.svg","wordmark":"assets/banks/JSB_wordmark.svg"},{"id":"JINCHB","name":"晋城银行","icon":"assets/banks/JINCHB.svg","wordmark":"assets/banks/JINCHB_wordmark.svg"},{"id":"QJCCCB","name":"曲靖市商业银行","icon":"assets/banks/QJCCCB.svg","wordmark":"assets/banks/QJCCCB_wordmark.svg"},{"id":"BOCY","name":"朝阳银行","icon":"assets/banks/BOCY.svg","wordmark":"assets/banks/BOCY_wordmark.svg"},{"id":"BCCB","name":"本溪市商业银行","icon":"assets/banks/BCCB.svg","wordmark":"assets/banks/BCCB_wordmark.svg"},{"id":"HZCB","name":"杭州银行","icon":"assets/banks/HZCB.svg","wordmark":"assets/banks/HZCB_wordmark.svg"},{"id":"ZZB","name":"枣庄银行","icon":"assets/banks/ZZB.svg","wordmark":"assets/banks/ZZB_wordmark.svg"},{"id":"LZCCB","name":"柳州银行","icon":"assets/banks/LZCCB.svg","wordmark":"assets/banks/LZCCB_wordmark.svg"},{"id":"GLBANK","name":"桂林银行","icon":"assets/banks/GLBANK.svg","wordmark":"assets/banks/GLBANK_wordmark.svg"},{"id":"HKB","name":"汉口银行","icon":"assets/banks/HKB.svg","wordmark":"assets/banks/HKB_wordmark.svg"},{"id":"JSBANK","name":"江苏银行","icon":"assets/banks/JSBANK.svg","wordmark":"assets/banks/JSBANK_wordmark.svg"},{"id":"JSCJCB","name":"江苏长江商业银行","icon":"assets/banks/JSCJCB.svg","wordmark":"assets/banks/JSCJCB_wordmark.svg"},{"id":"JXB","name":"江西银行","icon":"assets/banks/JXB.svg","wordmark":"assets/banks/JXB_wordmark.svg"},{"id":"BOCZ","name":"沧州银行","icon":"assets/banks/BOCZ.svg","wordmark":"assets/banks/BOCZ_wordmark.svg"},{"id":"BHB","name":"河北银行","icon":"assets/banks/BHB.svg","wordmark":"assets/banks/BHB_wordmark.svg"},{"id":"BOQZ","name":"泉州银行","icon":"assets/banks/BOQZ.svg","wordmark":"assets/banks/BOQZ_wordmark.svg"},{"id":"TACCB","name":"泰安银行","icon":"assets/banks/TACCB.svg","wordmark":"assets/banks/TACCB_wordmark.svg"},{"id":"TLCB","name":"泰隆银行","icon":"assets/banks/TLCB.svg","wordmark":"assets/banks/TLCB_wordmark.svg"},{"id":"LZB","name":"泸州银行","icon":"assets/banks/LZB.svg","wordmark":"assets/banks/LZB_wordmark.svg"},{"id":"BLY","name":"洛阳银行","icon":"assets/banks/BLY.svg","wordmark":"assets/banks/BLY_wordmark.svg"},{"id":"JNBANK","name":"济宁银行","icon":"assets/banks/JNBANK.svg","wordmark":"assets/banks/JNBANK_wordmark.svg"},{"id":"CZBANK","name":"浙商银行","icon":"assets/banks/CZBANK.svg","wordmark":"assets/banks/CZBANK_wordmark.svg"},{"id":"MTBANK","name":"浙江民泰商业银行","icon":"assets/banks/MTBANK.svg","wordmark":"assets/banks/MTBANK_wordmark.svg"},{"id":"CZCB","name":"浙江稠州商业银行","icon":"assets/banks/CZCB.svg","wordmark":"assets/banks/CZCB_wordmark.svg"},{"id":"SPDB","name":"浦发银行","icon":"assets/banks/SPDB.svg","wordmark":"assets/banks/SPDB_wordmark.svg"},{"id":"HNB","name":"海南银行","icon":"assets/banks/HNB.svg","wordmark":"assets/banks/HNB_wordmark.svg"},{"id":"BOHAIB","name":"渤海银行","icon":"assets/banks/BOHAIB.svg","wordmark":"assets/banks/BOHAIB_wordmark.svg"},{"id":"WZBANK","name":"温州银行","icon":"assets/banks/WZBANK.svg","wordmark":"assets/banks/WZBANK_wordmark.svg"},{"id":"HBC","name":"湖北银行","icon":"assets/banks/HBC.svg","wordmark":"assets/banks/HBC_wordmark.svg"},{"id":"BOHZ","name":"湖州银行","icon":"assets/banks/BOHZ.svg","wordmark":"assets/banks/BOHZ_wordmark.svg"},{"id":"WFCCB","name":"潍坊银行","icon":"assets/banks/WFCCB.svg","wordmark":"assets/banks/WFCCB_wordmark.svg"},{"id":"YTB","name":"烟台银行","icon":"assets/banks/YTB.svg","wordmark":"assets/banks/YTB_wordmark.svg"},{"id":"CTS","name":"焦作中旅银行","icon":"assets/banks/CTS.svg"},{"id":"RBOZ","name":"珠海华润银行","icon":"assets/banks/RBOZ.svg","wordmark":"assets/banks/RBOZ_wordmark.svg"},{"id":"BOGS","name":"甘肃银行","icon":"assets/banks/BOGS.svg","wordmark":"assets/banks/BOGS_wordmark.svg"},{"id":"BOPJ","name":"盘锦银行","icon":"assets/banks/BOPJ.svg","wordmark":"assets/banks/BOPJ_wordmark.svg"},{"id":"SJBANK","name":"盛京银行","icon":"assets/banks/SJBANK.svg","wordmark":"assets/banks/SJBANK_wordmark.svg"},{"id":"SZSBK","name":"石嘴山银行","icon":"assets/banks/SZSBK.svg","wordmark":"assets/banks/SZSBK_wordmark.svg"},{"id":"FJHXBC","name":"福建海峡银行","icon":"assets/banks/FJHXBC.svg","wordmark":"assets/banks/FJHXBC_wordmark.svg"},{"id":"QHDBANK","name":"秦皇岛银行","icon":"assets/banks/QHDBANK.svg","wordmark":"assets/banks/QHDBANK_wordmark.svg"},{"id":"SXCB","name":"绍兴银行","icon":"assets/banks/SXCB.svg","wordmark":"assets/banks/SXCB_wordmark.svg"},{"id":"MYCCB","name":"绵阳市商业银行","icon":"assets/banks/MYCCB.svg","wordmark":"assets/banks/MYCCB_wordmark.svg"},{"id":"Mybank","name":"网商银行","icon":"assets/banks/Mybank.svg","wordmark":"assets/banks/Mybank_wordmark.svg"},{"id":"ZGBANK","name":"自贡银行","icon":"assets/banks/ZGBANK.svg","wordmark":"assets/banks/ZGBANK_wordmark.svg"},{"id":"BOSZ","name":"苏州银行","icon":"assets/banks/BOSZ.svg","wordmark":"assets/banks/BOSZ_wordmark.svg"},{"id":"LSBANK","name":"莱商银行","icon":"assets/banks/LSBANK.svg","wordmark":"assets/banks/LSBANK_wordmark.svg"},{"id":"YKYHB","name":"营口沿海银行","icon":"assets/banks/YKYHB.svg"},{"id":"BOYK","name":"营口银行","icon":"assets/banks/BOYK.svg","wordmark":"assets/banks/BOYK_wordmark.svg"},{"id":"BOHLD","name":"葫芦岛银行","icon":"assets/banks/BOHLD.svg","wordmark":"assets/banks/BOHLD_wordmark.svg"},{"id":"BOHS","name":"衡水银行","icon":"assets/banks/BOHS.svg"},{"id":"XABANK","name":"西安银行","icon":"assets/banks/XABANK.svg","wordmark":"assets/banks/XABANK_wordmark.svg"},{"id":"BOXZ","name":"西藏银行","icon":"assets/banks/BOXZ.svg","wordmark":"assets/banks/BOXZ_wordmark.svg"},{"id":"BOGZ","name":"贵州银行","icon":"assets/banks/BOGZ.svg","wordmark":"assets/banks/BOGZ_wordmark.svg"},{"id":"GYCCB","name":"贵阳银行","icon":"assets/banks/GYCCB.svg","wordmark":"assets/banks/GYCCB_wordmark.svg"},{"id":"BOLY","name":"辽阳银行","icon":"assets/banks/BOLY.svg","wordmark":"assets/banks/BOLY_wordmark.svg"},{"id":"DCCB","name":"达州银行","icon":"assets/banks/DCCB.svg","wordmark":"assets/banks/DCCB_wordmark.svg"},{"id":"SNBANK","name":"遂宁银行","icon":"assets/banks/SNBANK.svg","wordmark":"assets/banks/SNBANK_wordmark.svg"},{"id":"XTB","name":"邢台银行","icon":"assets/banks/XTB.svg","wordmark":"assets/banks/XTB_wordmark.svg"},{"id":"HDBANK","name":"邯郸银行","icon":"assets/banks/HDBANK.svg","wordmark":"assets/banks/HDBANK_wordmark.svg"},{"id":"ZZBANK","name":"郑州银行","icon":"assets/banks/ZZBANK.svg","wordmark":"assets/banks/ZZBANK_wordmark.svg"},{"id":"ORDOSB","name":"鄂尔多斯银行","icon":"assets/banks/ORDOSB.svg","wordmark":"assets/banks/ORDOSB_wordmark.svg"},{"id":"CCQTGB","name":"重庆三峡银行","icon":"assets/banks/CCQTGB.svg","wordmark":"assets/banks/CCQTGB_wordmark.svg"},{"id":"CQBANK","name":"重庆银行","icon":"assets/banks/CQBANK.svg","wordmark":"assets/banks/CQBANK_wordmark.svg"},{"id":"JHCCB","name":"金华银行","icon":"assets/banks/JHCCB.svg","wordmark":"assets/banks/JHCCB_wordmark.svg"},{"id":"BOTL","name":"铁岭银行","icon":"assets/banks/BOTL.svg","wordmark":"assets/banks/BOTL_wordmark.svg"},{"id":"JZBANK","name":"锦州银行","icon":"assets/banks/JZBANK.svg","wordmark":"assets/banks/JZBANK_wordmark.svg"},{"id":"GWB","name":"长城华西银行","icon":"assets/banks/GWB.svg","wordmark":"assets/banks/GWB_wordmark.svg"},{"id":"CABANK","name":"长安银行","icon":"assets/banks/CABANK.svg","wordmark":"assets/banks/CABANK_wordmark.svg"},{"id":"BSCB","name":"长沙银行","icon":"assets/banks/BSCB.svg","wordmark":"assets/banks/BSCB_wordmark.svg"},{"id":"CZB","name":"长治银行","icon":"assets/banks/CZB.svg","wordmark":"assets/banks/CZB_wordmark.svg"},{"id":"FXCB","name":"阜阳银行","icon":"assets/banks/FXCB.svg","wordmark":"assets/banks/FXCB_wordmark.svg"},{"id":"YQCCB","name":"阳泉市商业银行","icon":"assets/banks/YQCCB.svg","wordmark":"assets/banks/YQCCB_wordmark.svg"},{"id":"YACCB","name":"雅安市商业银行","icon":"assets/banks/YACCB.svg","wordmark":"assets/banks/YACCB_wordmark.svg"},{"id":"QDCCB","name":"青岛银行","icon":"assets/banks/QDCCB.svg","wordmark":"assets/banks/QDCCB_wordmark.svg"},{"id":"QHBANK","name":"青海银行","icon":"assets/banks/QHBANK.svg","wordmark":"assets/banks/QHBANK_wordmark.svg"},{"id":"BOAS","name":"鞍山银行","icon":"assets/banks/BOAS.svg","wordmark":"assets/banks/BOAS_wordmark.svg"},{"id":"QSB","name":"齐商银行","icon":"assets/banks/QSB.svg","wordmark":"assets/banks/QSB_wordmark.svg"},{"id":"QLBANK","name":"齐鲁银行","icon":"assets/banks/QLBANK.svg","wordmark":"assets/banks/QLBANK_wordmark.svg"},{"id":"LJBANK","name":"龙江银行","icon":"assets/banks/LJBANK.svg","wordmark":"assets/banks/LJBANK_wordmark.svg"}];

function buildGroups() {
  const text = copy();
  return [
    { id: "banks", name: text.groups.banks, marks: [] },
    { id: "transit", name: text.groups.transit, marks: [
      { id: "t-union", name: text.groups.transit, src: "assets/transit/t-union.png", width: 220 },
    ] },
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
 let approved = [];
 const extraBankMarks = {};
 function applyApproved() {
   faces = faces.filter((face) => !String(face.id).startsWith("sub-"));
   Object.keys(extraBankMarks).forEach((key) => { delete extraBankMarks[key]; });
   groups.forEach((group) => {
     group.marks = group.marks.filter((mark) => !String(mark.id).startsWith("sub-"));
   });
   approved.forEach((item) => {
     if (item.kind === "face") {
       faces.push({ id: `sub-${item.id}`, zh: item.name, en: item.name, category: item.category, src: item.url });
       return;
     }
     const mark = { id: `sub-${item.id}`, name: item.name, src: item.url, width: item.width || 132 };
     if (item.category === "banks" && item.bank) {
       extraBankMarks[item.bank] = extraBankMarks[item.bank] || [];
       extraBankMarks[item.bank].push(mark);
       return;
     }
     let group = groups.find((entry) => entry.id === item.category);
     if (!group) {
       group = { id: item.category, name: item.category, marks: [] };
       groups.push(group);
     }
     group.marks.push(mark);
   });
 }
 let faces = [
  { id: "ink", zh: "墨蓝", en: "Ink", category: "solid", stops: ["#243044", "#1a2433", "#31445d"] },
  { id: "navy", zh: "海蓝", en: "Navy", category: "solid", stops: ["#163a6b", "#0e2749", "#2d5d9a"] },
  { id: "teal", zh: "青绿", en: "Teal", category: "solid", stops: ["#0e6e66", "#0a4a45", "#1a9a8e"] },
  { id: "forest", zh: "松绿", en: "Forest", category: "solid", stops: ["#1d5a3a", "#123d27", "#2f8a58"] },
  { id: "wine", zh: "酒红", en: "Wine", category: "solid", stops: ["#6d2438", "#471626", "#9a3d56"] },
  { id: "slate", zh: "石板", en: "Slate", category: "solid", stops: ["#3d4654", "#2a313b", "#5d6a7c"] },
  { id: "sand", zh: "沙金", en: "Sand", category: "solid", stops: ["#c4a574", "#a88858", "#e2cba4"] },
  { id: "paper", zh: "素白", en: "Paper", category: "solid", stops: ["#f4f1ea", "#e4dfd4", "#ffffff"] },
];
const faceCanvas = document.createElement("canvas");
faceCanvas.width = CARD_W;
faceCanvas.height = CARD_H;
const faceCtx = faceCanvas.getContext("2d");
const faceCache = {};
const faceJobs = {};
function faceImage(id) {
  if (faceCache[id]) return Promise.resolve(faceCache[id]);
  if (faceJobs[id]) return faceJobs[id];
  faceJobs[id] = new Promise((resolve, reject) => {
    const face = faces.find((entry) => entry.id === id);
    if (!face) { reject(new Error("missing face")); return; }
    if (face.src) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => { faceCache[id] = image; resolve(image); };
      image.onerror = () => reject(new Error("face"));
      image.src = face.src;
      return;
    }
    const gradient = faceCtx.createLinearGradient(0, 0, CARD_W, CARD_H);
    gradient.addColorStop(0, face.stops[0]);
    gradient.addColorStop(0.55, face.stops[1]);
    gradient.addColorStop(1, face.stops[2]);
    faceCtx.fillStyle = gradient;
    faceCtx.fillRect(0, 0, CARD_W, CARD_H);
    const sheen = faceCtx.createLinearGradient(0, 0, 0, CARD_H);
    sheen.addColorStop(0, "rgba(255,255,255,0.16)");
    sheen.addColorStop(0.42, "rgba(255,255,255,0)");
    faceCtx.fillStyle = sheen;
    faceCtx.save();
    faceCtx.clip();
    faceCtx.fillRect(0, 0, CARD_W, CARD_H);
    faceCtx.restore();
    const image = new Image();
    image.onload = () => { faceCache[id] = image; resolve(image); };
    image.src = faceCanvas.toDataURL("image/png");
  });
  return faceJobs[id];
}
 function paintSwatch(canvas, face) {
   const context = canvas.getContext("2d");
   const width = canvas.width;
   const height = canvas.height;
   if (face.src) {
     const image = new Image();
     image.crossOrigin = "anonymous";
     image.onload = () => context.drawImage(image, 0, 0, width, height);
     image.src = face.src;
     return;
   }
   const gradient = context.createLinearGradient(0, 0, width, height);
   gradient.addColorStop(0, face.stops[0]);
   gradient.addColorStop(0.55, face.stops[1]);
   gradient.addColorStop(1, face.stops[2]);
   context.fillStyle = gradient;
   context.fillRect(0, 0, width, height);
 }

 const SAVES_KEY = "card-saves";
 let saves = [];
 try { saves = JSON.parse(localStorage.getItem(SAVES_KEY) || "[]") || []; } catch { saves = []; }
 if (!Array.isArray(saves)) saves = [];
 let activeSave = null;
 let cardSource = null;
 let saveSeq = saves.reduce((max, entry) => Math.max(max, entry.seq || 0), 0);
 function faceName(face) { return language === "zh" ? face.zh : face.en; }
let faceCategories = [{ id: "solid", name: "" }, { id: "bank", name: "" }, { id: "transit", name: "" }, { id: "other", name: "" }];
let logoCategories = [];
let faceCategory = "solid";
 function renderFaces() {
   const tabs = document.querySelector("#face-cats");
   tabs.replaceChildren();
   const text = uiText[language];
   const fallback = { solid: text.catSolid, bank: text.catBank, transit: text.catTransit, other: text.catOther };
   faceCategories.forEach((entry) => {
     const tab = document.createElement("button");
     tab.type = "button";
     tab.className = "tab" + (entry.id === faceCategory ? " active" : "");
     tab.textContent = entry.name || fallback[entry.id] || entry.id;
     tab.addEventListener("click", () => { faceCategory = entry.id; renderFaces(); });
     tabs.appendChild(tab);
   });
   const box = document.querySelector("#faces");
   box.replaceChildren();
   faces.filter((face) => (face.category || "solid") === faceCategory).forEach((face) => {
     const button = document.createElement("button");
     button.type = "button";
     button.className = "face" + (cardSource === `face:${face.id}` && !activeSave ? " active" : "");
     const swatch = document.createElement("canvas");
     swatch.width = 160;
     swatch.height = 101;
     paintSwatch(swatch, face);
     const label = document.createElement("span");
     label.textContent = faceName(face);
     button.append(swatch, label);
     button.addEventListener("click", () => selectFace(face.id));
     box.appendChild(button);
   });
 }
 function renderSaves() {
   const box = document.querySelector("#saves");
   box.replaceChildren();
   if (!saves.length) {
     const note = document.createElement("p");
     note.className = "muted empty-note";
     note.textContent = copy().nothingSaved;
     box.appendChild(note);
     return;
   }
   [...saves].reverse().forEach((entry) => {
     const button = document.createElement("button");
     button.type = "button";
     button.className = "face" + (activeSave === entry.id ? " active" : "");
     const image = document.createElement("canvas");
     image.width = 160;
     image.height = 101;
     paintSavedThumb(image, entry);
     image.dataset.thumb = entry.thumb || "";
     const label = document.createElement("span");
     label.textContent = entry.name;
     const remove = document.createElement("button");
     remove.type = "button";
     remove.className = "face-delete";
     remove.setAttribute("aria-label", uiText[language].delete);
     remove.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
     remove.addEventListener("click", (event) => {
       event.stopPropagation();
       event.preventDefault();
       saves = saves.filter((item) => item.id !== entry.id);
      const wasOpen = activeSave === entry.id;
      if (wasOpen) {
        activeSave = null;
        cardSource = null;
        cardImage = null;
        cardView = { scale: 1, x: 0.5, y: 0.5 };
        items = [];
        selected = null;
      }
      persistSaves();
      renderSaves();
      if (wasOpen) {
        paint();
        renderLogos();
        syncLogoAvailability();
        renderFaces();
      }
    });
     button.append(image, label);
     button.addEventListener("click", () => openSave(entry.id));
     button.append(remove);
     box.appendChild(button);
   });
 }
 function snapshot() {
   return {
     cardView,
     items: items.map((item) => ({ ...item })),
     selected,
     seq,
     rounded,
     cardSource,
   };
 }
 function applySnapshot(saved) {
   cardView = saved.cardView || { scale: 1, x: 0.5, y: 0.5 };
   items = (saved.items || []).map((item) => ({ ...item }));
   selected = null;
   seq = Math.max(seq, saved.seq || 1, ...(items.length ? items.map((item) => item.id + 1) : [1]));
   rounded = saved.rounded !== false;
   document.querySelector("#rounded").checked = rounded;
 }
 let thumbToken = 0;
 function paintSavedThumb(canvas, entry) {
   const context = canvas.getContext("2d");
   const token = (thumbToken += 1);
   canvas.dataset.token = String(token);
   const faceId = String(entry.state && entry.state.cardSource || "");
   const face = faceId.startsWith("face:") ? faces.find((item) => item.id === faceId.slice(5)) : null;
   if (face) paintSwatch(canvas, face);
   else { context.fillStyle = "#d7dee7"; context.fillRect(0, 0, canvas.width, canvas.height); }
   const marks = (entry.state && entry.state.items) || [];
   const loaded = {};
   let photo = null;
   const paint = () => {
     if (canvas.dataset.token !== String(token)) return;
     if (face) paintSwatch(canvas, face);
     else { context.fillStyle = "#d7dee7"; context.fillRect(0, 0, canvas.width, canvas.height); }
     if (photo && photo.complete && photo.naturalWidth) context.drawImage(photo, 0, 0, canvas.width, canvas.height);
     marks.forEach((item) => {
       const image = loaded[item.id];
       if (!image) return;
       const width = item.width * (canvas.width / Math.max(card.clientWidth, 1));
       const height = width * image.naturalHeight / image.naturalWidth;
       context.save();
       context.translate((item.x / 100) * canvas.width, (item.y / 100) * canvas.height);
       context.rotate((item.rotate * Math.PI) / 180);
       context.globalAlpha = item.opacity;
       context.drawImage(image, -width / 2, -height / 2, width, height);
       context.restore();
     });
   };
   if (!entry.thumb && !marks.length) return;
   let pending = (entry.thumb ? 1 : 0) + marks.length;
   const done = () => { pending -= 1; if (!pending) paint(); };
   if (entry.thumb) {
     photo = new Image();
     photo.onload = done;
     photo.onerror = () => { photo = null; done(); };
     photo.src = entry.thumb;
   }
   marks.forEach((item) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
     image.onload = () => { loaded[item.id] = image; done(); };
     image.onerror = done;
     image.src = item.src;
   });
 }
 async function cardThumb() {
   const blob = await renderCardBlob(cardImage, cardView, items, rounded);
   if (!blob) return "";
   const url = URL.createObjectURL(blob);
   try {
     const image = await loadImage(url);
     const canvas = document.createElement("canvas");
     canvas.width = 320;
     canvas.height = 202;
     canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
     return canvas.toDataURL("image/jpeg", 0.72);
   } catch {
     return "";
   } finally {
     URL.revokeObjectURL(url);
  }
}
 async function selectFace(id) {
   if (items.length && !window.confirm(`${copy().replaceTitle}\n${copy().replaceText}`)) return;
   activeSave = null;
   cardSource = `face:${id}`;
   cardImage = await faceImage(id);
   cardView = { scale: 1, x: 0.5, y: 0.5 };
   items = [];
   selected = null;
  paint();
  renderLogos();
   syncLogoAvailability();
   renderFaces();
   renderSaves();
 }
 function blankCard() {
   if (items.length && !window.confirm(`${copy().replaceTitle}\n${copy().replaceText}`)) return;
   activeSave = null;
   cardSource = null;
   cardImage = null;
   cardView = { scale: 1, x: 0.5, y: 0.5 };
   items = [];
   selected = null;
   paint();
   renderLogos();
   syncLogoAvailability();
   renderFaces();
   renderSaves();
 }
 function persistSaves() {
   try {
     localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
     return true;
   } catch {
     return false;
   }
 }
 async function openSave(id) {
   const entry = saves.find((item) => item.id === id);
   if (!entry) return;
   const state = entry.state || {};
   if (String(state.cardSource || "").startsWith("face:")) {
     uploadData = "";
     cardImage = await faceImage(state.cardSource.slice(5));
   }
  else if (entry.image || entry.thumb) {
    uploadData = entry.image || "";
    try { cardImage = await loadImage(entry.image || entry.thumb); }
    catch {
      uploadData = "";
      if (!entry.thumb) { showToast(copy().logoNeed); return; }
      try { cardImage = await loadImage(entry.thumb); }
      catch { showToast(copy().logoNeed); return; }
    }
  }
  else { showToast(copy().logoNeed); return; }
  activeSave = id;
  applySnapshot(state);
  cardSource = uploadData || String(state.cardSource || "").startsWith("face:") ? (state.cardSource || "upload") : "thumb";
   paint();
   renderLogos();
   syncLogoAvailability();
   renderFaces();
   renderSaves();
 }

let groups = buildGroups();
let marks = Object.fromEntries(groups.flatMap((group) => group.marks.map((mark) => [mark.id, mark])));

let cardImage = null;
let uploadData = "";
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

function bankMarks(bank) {
  const text = copy();
   return [
     { id: `bank-${bank.id}-mark`, name: text.groups.bankMark, src: bank.icon, width: 92 },
     ...(bank.wordmark ? [{ id: `bank-${bank.id}-lockup`, name: text.groups.bankLockup, src: bank.wordmark, width: 180 }] : []),
     ...(extraBankMarks[bank.id] || []),
   ];
}

function renderLibrary() {
  const box = document.querySelector("#library");
  const picker = document.querySelector(".bank-picker");
  const select = document.querySelector("#bank-picker");
  const banking = activeGroup === "banks";
  picker.hidden = !banking;
  box.replaceChildren();
  if (banking) {
    if (select.childElementCount !== bankIndex.length) {
      select.replaceChildren();
      bankIndex.forEach((bank) => {
        const option = document.createElement("option");
        option.value = bank.id;
        option.textContent = bank.name;
        select.appendChild(option);
      });
    }
    const bank = bankIndex.find((entry) => entry.id === select.value) || bankIndex[0];
    bankMarks(bank).forEach((mark) => box.appendChild(logoButton(mark, `${bank.name} · ${mark.name}`)));
    return;
  }
  const group = groups.find((entry) => entry.id === activeGroup);
  group.marks.forEach((mark) => box.appendChild(logoButton(mark, `${group.name} · ${mark.name}`)));
}

function logoButton(mark, name) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lib-btn";
  button.innerHTML = `<img src="${mark.src}" alt="" /><span>${mark.name}</span>`;
  button.addEventListener("click", () => addLogo({ name, src: mark.src, width: mark.width }));
  return button;
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
    if (item.id === selected) node.append(makeLock(item), makeDelete(item));
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
     const row = document.createElement("div");
     row.className = "layer" + (item.id === selected ? " active" : "");
     row.dataset.id = item.id;
     const button = document.createElement("button");
     button.type = "button";
     button.className = "layer-name";
     button.textContent = item.name + (item.locked ? ` · ${copy().locked}` : "");
     button.addEventListener("click", () => { if (layerDrag) return; selected = item.id; renderLogos(); });
     button.addEventListener("pointerdown", (event) => startLayerPress(event, item, row));
     const remove = document.createElement("button");
     remove.type = "button";
     remove.className = "layer-delete";
     remove.setAttribute("aria-label", uiText[language].delete);
     remove.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
     remove.addEventListener("click", () => {
       items = items.filter((entry) => entry.id !== item.id);
       if (selected === item.id) selected = items.at(-1)?.id ?? null;
       renderLogos();
     });
     row.append(button, remove);
     box.appendChild(row);
   });
 }
 
 let layerDrag = null;
 
 function startLayerPress(event, item, row) {
   if (event.button !== undefined && event.button !== 0) return;
   const pointerId = event.pointerId;
   const originY = event.clientY;
   let armed = false;
   const watch = (move) => {
     if (move.pointerId !== pointerId || armed) return;
     if (Math.abs(move.clientY - originY) > 4) {
       armed = true;
       window.removeEventListener("pointermove", watch);
       window.removeEventListener("pointerup", cancel);
       beginLayerDrag(pointerId, originY, item, row);
     }
   };
   const cancel = () => {
     window.removeEventListener("pointermove", watch);
     window.removeEventListener("pointerup", cancel);
     window.removeEventListener("pointercancel", cancel);
   };
   window.addEventListener("pointermove", watch);
   window.addEventListener("pointerup", cancel);
   window.addEventListener("pointercancel", cancel);
 }
 
 function beginLayerDrag(pointerId, originY, item, row) {
   const box = document.querySelector("#layer-list");
   row.classList.add("dragging");
   if (navigator.vibrate) navigator.vibrate(12);
   layerDrag = { pointerId, id: item.id, box };
   const move = (event) => {
     if (event.pointerId !== pointerId) return;
     event.preventDefault();
     const rows = [...box.querySelectorAll(".layer")];
     const index = rows.indexOf(row);
     const hit = rows.findIndex((entry) => {
       const rect = entry.getBoundingClientRect();
       return event.clientY >= rect.top && event.clientY <= rect.bottom;
     });
     if (hit < 0 || hit === index) return;
     const target = rows[hit];
     if (hit < index) box.insertBefore(row, target);
     else box.insertBefore(row, target.nextSibling);
   };
   const end = (event) => {
     if (event.pointerId !== pointerId) return;
     window.removeEventListener("pointermove", move);
     window.removeEventListener("pointerup", end);
     window.removeEventListener("pointercancel", end);
     const order = [...box.children].map((entry) => Number(entry.dataset.id)).reverse();
     items = order.map((id) => items.find((entry) => entry.id === id)).filter(Boolean);
     layerDrag = null;
     renderLogos();
   };
   window.addEventListener("pointermove", move, { passive: false });
   window.addEventListener("pointerup", end);
   window.addEventListener("pointercancel", end);
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

function makeDelete(item) {
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "handle delete";
  handle.setAttribute("aria-label", uiText[language].delete);
  handle.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  handle.addEventListener("pointerdown", (event) => event.stopPropagation());
  handle.addEventListener("click", (event) => {
    event.stopPropagation();
    items = items.filter((entry) => entry.id !== item.id);
    if (selected === item.id) selected = items.at(-1)?.id ?? null;
    renderLogos();
  });
  return handle;
}

 function makeHandle(mode, item) {
   const handle = document.createElement("button");
   handle.type = "button";
   handle.className = "handle " + mode;
   handle.setAttribute("aria-label", uiText[language][mode === "rotate" ? "rotate" : "size"]);
   handle.innerHTML = mode === "rotate"
     ? `<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
     : `<svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
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

const pointers = new Map();
let wheelArmed = false;
card.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".badge")) { wheelArmed = false; return; }
  wheelArmed = true;
  if (selected !== null) { selected = null; renderLogos(); }
  const image = dragMode === "reference" ? refImage : cardImage;
  if (!image) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const view = dragMode === "reference" ? refView : cardView;
  drag = { type: dragMode, pointerId: event.pointerId, x: view.x, y: view.y, clientX: event.clientX, clientY: event.clientY, scale: view.scale, pinch: 0 };
  card.setPointerCapture(event.pointerId);
});

function pinchDistance() {
  const points = [...pointers.values()];
  return points.length >= 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
}

card.addEventListener("pointermove", (event) => {
  if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (!drag) return;
  if (pointers.size >= 2 && (drag.type === "card" || drag.type === "reference")) {
    const distance = pinchDistance();
    const view = drag.type === "reference" ? refView : cardView;
    if (!drag.pinch) drag.pinch = distance;
    view.scale = clamp(drag.scale * distance / Math.max(drag.pinch, 1), 1, 3);
    paint();
    return;
  }
  if (event.pointerId !== drag.pointerId) return;
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

function endDrag(event) {
  if (event.pointerId) pointers.delete(event.pointerId);
  if (pointers.size >= 2 && drag) {
    drag.pinch = 0;
    drag.scale = (drag.type === "reference" ? refView : cardView).scale;
    return;
  }
  if (drag && (!event.pointerId || event.pointerId === drag.pointerId || pointers.size === 0)) drag = null;
}
card.addEventListener("pointerup", endDrag);
document.addEventListener("pointerdown", (event) => { if (!card.contains(event.target)) wheelArmed = false; });
card.addEventListener("pointercancel", endDrag);

document.querySelector("#modes").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  dragMode = button.dataset.mode;
  document.querySelectorAll("#modes button").forEach((node) => node.classList.toggle("active", node === button));
});

 document.querySelector("#rounded").addEventListener("change", (event) => { rounded = event.target.checked; paint(); });
card.addEventListener("wheel", (event) => {
  if (!wheelArmed || !card.contains(event.target)) return;
   if (dragMode === "reference" && !refImage) return;
   const image = dragMode === "reference" ? refImage : cardImage;
   if (!image) return;
   event.preventDefault();
   const view = dragMode === "reference" ? refView : cardView;
   view.scale = clamp(view.scale * (event.deltaY < 0 ? 1.08 : 0.92), 1, 3);
   paint();
 }, { passive: false });
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
   const item = current();
   if (!item || item.locked) return;
   const step = (12 / card.getBoundingClientRect().height) * 100;
   item.y = Math.min(100, Math.max(0, item.y - direction * step));
   renderLogos();
 }

 function readFile(file) {
   return new Promise((resolve, reject) => {
     const image = new Image();
     image.onload = () => resolve(image);
     image.onerror = () => reject(new Error("image"));
     image.src = URL.createObjectURL(file);
   });
 }
function fileToData(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
     reader.readAsDataURL(file);
   });
 }
 document.querySelector("#photo").addEventListener("change", async (event) => {
   const file = event.target.files?.[0];
   if (!file) return;
   if (file.size > 4 * 1024 * 1024) { showToast(copy().submitBig); event.target.value = ""; return; }
   if (items.length && !window.confirm(`${copy().replaceTitle}\n${copy().replaceText}`)) { event.target.value = ""; return; }
   try {
     uploadData = await fileToData(file);
     cardImage = await readFile(file);
   } catch {
     showToast(copy().logoNeed);
     return;
   }
   activeSave = null;
   cardSource = "upload";
   cardView = { scale: 1, x: 0.5, y: 0.5 };
   items = [];
   selected = null;
   paint();
   renderLogos();
   renderFaces();
   renderSaves();
   syncLogoAvailability();
 });
 document.querySelector("#pick-empty").addEventListener("click", () => document.querySelector("#photo").click());
 document.querySelector("#pick-card").addEventListener("click", () => document.querySelector("#photo").click());
 const stage = document.querySelector(".stage");
 ["dragover", "dragenter"].forEach((type) => stage.addEventListener(type, (event) => { event.preventDefault(); stage.classList.add("hot"); }));
 stage.addEventListener("dragleave", () => stage.classList.remove("hot"));
 stage.addEventListener("drop", (event) => {
   event.preventDefault();
   stage.classList.remove("hot");
   const file = event.dataTransfer.files?.[0];
   if (!file) return;
   const input = document.querySelector("#photo");
   const transfer = new DataTransfer();
   transfer.items.add(file);
   input.files = transfer.files;
   input.dispatchEvent(new Event("change"));
 });
 document.querySelector("#ref-file").addEventListener("change", async (event) => {
   const file = event.target.files?.[0];
   if (!file) return;
   if (file.size > 4 * 1024 * 1024) { showToast(copy().submitBig); event.target.value = ""; return; }
   try { refImage = await readFile(file); }
   catch { showToast(copy().logoNeed); return; }
   refView = { scale: 1, x: 0.5, y: 0.5 };
   refVisible = true;
   paint();
 });
 document.querySelector("#bank-picker").addEventListener("change", renderLibrary);
 document.querySelector("#logo-file").addEventListener("change", async (event) => {
   const files = [...event.target.files].filter((file) => file.size <= 4 * 1024 * 1024);
   if (files.length !== event.target.files.length) showToast(copy().submitBig);
   for (const file of files) {
     addLogo({ name: file.name.replace(/\.[^.]+$/, ""), src: await fileToData(file), width: 150 });
   }
 });
 ["#ref-file", "#logo-file"].forEach((selector) => {
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
document.querySelector("#reset-zoom").addEventListener("click", () => {
  const view = dragMode === "reference" ? refView : cardView;
  view.scale = 1;
  paint();
});
document.querySelector("#clear").addEventListener("click", () => {
  refImage = null;
  refView = { scale: 1, x: 0.5, y: 0.5 };
  paint();
});
async function renderCardBlob(image, view, logoItems, useRound) {
  const out = document.createElement("canvas");
  out.width = CARD_W;
  out.height = CARD_H;
  const context = out.getContext("2d");
  if (useRound) {
    roundedPath(context, CARD_W, CARD_H, RADIUS);
    context.clip();
  }
  paintImage(context, image, view);
  const scale = CARD_W / Math.max(card.clientWidth, 1);
  for (const item of logoItems) {
    let logo;
    try { logo = await loadImage(item.src); }
    catch { continue; }
    const width = item.width * scale;
    const height = width * (logo.naturalHeight || logo.height) / (logo.naturalWidth || logo.width);
    context.save();
    context.translate((item.x / 100) * CARD_W, (item.y / 100) * CARD_H);
    context.rotate((item.rotate * Math.PI) / 180);
    context.globalAlpha = item.opacity;
    context.drawImage(logo, -width / 2, -height / 2, width, height);
    context.restore();
  }
  return new Promise((resolve) => out.toBlob(resolve, "image/png"));
}
function downloadBlob(blob, name) {
   if (!blob) { showToast(copy().exportFailed); return; }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = name;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}
 document.querySelector("#export").addEventListener("click", () => {
   if (!cardImage) { remindCardFirst(); return; }
   exportCard();
 });
function exportCard() {
  renderCardBlob(cardImage, cardView, items, rounded).then((blob) => downloadBlob(blob, "card-face.png"));
}
 async function saveCard() {
   if (!cardImage) { remindCardFirst(); return; }
   const previous = activeSave ? saves.find((item) => item.id === activeSave) : null;
   const seq = previous?.seq || saveSeq + 1;
   const entry = {
     id: previous?.id || `save-${Date.now()}`,
     seq,
     name: previous?.name || `${copy().cardName}${seq}`,
     thumb: "",
     image: String(cardSource || "").startsWith("face:") ? "" : (uploadData || ""),
     state: snapshot(),
   };
   const index = saves.findIndex((item) => item.id === entry.id);
   if (index >= 0) saves[index] = entry;
   else saves.push(entry);
   activeSave = entry.id;
   renderSaves();
   let kept = false;
   if (!persistSaves() && entry.image) {
     entry.image = "";
     kept = persistSaves();
   } else kept = true;
   if (!kept) {
     if (!previous) saves = saves.filter((item) => item.id !== entry.id);
     else saves[index] = previous;
     activeSave = previous?.id || null;
     renderSaves();
     showToast(copy().saveFailed);
     return;
   }
   if (!previous) saveSeq = seq;
   showToast(copy()[entry.image || String(cardSource || "").startsWith("face:") ? "saved" : "saveKept"]);
   entry.thumb = await cardThumb();
   renderSaves();
   persistSaves();
 }
document.querySelector("#save-card").addEventListener("click", saveCard);
 async function exportAll() {
   if (!saves.length) { showToast(copy().nothingSaved); return; }
   showToast(copy().exportDone);
   let count = 0;
   for (const entry of [...saves]) {
     try {
       const state = entry.state || {};
       const source = String(state.cardSource || "");
       let image = null;
       if (source.startsWith("face:")) image = await faceImage(source.slice(5));
       else if (entry.image) { try { image = await loadImage(entry.image); } catch { image = null; } }
       if (!image && entry.thumb) { try { image = await loadImage(entry.thumb); } catch { image = null; } }
       if (!image) continue;
       const view = state.cardView || { scale: 1, x: 0.5, y: 0.5 };
       const blob = await renderCardBlob(image, view, state.items || [], state.rounded !== false);
       if (!blob) continue;
       count += 1;
       downloadBlob(blob, `card-${String(count).padStart(2, "0")}.png`);
       await new Promise((resolve) => setTimeout(resolve, 800));
     } catch { continue; }
   }
   if (!count) showToast(copy().exportFailed);
 }
 document.querySelector("#export-all").addEventListener("click", exportAll);

function loadImage(src) {
  if (imageCache[src]) return Promise.resolve(imageCache[src]);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => { imageCache[src] = image; resolve(image); };
    image.onerror = reject;
    image.src = src;
  });
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

let toastTimer = 0;
function remindCardFirst() {
  const toast = document.querySelector("#toast");
   const drop = document.querySelector(".stage");
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
  document.querySelectorAll("[data-i18n-label]").forEach((node) => {
    node.setAttribute("aria-label", uiText[language][node.dataset.i18nLabel]);
  });
  renderTerms();
  groups = buildGroups();
  logoCategories.forEach((entry) => {
    const group = groups.find((item) => item.id === entry.id);
    if (group) group.name = entry.name || group.name;
    else groups.push({ id: entry.id, name: entry.name || entry.id, marks: [] });
  });
  applyApproved();
  marks = Object.fromEntries(groups.flatMap((group) => group.marks.map((mark) => [mark.id, mark])));
  renderTabs();
  renderLibrary();
  renderFaces();
   renderSaves();
  renderLogos();
  syncLogoAvailability();
  fillSubmitForm();
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
document.querySelector("#terms-accept").addEventListener("click", () => {
  localStorage.setItem("card-terms", "accepted");
  document.querySelector("#terms-sheet").hidden = true;
});
document.querySelector("#support").addEventListener("click", () => {
  document.querySelector("#support-sheet").hidden = false;
});
document.querySelector("#support-close").addEventListener("click", () => {
  document.querySelector("#support-sheet").hidden = true;
});
document.querySelector("#support-sheet").addEventListener("click", (event) => {
  if (event.target.id === "support-sheet") document.querySelector("#support-sheet").hidden = true;
});
if (localStorage.getItem("card-theme") === "dark") document.body.classList.add("dark");
document.querySelector("#terms-sheet").hidden = localStorage.getItem("card-terms") === "accepted";
applyLanguage();
paint();
renderLogos();
const INTAKE = "https://review.youmikk.me";
async function loadApproved() {
  try {
    const response = await fetch(`${INTAKE}/manifest`);
    if (!response.ok) return;
    const data = await response.json();
    approved = Array.isArray(data.items) ? data.items : [];
    if (Array.isArray(data.categories) && data.categories.length) {
      const facesFromCatalog = data.categories.filter((entry) => entry && entry.id && (entry.kind || "face") === "face");
      const logosFromCatalog = data.categories.filter((entry) => entry && entry.id && entry.kind === "logo");
      if (facesFromCatalog.length) faceCategories = facesFromCatalog;
      if (logosFromCatalog.length) logoCategories = logosFromCatalog;
    }
    if (!faceCategories.some((entry) => entry.id === faceCategory) && faceCategories.length) faceCategory = faceCategories[0].id;
    applyLanguage();
  } catch {}
}
 function submitCategories(kind) {
   if (kind === "face") return faceCategories.map((entry) => [entry.id, entry.name || entry.id]);
   return logoCategories.map((entry) => [entry.id, entry.name || entry.id]);
 }
 function fillSubmitForm() {
   const text = uiText[language];
   const kind = document.querySelector("#submit-kind");
   const previous = kind.value || "face";
   kind.replaceChildren();
   [["face", text.kindFace], ["logo", text.kindLogo]].forEach(([value, label]) => {
     const option = document.createElement("option");
     option.value = value;
     option.textContent = label;
     kind.appendChild(option);
   });
   kind.value = previous;
   const category = document.querySelector("#submit-category");
   const kept = category.value;
   category.replaceChildren();
   submitCategories(kind.value).forEach(([value, label]) => {
     const option = document.createElement("option");
     option.value = value;
     option.textContent = label;
     category.appendChild(option);
   });
   if ([...category.options].some((option) => option.value === kept)) category.value = kept;
   const bank = document.querySelector("#submit-bank");
   if (!bank.childElementCount) {
     bankIndex.forEach((entry) => {
       const option = document.createElement("option");
       option.value = entry.id;
       option.textContent = entry.name;
       bank.appendChild(option);
     });
   }
   document.querySelector("#submit-bank-row").hidden = !(kind.value === "logo" && category.selectedOptions[0]?.textContent === "银行");
   const custom = document.querySelector("#submit-custom");
   document.querySelector("#submit-custom-row").hidden = category.selectedOptions[0]?.textContent !== "其他";
   custom.required = category.selectedOptions[0]?.textContent === "其他";
   custom.placeholder = kind.value === "face" ? "例如：银行卡" : "例如：地铁";
   document.querySelector("#submit-note").textContent = kind.value === "face" ? text.submitFaceNote : text.submitLogoNote;
 }
 function openSubmit(kind) {
   document.querySelector("#submit-kind").value = kind;
   fillSubmitForm();
   document.querySelector("#submit-status").hidden = true;
   document.querySelector("#submit-sheet").hidden = false;
 }
 document.querySelector("#request-face").addEventListener("click", () => openSubmit("face"));
 document.querySelector("#request-logo").addEventListener("click", () => openSubmit("logo"));
 document.querySelector("#submit-kind").addEventListener("change", fillSubmitForm);
 document.querySelector("#submit-category").addEventListener("change", fillSubmitForm);
 document.querySelector("#submit-close").addEventListener("click", () => {
   document.querySelector("#submit-sheet").hidden = true;
 });
 document.querySelector("#submit-sheet").addEventListener("click", (event) => {
   if (event.target.id === "submit-sheet") document.querySelector("#submit-sheet").hidden = true;
 });
 document.querySelector("#submit-form").addEventListener("submit", async (event) => {
   event.preventDefault();
   const file = document.querySelector("#submit-file").files[0];
   const text = copy();
   const status = document.querySelector("#submit-status");
   status.hidden = false;
   if (!document.querySelector("#submit-category").value) {
     status.textContent = language === "zh" ? "当前没有可提交的分类。" : "No category is available yet.";
     return;
   }
   const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
   if (!file || (!allowed.includes(file.type) && !/\.(png|jpe?g|webp|svg)$/i.test(file.name))) {
     status.textContent = text.submitType;
     return;
   }
   if (file.size > 4 * 1024 * 1024) {
     status.textContent = text.submitBig;
     return;
   }
   const body = new FormData();
   body.set("name", document.querySelector("#submit-name").value.trim());
   body.set("kind", document.querySelector("#submit-kind").value);
   body.set("category", document.querySelector("#submit-category").value);
   body.set("bank", document.querySelector("#submit-bank").value);
   body.set("label", document.querySelector("#submit-custom").value.trim());
   body.set("file", file);
   const send = document.querySelector("#submit-send");
   send.disabled = true;
   try {
     const response = await fetch(`${INTAKE}/submit`, { method: "POST", body });
     if (!response.ok) throw new Error("submit");
     status.textContent = text.submitSent;
     document.querySelector("#submit-form").reset();
     fillSubmitForm();
   } catch {
     status.textContent = text.submitFailed;
   } finally {
     send.disabled = false;
   }
 });
 loadApproved();
