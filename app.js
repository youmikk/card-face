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
    groups: { official: "卡组织素材", payment: "支付方式", banks: "银行标识", bankMarks: "组合标识" },
    locked: "已锁定",
    logoReady: "可多选，支持 SVG、PNG、JPG、WebP",
    logoNeed: "请先上传卡面图片",
    none: "暂无 logo",
  },
  en: {
    styles: { flat: "Flat", "flat-rounded": "Rounded", logo: "Logo", "logo-border": "Border", mono: "Mono", "mono-outline": "Outline" },
    brands: { visa: "Visa", mastercard: "Mastercard", amex: "American Express", unionpay: "UnionPay", jcb: "JCB", discover: "Discover", diners: "Diners", alipay: "Alipay", paypal: "PayPal", maestro: "Maestro", elo: "Elo", mir: "Mir", generic: "Generic" },
    payments: { applePay: "Apple Pay", googlePay: "Google Pay", weChatPay: "WeChat Pay", visa: "Visa", mastercard: "Mastercard", amex: "Amex", unionPay: "UnionPay", alipay: "Alipay", payPal: "PayPal", jcb: "JCB", discover: "Discover", klarna: "Klarna" },
    groups: { official: "Brand assets", payment: "Payments", banks: "Banks", bankMarks: "Bank lockups" },
    locked: "Locked",
    logoReady: "Multiple files: SVG, PNG, JPG, WebP",
    logoNeed: "Upload a card image first",
    none: "No logos yet",
  },
};
const uiText = {
  zh: { title: "卡面设计生成器", theme: "深色", themeLight: "浅色", github: "GitHub 项目", support: "赞赏", afdian: "爱发电", wechatSupport: "微信赞赏码", close: "关闭", preview: "卡面预览", export: "导出 PNG", emptyTitle: "上传一张图片作为卡面", emptyText: "图片会按 1.586 : 1 铺满并居中，之后可以缩放和拖动调整构图。", choose: "选择图片", rounded: "按 3.18 mm 圆角呈现（导出同步）", dragCard: "拖动卡面", dragRef: "拖动参考图", clear: "清空", uploadLogo: "上传自己的 logo", requestLogo: "提交 logo", cardImage: "卡面图片", dropCard: "拖拽图片到此处，或点击选择", refit: "重新匹配", zoom: "缩放", cardNote: "图片会等比缩放并居中填满卡面，超出部分自动裁掉。", reference: "参考图", dropRef: "拖拽参考图到此处，或点击选择", refHint: "只用于对位，不会出现在导出的 PNG 里", showRef: "显示参考图", opacity: "透明度", adjust: "调整", selectLogo: "点击卡面上的 logo 进行编辑", size: "大小", rotate: "旋转", lock: "锁定", up: "上移", down: "下移", delete: "删除", layers: "图层", noLogo: "暂无 logo", legal: "输出只是视觉设计文件，不代表任何机构发行的卡片。图标来自公开素材库，使用前请确认你有相应授权。" },
  en: { title: "Card Design Generator", theme: "Dark", themeLight: "Light", github: "GitHub project", support: "Support", afdian: "Afdian", wechatSupport: "WeChat", close: "Close", preview: "Card preview", export: "Export PNG", emptyTitle: "Upload an image for the card", emptyText: "The image fills the 1.586:1 card and can then be zoomed and dragged.", choose: "Choose image", rounded: "Show 3.18 mm rounded corners (also exported)", dragCard: "Move card", dragRef: "Move reference", clear: "Clear", uploadLogo: "Upload your own logos", requestLogo: "Submit a logo", cardImage: "Card image", dropCard: "Drop an image here, or click to choose", refit: "Refit", zoom: "Zoom", cardNote: "The image is scaled and centered to fill the card. Overflow is cropped.", reference: "Reference", dropRef: "Drop a reference here, or click to choose", refHint: "Used for alignment only. It is not included in the PNG.", showRef: "Show reference", opacity: "Opacity", adjust: "Adjust", selectLogo: "Click a logo on the card to edit it", size: "Size", rotate: "Rotate", lock: "Lock", up: "Up", down: "Down", delete: "Delete", layers: "Layers", noLogo: "No logos yet", legal: "The output is a visual design file only. Logos come from public asset libraries; confirm permission before publishing." },
};
let language = localStorage.getItem("card-lang") || "zh";
const copy = () => dictionaries[language];

const bankIndex = [{"id":"BOSC","name":"上海银行","icon":"assets/banks/BOSC.svg","wordmark":"assets/banks/BOSC_wordmark.svg"},{"id":"SRBANK","name":"上饶银行","icon":"assets/banks/SRBANK.svg"},{"id":"BOD","name":"东莞银行","icon":"assets/banks/BOD.svg","wordmark":"assets/banks/BOD_wordmark.svg"},{"id":"DYCCB","name":"东营银行","icon":"assets/banks/DYCCB.svg","wordmark":"assets/banks/DYCCB_wordmark.svg"},{"id":"CITIC","name":"中信银行","icon":"assets/banks/CITIC.svg","wordmark":"assets/banks/CITIC_wordmark.svg"},{"id":"ZYBANK","name":"中原银行","icon":"assets/banks/ZYBANK.svg","wordmark":"assets/banks/ZYBANK_wordmark.svg"},{"id":"PBOC","name":"中国人民银行","icon":"assets/banks/PBOC.svg","wordmark":"assets/banks/PBOC_wordmark.svg"},{"id":"CEB","name":"中国光大银行","icon":"assets/banks/CEB.svg","wordmark":"assets/banks/CEB_wordmark.svg"},{"id":"ADBC","name":"中国农业发展银行","icon":"assets/banks/ADBC.svg"},{"id":"ABC","name":"中国农业银行","icon":"assets/banks/ABC.svg","wordmark":"assets/banks/ABC_wordmark.svg"},{"id":"ICBC","name":"中国工商银行","icon":"assets/banks/ICBC.svg","wordmark":"assets/banks/ICBC_wordmark.svg"},{"id":"CCB","name":"中国建设银行","icon":"assets/banks/CCB.svg","wordmark":"assets/banks/CCB_wordmark.svg"},{"id":"CMBC","name":"中国民生银行","icon":"assets/banks/CMBC.svg","wordmark":"assets/banks/CMBC_wordmark.svg"},{"id":"EIBOF","name":"中国进出口银行","icon":"assets/banks/EIBOF.svg","wordmark":"assets/banks/EIBOF_wordmark.svg"},{"id":"PSBC","name":"中国邮政储蓄银行","icon":"assets/banks/PSBC.svg","wordmark":"assets/banks/PSBC_wordmark.svg"},{"id":"BOC","name":"中国银行","icon":"assets/banks/BOC.svg","wordmark":"assets/banks/BOC_wordmark.svg"},{"id":"LSBC","name":"临商银行","icon":"assets/banks/LSBC.svg","wordmark":"assets/banks/LSBC_wordmark.svg"},{"id":"BODD","name":"丹东银行","icon":"assets/banks/BODD.svg","wordmark":"assets/banks/BODD_wordmark.svg"},{"id":"WHBANK","name":"乌海银行","icon":"assets/banks/WHBANK.svg","wordmark":"assets/banks/WHBANK_wordmark.svg"},{"id":"UCCB","name":"乌鲁木齐市商业银行","icon":"assets/banks/UCCB.svg","wordmark":"assets/banks/UCCB_wordmark.svg"},{"id":"LSCCB","name":"乐山市商业银行","icon":"assets/banks/LSCCB.svg","wordmark":"assets/banks/LSCCB_wordmark.svg"},{"id":"JJCCB","name":"九江银行","icon":"assets/banks/JJCCB.svg","wordmark":"assets/banks/JJCCB_wordmark.svg"},{"id":"YNHTBANK","name":"云南红塔银行","icon":"assets/banks/YNHTBANK.svg","wordmark":"assets/banks/YNHTBANK_wordmark.svg"},{"id":"COMM","name":"交通银行","icon":"assets/banks/COMM.svg","wordmark":"assets/banks/COMM_wordmark.svg"},{"id":"BOBD","name":"保定银行","icon":"assets/banks/BOBD.svg","wordmark":"assets/banks/BOBD_wordmark.svg"},{"id":"LZBANK","name":"兰州银行","icon":"assets/banks/LZBANK.svg","wordmark":"assets/banks/LZBANK_wordmark.svg"},{"id":"CIB","name":"兴业银行","icon":"assets/banks/CIB.svg","wordmark":"assets/banks/CIB_wordmark.svg"},{"id":"H3CB","name":"内蒙古银行","icon":"assets/banks/H3CB.svg"},{"id":"BOB","name":"北京银行","icon":"assets/banks/BOB.svg","wordmark":"assets/banks/BOB_wordmark.svg"},{"id":"HXB","name":"华夏银行","icon":"assets/banks/HXB.svg","wordmark":"assets/banks/HXB_wordmark.svg"},{"id":"HRXJB","name":"华融湘江银行","icon":"assets/banks/HRXJB.svg","wordmark":"assets/banks/HRXJB_wordmark.svg"},{"id":"NJCB","name":"南京银行","icon":"assets/banks/NJCB.svg","wordmark":"assets/banks/NJCB_wordmark.svg"},{"id":"XMINTB","name":"厦门国际银行","icon":"assets/banks/XMINTB.svg","wordmark":"assets/banks/XMINTB_wordmark.svg"},{"id":"XMBANK","name":"厦门银行","icon":"assets/banks/XMBANK.svg","wordmark":"assets/banks/XMBANK_wordmark.svg"},{"id":"TZBANK","name":"台州银行","icon":"assets/banks/TZBANK.svg","wordmark":"assets/banks/TZBANK_wordmark.svg"},{"id":"BOJL","name":"吉林银行","icon":"assets/banks/BOJL.svg","wordmark":"assets/banks/BOJL_wordmark.svg"},{"id":"HMCCB","name":"哈密市商业银行","icon":"assets/banks/HMCCB.svg","wordmark":"assets/banks/HMCCB_wordmark.svg"},{"id":"HRBCB","name":"哈尔滨银行","icon":"assets/banks/HRBCB.svg","wordmark":"assets/banks/HRBCB_wordmark.svg"},{"id":"BOTS","name":"唐山银行","icon":"assets/banks/BOTS.svg","wordmark":"assets/banks/BOTS_wordmark.svg"},{"id":"JXBANK","name":"嘉兴银行","icon":"assets/banks/JXBANK.svg","wordmark":"assets/banks/JXBANK_wordmark.svg"},{"id":"SCTFB","name":"四川天府银行","icon":"assets/banks/SCTFB.svg","wordmark":"assets/banks/SCTFB_wordmark.svg"},{"id":"SCB","name":"四川银行","icon":"assets/banks/SCB.svg","wordmark":"assets/banks/SCB_wordmark.svg"},{"id":"CDB","name":"国家开发银行","icon":"assets/banks/CDB.svg","wordmark":"assets/banks/CDB_wordmark.svg"},{"id":"DTB","name":"大同银行","icon":"assets/banks/DTB.svg","wordmark":"assets/banks/DTB_wordmark.svg"},{"id":"DLB","name":"大连银行","icon":"assets/banks/DLB.svg","wordmark":"assets/banks/DLB_wordmark.svg"},{"id":"BOTJ","name":"天津银行","icon":"assets/banks/BOTJ.svg","wordmark":"assets/banks/BOTJ_wordmark.svg"},{"id":"WHCCB","name":"威海市商业银行","icon":"assets/banks/WHCCB.svg","wordmark":"assets/banks/WHCCB_wordmark.svg"},{"id":"NXBANK","name":"宁夏银行","icon":"assets/banks/NXBANK.svg","wordmark":"assets/banks/NXBANK_wordmark.svg"},{"id":"NDHB","name":"宁波东海银行","icon":"assets/banks/NDHB.svg"},{"id":"NBCMB","name":"宁波通商银行","icon":"assets/banks/NBCMB.svg","wordmark":"assets/banks/NBCMB_wordmark.svg"},{"id":"NBCB","name":"宁波银行","icon":"assets/banks/NBCB.svg","wordmark":"assets/banks/NBCB_wordmark.svg"},{"id":"YBCCB","name":"宜宾市商业银行","icon":"assets/banks/YBCCB.svg","wordmark":"assets/banks/YBCCB_wordmark.svg"},{"id":"FDBANK","name":"富滇银行","icon":"assets/banks/FDBANK.svg","wordmark":"assets/banks/FDBANK_wordmark.svg"},{"id":"SPABANK","name":"平安银行","icon":"assets/banks/SPABANK.svg","wordmark":"assets/banks/SPABANK_wordmark.svg"},{"id":"BOP","name":"平顶山银行","icon":"assets/banks/BOP.svg","wordmark":"assets/banks/BOP_wordmark.svg"},{"id":"GHB","name":"广东华兴银行","icon":"assets/banks/GHB.svg","wordmark":"assets/banks/GHB_wordmark.svg"},{"id":"NYBANK","name":"广东南粤银行","icon":"assets/banks/NYBANK.svg","wordmark":"assets/banks/NYBANK_wordmark.svg"},{"id":"GDB","name":"广发银行","icon":"assets/banks/GDB.svg","wordmark":"assets/banks/GDB_wordmark.svg"},{"id":"GZCB","name":"广州银行","icon":"assets/banks/GZCB.svg","wordmark":"assets/banks/GZCB_wordmark.svg"},{"id":"BGB","name":"广西北部湾银行","icon":"assets/banks/BGB.svg","wordmark":"assets/banks/BGB_wordmark.svg"},{"id":"KCCCB","name":"库尔勒市商业银行","icon":"assets/banks/KCCCB.svg","wordmark":"assets/banks/KCCCB_wordmark.svg"},{"id":"BOLF","name":"廊坊银行","icon":"assets/banks/BOLF.svg","wordmark":"assets/banks/BOLF_wordmark.svg"},{"id":"ZJKCCB","name":"张家口银行","icon":"assets/banks/ZJKCCB.svg","wordmark":"assets/banks/ZJKCCB_wordmark.svg"},{"id":"DZBANK","name":"德州银行","icon":"assets/banks/DZBANK.svg","wordmark":"assets/banks/DZBANK_wordmark.svg"},{"id":"HSBANK","name":"徽商银行","icon":"assets/banks/HSBANK.svg","wordmark":"assets/banks/HSBANK_wordmark.svg"},{"id":"EGBANK","name":"恒丰银行","icon":"assets/banks/EGBANK.svg","wordmark":"assets/banks/EGBANK_wordmark.svg"},{"id":"CDCB","name":"成都银行","icon":"assets/banks/CDCB.svg","wordmark":"assets/banks/CDCB_wordmark.svg"},{"id":"CDBANK","name":"承德银行","icon":"assets/banks/CDBANK.svg","wordmark":"assets/banks/CDBANK_wordmark.svg"},{"id":"FSCB","name":"抚顺银行","icon":"assets/banks/FSCB.svg","wordmark":"assets/banks/FSCB_wordmark.svg"},{"id":"CMB","name":"招商银行","icon":"assets/banks/CMB.svg","wordmark":"assets/banks/CMB_wordmark.svg"},{"id":"XJHB","name":"新疆汇和银行","icon":"assets/banks/XJHB.svg","wordmark":"assets/banks/XJHB_wordmark.svg"},{"id":"XJB","name":"新疆银行","icon":"assets/banks/XJB.svg"},{"id":"RZB","name":"日照银行","icon":"assets/banks/RZB.svg","wordmark":"assets/banks/RZB_wordmark.svg"},{"id":"KLB","name":"昆仑银行","icon":"assets/banks/KLB.svg","wordmark":"assets/banks/KLB_wordmark.svg"},{"id":"JZB","name":"晋中银行","icon":"assets/banks/JZB.svg"},{"id":"JSB","name":"晋商银行","icon":"assets/banks/JSB.svg","wordmark":"assets/banks/JSB_wordmark.svg"},{"id":"JINCHB","name":"晋城银行","icon":"assets/banks/JINCHB.svg","wordmark":"assets/banks/JINCHB_wordmark.svg"},{"id":"QJCCCB","name":"曲靖市商业银行","icon":"assets/banks/QJCCCB.svg","wordmark":"assets/banks/QJCCCB_wordmark.svg"},{"id":"BOCY","name":"朝阳银行","icon":"assets/banks/BOCY.svg","wordmark":"assets/banks/BOCY_wordmark.svg"},{"id":"BCCB","name":"本溪市商业银行","icon":"assets/banks/BCCB.svg","wordmark":"assets/banks/BCCB_wordmark.svg"},{"id":"HZCB","name":"杭州银行","icon":"assets/banks/HZCB.svg","wordmark":"assets/banks/HZCB_wordmark.svg"},{"id":"ZZB","name":"枣庄银行","icon":"assets/banks/ZZB.svg","wordmark":"assets/banks/ZZB_wordmark.svg"},{"id":"LZCCB","name":"柳州银行","icon":"assets/banks/LZCCB.svg","wordmark":"assets/banks/LZCCB_wordmark.svg"},{"id":"GLBANK","name":"桂林银行","icon":"assets/banks/GLBANK.svg","wordmark":"assets/banks/GLBANK_wordmark.svg"},{"id":"HKB","name":"汉口银行","icon":"assets/banks/HKB.svg","wordmark":"assets/banks/HKB_wordmark.svg"},{"id":"JSBANK","name":"江苏银行","icon":"assets/banks/JSBANK.svg","wordmark":"assets/banks/JSBANK_wordmark.svg"},{"id":"JSCJCB","name":"江苏长江商业银行","icon":"assets/banks/JSCJCB.svg","wordmark":"assets/banks/JSCJCB_wordmark.svg"},{"id":"JXB","name":"江西银行","icon":"assets/banks/JXB.svg","wordmark":"assets/banks/JXB_wordmark.svg"},{"id":"BOCZ","name":"沧州银行","icon":"assets/banks/BOCZ.svg","wordmark":"assets/banks/BOCZ_wordmark.svg"},{"id":"BHB","name":"河北银行","icon":"assets/banks/BHB.svg","wordmark":"assets/banks/BHB_wordmark.svg"},{"id":"BOQZ","name":"泉州银行","icon":"assets/banks/BOQZ.svg","wordmark":"assets/banks/BOQZ_wordmark.svg"},{"id":"TACCB","name":"泰安银行","icon":"assets/banks/TACCB.svg","wordmark":"assets/banks/TACCB_wordmark.svg"},{"id":"TLCB","name":"泰隆银行","icon":"assets/banks/TLCB.svg","wordmark":"assets/banks/TLCB_wordmark.svg"},{"id":"LZB","name":"泸州银行","icon":"assets/banks/LZB.svg","wordmark":"assets/banks/LZB_wordmark.svg"},{"id":"BLY","name":"洛阳银行","icon":"assets/banks/BLY.svg","wordmark":"assets/banks/BLY_wordmark.svg"},{"id":"JNBANK","name":"济宁银行","icon":"assets/banks/JNBANK.svg","wordmark":"assets/banks/JNBANK_wordmark.svg"},{"id":"CZBANK","name":"浙商银行","icon":"assets/banks/CZBANK.svg","wordmark":"assets/banks/CZBANK_wordmark.svg"},{"id":"MTBANK","name":"浙江民泰商业银行","icon":"assets/banks/MTBANK.svg","wordmark":"assets/banks/MTBANK_wordmark.svg"},{"id":"CZCB","name":"浙江稠州商业银行","icon":"assets/banks/CZCB.svg","wordmark":"assets/banks/CZCB_wordmark.svg"},{"id":"SPDB","name":"浦发银行","icon":"assets/banks/SPDB.svg","wordmark":"assets/banks/SPDB_wordmark.svg"},{"id":"HNB","name":"海南银行","icon":"assets/banks/HNB.svg","wordmark":"assets/banks/HNB_wordmark.svg"},{"id":"BOHAIB","name":"渤海银行","icon":"assets/banks/BOHAIB.svg","wordmark":"assets/banks/BOHAIB_wordmark.svg"},{"id":"WZBANK","name":"温州银行","icon":"assets/banks/WZBANK.svg","wordmark":"assets/banks/WZBANK_wordmark.svg"},{"id":"HBC","name":"湖北银行","icon":"assets/banks/HBC.svg","wordmark":"assets/banks/HBC_wordmark.svg"},{"id":"BOHZ","name":"湖州银行","icon":"assets/banks/BOHZ.svg","wordmark":"assets/banks/BOHZ_wordmark.svg"},{"id":"WFCCB","name":"潍坊银行","icon":"assets/banks/WFCCB.svg","wordmark":"assets/banks/WFCCB_wordmark.svg"},{"id":"YTB","name":"烟台银行","icon":"assets/banks/YTB.svg","wordmark":"assets/banks/YTB_wordmark.svg"},{"id":"CTS","name":"焦作中旅银行","icon":"assets/banks/CTS.svg"},{"id":"RBOZ","name":"珠海华润银行","icon":"assets/banks/RBOZ.svg","wordmark":"assets/banks/RBOZ_wordmark.svg"},{"id":"BOGS","name":"甘肃银行","icon":"assets/banks/BOGS.svg","wordmark":"assets/banks/BOGS_wordmark.svg"},{"id":"BOPJ","name":"盘锦银行","icon":"assets/banks/BOPJ.svg","wordmark":"assets/banks/BOPJ_wordmark.svg"},{"id":"SJBANK","name":"盛京银行","icon":"assets/banks/SJBANK.svg","wordmark":"assets/banks/SJBANK_wordmark.svg"},{"id":"SZSBK","name":"石嘴山银行","icon":"assets/banks/SZSBK.svg","wordmark":"assets/banks/SZSBK_wordmark.svg"},{"id":"FJHXBC","name":"福建海峡银行","icon":"assets/banks/FJHXBC.svg","wordmark":"assets/banks/FJHXBC_wordmark.svg"},{"id":"QHDBANK","name":"秦皇岛银行","icon":"assets/banks/QHDBANK.svg","wordmark":"assets/banks/QHDBANK_wordmark.svg"},{"id":"SXCB","name":"绍兴银行","icon":"assets/banks/SXCB.svg","wordmark":"assets/banks/SXCB_wordmark.svg"},{"id":"MYCCB","name":"绵阳市商业银行","icon":"assets/banks/MYCCB.svg","wordmark":"assets/banks/MYCCB_wordmark.svg"},{"id":"Mybank","name":"网商银行","icon":"assets/banks/Mybank.svg","wordmark":"assets/banks/Mybank_wordmark.svg"},{"id":"ZGBANK","name":"自贡银行","icon":"assets/banks/ZGBANK.svg","wordmark":"assets/banks/ZGBANK_wordmark.svg"},{"id":"BOSZ","name":"苏州银行","icon":"assets/banks/BOSZ.svg","wordmark":"assets/banks/BOSZ_wordmark.svg"},{"id":"LSBANK","name":"莱商银行","icon":"assets/banks/LSBANK.svg","wordmark":"assets/banks/LSBANK_wordmark.svg"},{"id":"YKYHB","name":"营口沿海银行","icon":"assets/banks/YKYHB.svg"},{"id":"BOYK","name":"营口银行","icon":"assets/banks/BOYK.svg","wordmark":"assets/banks/BOYK_wordmark.svg"},{"id":"BOHLD","name":"葫芦岛银行","icon":"assets/banks/BOHLD.svg","wordmark":"assets/banks/BOHLD_wordmark.svg"},{"id":"BOHS","name":"衡水银行","icon":"assets/banks/BOHS.svg"},{"id":"XABANK","name":"西安银行","icon":"assets/banks/XABANK.svg","wordmark":"assets/banks/XABANK_wordmark.svg"},{"id":"BOXZ","name":"西藏银行","icon":"assets/banks/BOXZ.svg","wordmark":"assets/banks/BOXZ_wordmark.svg"},{"id":"BOGZ","name":"贵州银行","icon":"assets/banks/BOGZ.svg","wordmark":"assets/banks/BOGZ_wordmark.svg"},{"id":"GYCCB","name":"贵阳银行","icon":"assets/banks/GYCCB.svg","wordmark":"assets/banks/GYCCB_wordmark.svg"},{"id":"BOLY","name":"辽阳银行","icon":"assets/banks/BOLY.svg","wordmark":"assets/banks/BOLY_wordmark.svg"},{"id":"DCCB","name":"达州银行","icon":"assets/banks/DCCB.svg","wordmark":"assets/banks/DCCB_wordmark.svg"},{"id":"SNBANK","name":"遂宁银行","icon":"assets/banks/SNBANK.svg","wordmark":"assets/banks/SNBANK_wordmark.svg"},{"id":"XTB","name":"邢台银行","icon":"assets/banks/XTB.svg","wordmark":"assets/banks/XTB_wordmark.svg"},{"id":"HDBANK","name":"邯郸银行","icon":"assets/banks/HDBANK.svg","wordmark":"assets/banks/HDBANK_wordmark.svg"},{"id":"ZZBANK","name":"郑州银行","icon":"assets/banks/ZZBANK.svg","wordmark":"assets/banks/ZZBANK_wordmark.svg"},{"id":"ORDOSB","name":"鄂尔多斯银行","icon":"assets/banks/ORDOSB.svg","wordmark":"assets/banks/ORDOSB_wordmark.svg"},{"id":"CCQTGB","name":"重庆三峡银行","icon":"assets/banks/CCQTGB.svg","wordmark":"assets/banks/CCQTGB_wordmark.svg"},{"id":"CQBANK","name":"重庆银行","icon":"assets/banks/CQBANK.svg","wordmark":"assets/banks/CQBANK_wordmark.svg"},{"id":"JHCCB","name":"金华银行","icon":"assets/banks/JHCCB.svg","wordmark":"assets/banks/JHCCB_wordmark.svg"},{"id":"BOTL","name":"铁岭银行","icon":"assets/banks/BOTL.svg","wordmark":"assets/banks/BOTL_wordmark.svg"},{"id":"JZBANK","name":"锦州银行","icon":"assets/banks/JZBANK.svg","wordmark":"assets/banks/JZBANK_wordmark.svg"},{"id":"GWB","name":"长城华西银行","icon":"assets/banks/GWB.svg","wordmark":"assets/banks/GWB_wordmark.svg"},{"id":"CABANK","name":"长安银行","icon":"assets/banks/CABANK.svg","wordmark":"assets/banks/CABANK_wordmark.svg"},{"id":"BSCB","name":"长沙银行","icon":"assets/banks/BSCB.svg","wordmark":"assets/banks/BSCB_wordmark.svg"},{"id":"CZB","name":"长治银行","icon":"assets/banks/CZB.svg","wordmark":"assets/banks/CZB_wordmark.svg"},{"id":"FXCB","name":"阜阳银行","icon":"assets/banks/FXCB.svg","wordmark":"assets/banks/FXCB_wordmark.svg"},{"id":"YQCCB","name":"阳泉市商业银行","icon":"assets/banks/YQCCB.svg","wordmark":"assets/banks/YQCCB_wordmark.svg"},{"id":"YACCB","name":"雅安市商业银行","icon":"assets/banks/YACCB.svg","wordmark":"assets/banks/YACCB_wordmark.svg"},{"id":"QDCCB","name":"青岛银行","icon":"assets/banks/QDCCB.svg","wordmark":"assets/banks/QDCCB_wordmark.svg"},{"id":"QHBANK","name":"青海银行","icon":"assets/banks/QHBANK.svg","wordmark":"assets/banks/QHBANK_wordmark.svg"},{"id":"BOAS","name":"鞍山银行","icon":"assets/banks/BOAS.svg","wordmark":"assets/banks/BOAS_wordmark.svg"},{"id":"QSB","name":"齐商银行","icon":"assets/banks/QSB.svg","wordmark":"assets/banks/QSB_wordmark.svg"},{"id":"QLBANK","name":"齐鲁银行","icon":"assets/banks/QLBANK.svg","wordmark":"assets/banks/QLBANK_wordmark.svg"},{"id":"LJBANK","name":"龙江银行","icon":"assets/banks/LJBANK.svg","wordmark":"assets/banks/LJBANK_wordmark.svg"}];

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
    { id: "banks", name: text.groups.banks, marks: bankIndex.map((bank) => ({ id: `bank-${bank.id}`, name: bank.name, src: bank.icon, width: 92 })) },
    { id: "bank-marks", name: text.groups.bankMarks, marks: bankIndex.filter((bank) => bank.wordmark).map((bank) => ({ id: `bank-mark-${bank.id}`, name: bank.name, src: bank.wordmark, width: 180 })) },
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
  document.querySelectorAll("[data-i18n-label]").forEach((node) => {
    node.setAttribute("aria-label", uiText[language][node.dataset.i18nLabel]);
  });
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
applyLanguage();
paint();
renderLogos();
