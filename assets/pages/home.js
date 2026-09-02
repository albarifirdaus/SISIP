      (() => {
        "use strict";

        const { slugify, clone, esc, safeImage, imageAspect, imageFrameClass, money, uid } = window.COMOOTDCore;
        const STORAGE_KEY = "sisip-prototype-v1";
        const SHARE_ICON = `<svg class="social-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-7.7 18-3.15-7.15L3 10.7 21 3Z"/><path d="m10.15 13.85 4.35-4.35"/></svg>`;
        const TONES = {
          carbon: { bg: "#393430", accent: "#a9553c", garment: "#171614", bottom: "#292522", figure: "#d7c6b7", skin: "#9a6a52", skinDark: "#825542", hair: "#1b1816", label: "#f7f3ed", light: false },
          clay: { bg: "#b9674e", accent: "#e5d3c0", garment: "#3a2924", bottom: "#28211e", figure: "#ead8c7", skin: "#a66e50", skinDark: "#8a543e", hair: "#37221b", label: "#fff9f0", light: false },
          mineral: { bg: "#d5cdc4", accent: "#81746b", garment: "#332f2b", bottom: "#77716b", figure: "#1f1d1b", skin: "#b37d60", skinDark: "#966047", hair: "#161514", label: "#221f1c", light: false },
          olive: { bg: "#747466", accent: "#d4b48b", garment: "#30382b", bottom: "#1f261e", figure: "#d7c6b7", skin: "#8e6049", skinDark: "#744734", hair: "#191714", label: "#f7f3ed", light: false },
          midnight: { bg: "#263038", accent: "#b66c59", garment: "#d7d4cc", bottom: "#3e454a", figure: "#e8ddcf", skin: "#9d694f", skinDark: "#81503d", hair: "#211b19", label: "#f8f6f2", light: true }
        };
        const STYLE_ORDER = ["Clean", "Casual", "Formal", "Streetwear", "Modest", "Sporty", "Vintage", "Korean-inspired", "Workwear", "Party"];
        const PRODUCT_BADGE_OPTIONS = ["", "COMOOTD Pick", "High Rotation", "Wardrobe Staple", "New In", "Trending", "Best Value", "Limited"];
        const MARKETPLACES = {
          shopee: { label:"Shopee", placeholder:"https://shopee.co.id/..." },
          tiktok_shop: { label:"TikTok Shop", placeholder:"https://shop.tiktok.com/..." },
          website: { label:"Website", placeholder:"https://brand.com/product/..." }
        };
        const PRODUCT_CATEGORIES = { top:"Atasan", bottom:"Bawahan", outerwear:"Outerwear", dress:"Dress / Set", footwear:"Sepatu", bag:"Tas", accessory:"Aksesori", hijab:"Hijab", jewelry:"Perhiasan", other:"Lainnya" };
        const ARTICLE_CATEGORIES = {
          "style-guide": "Style guide",
          "occasion-guide": "Occasion guide",
          "trend-watch": "Trend watch",
          editorial: "Editorial",
          "shopping-guide": "Shopping guide",
          "wardrobe-notes": "Wardrobe notes"
        };
        const MEMBER_PROFILE_TAG_LIMIT = 10;
        const MEMBER_PROFILE_TAG_FIELDS = {
          styleTags: {
            inputId: "memberProfileStyles", optionsId: "memberProfileStylesOptions", countId: "memberProfileStylesCount", label: "style",
            options: ["Clean", "Casual", "Smart Casual", "Formal", "Minimalis", "Classic", "Workwear", "Streetwear", "Sporty", "Athleisure", "Preppy", "Vintage", "Retro", "Korean-inspired", "Japanese-inspired", "Modest", "Feminine", "Masculine", "Androgynous", "Bohemian", "Romantic", "Edgy", "Party", "Vacation", "Denim"]
          }
        };
        const MEMBER_STYLE_ALIASES = {
          "smart casual": ["clean", "casual", "formal"], minimalis: ["clean"], classic: ["clean", "formal"], preppy: ["clean", "casual"], athleisure: ["sporty", "casual"], retro: ["vintage"], "japanese-inspired": ["clean", "workwear"], feminine: ["clean", "formal"], masculine: ["formal", "workwear"], androgynous: ["clean", "streetwear"], bohemian: ["vintage", "casual"], romantic: ["formal", "party"], edgy: ["streetwear", "party"], vacation: ["casual", "sporty"], denim: ["casual", "vintage"]
        };
        const JOURNAL_BLOCK_LIMIT = 20;
        const JOURNAL_CTA_LIMIT = 3;
        const BULK_IMPORT_HEADERS = ["product_key", "name", "marketplace", "affiliate_url", "price_idr", "badge", "style_tags", "style_tag_1", "style_tag_2", "style_tag_3", "gender_target", "category", "cover_image_url", "color_name", "color_hex", "variant_image_url"];
        const BULK_IMPORT_TEMPLATE_ROWS = [
          ["OXFORD-001", "Relaxed Oxford Shirt", "shopee", "https://shope.ee/contoh-link", "229000", "COMOOTD Pick", "", "Clean", "Formal", "", "unisex", "top", "https://cdn.contoh.com/oxford-cover.jpg", "Putih", "#F1F0EC", ""],
          ["OXFORD-001", "Relaxed Oxford Shirt", "shopee", "https://shope.ee/contoh-link", "229000", "COMOOTD Pick", "", "Clean", "Formal", "", "unisex", "top", "https://cdn.contoh.com/oxford-cover.jpg", "Biru kabut", "#AAB7C7", "https://cdn.contoh.com/oxford-biru.jpg"],
          ["TROUSER-001", "Pleated Straight Trousers", "tiktok_shop", "https://shop.tiktok.com/view/product/contoh", "289000", "", "", "Clean", "Formal", "", "unisex", "bottom", "https://cdn.contoh.com/trouser-cover.jpg", "Charcoal", "#3B3A38", ""],
          ["LOAFER-001", "Leather Penny Loafers", "shopee", "https://shope.ee/contoh-link", "319000", "High Rotation", "", "Formal", "Clean", "", "unisex", "footwear", "https://cdn.contoh.com/loafer-cover.jpg", "Hitam", "#211F1D", ""]
        ];
        const BULK_LOOK_IMPORT_HEADERS = ["look_key", "title", "excerpt", "gender_target", "style_tags", "style_tag_1", "style_tag_2", "style_tag_3", "cover_image_url", "cover_alt_text", "item_position", "product_key", "variant_label"];
        const BULK_LOOK_IMPORT_TEMPLATE_ROWS = [
          ["LEBARAN-CLEAN-01", "Neutral Lebaran", "Layer ringan untuk silaturahmi dengan warna netral.", "unisex", "", "Modest", "Clean", "Formal", "https://cdn.contoh.com/lebaran-cover.jpg", "Look modest bernuansa netral untuk silaturahmi", "1", "OXFORD-001", "Putih"],
          ["LEBARAN-CLEAN-01", "Neutral Lebaran", "Layer ringan untuk silaturahmi dengan warna netral.", "unisex", "", "Modest", "Clean", "Formal", "https://cdn.contoh.com/lebaran-cover.jpg", "Look modest bernuansa netral untuk silaturahmi", "2", "TROUSER-001", "Charcoal"],
          ["LEBARAN-CLEAN-01", "Neutral Lebaran", "Layer ringan untuk silaturahmi dengan warna netral.", "unisex", "", "Modest", "Clean", "Formal", "https://cdn.contoh.com/lebaran-cover.jpg", "Look modest bernuansa netral untuk silaturahmi", "3", "LOAFER-001", "Hitam"]
        ];
        const BULK_IMPORT_MAX_ROWS = 1000;
        const BULK_IMPORT_MAX_PRODUCTS = 200;
        const BULK_LOOK_IMPORT_MAX_ROWS = 1000;
        const BULK_LOOK_IMPORT_MAX_LOOKS = 200;
        const ARTICLES = [
          { id: "a1", number: "01", title: "Cara membuat outfit clean tanpa terlihat kosong.", excerpt: "Outfit clean bukan berarti semua harus putih atau tanpa detail. Mulai dari bentuk, tekstur, dan satu aksen yang menahan seluruh look.", body: "Pilih satu potongan dengan struktur yang jelas—misalnya kemeja oxford, blazer rileks, atau celana berlipit. Setelah itu, buat sisanya lebih tenang. Kontras kecil antara tekstur halus dan tekstur matte sering lebih efektif daripada menambah banyak warna.\n\nSatu aksen yang punya bobot, seperti sepatu kulit gelap atau tas dengan bentuk kuat, cukup untuk memberi look sebuah titik akhir." },
          { id: "a2", number: "02", title: "Warna netral yang tetap punya arah.", excerpt: "Netral tidak selalu berarti aman. Perhatikan suhu warna, kedalaman, dan hubungan antar material.", body: "Abu hangat, olive kusam, cokelat espresso, dan hitam arang punya karakter yang berbeda dari hitam-putih murni. Gunakan dua warna netral yang suhu warnanya serupa, lalu sisipkan satu warna dengan bobot lebih pekat.\n\nDi COMOOTD, warna tidak dibaca sebagai aturan. Ia hanya alat untuk membuat potongan yang berbeda terasa berbicara satu bahasa." },
          { id: "a3", number: "03", title: "Mulai dari satu item, selesai jadi satu look.", excerpt: "Tidak perlu membeli semua hal sekaligus. Biarkan satu item yang kamu suka menentukan arah berikutnya.", body: "Satu cardigan cokelat bisa bergerak ke arah santai bersama denim, atau menjadi lebih rapi ketika dipasangkan dengan rok satin dan Mary Jane. Satu produk yang baik seharusnya membuka beberapa kemungkinan.\n\nKarena itu setiap look di katalog ini dipecah menjadi item. Kamu bisa mengambil keseluruhan arahnya, atau hanya membawa pulang satu idenya." }
        ];

        const SEED_PRODUCTS = [
          product("oxford", "Relaxed Oxford Shirt", 229000, "COMOOTD Pick", ["Clean", "Formal"], [["Putih kertas", "#F1F0EC"], ["Biru kabut", "#AAB7C7"], ["Charcoal", "#45423F"]], "#d9d4cd", "#f1f0ec"),
          product("trouser", "Relaxed Pleat Trousers", 259000, "High Rotation", ["Clean", "Formal"], [["Charcoal", "#3F3C39"], ["Olive gelap", "#52583F"], ["Stone", "#B8AEA1"]], "#bfb5aa", "#3f3c39"),
          product("loafer", "Soft Leather Loafer", 349000, "", ["Clean", "Formal"], [["Hitam", "#1A1918"], ["Cokelat tua", "#563B2C"]], "#cfc4b8", "#1a1918"),
          product("tote", "Soft Structure Tote", 189000, "", ["Clean", "Casual"], [["Cognac", "#86533A"], ["Hitam", "#1D1B19"]], "#d6c5b3", "#86533a"),
          product("blazer", "Relaxed Tailored Blazer", 379000, "COMOOTD Pick", ["Formal", "Clean"], [["Taupe", "#918173"], ["Stone", "#B6AAA0"], ["Hitam", "#242220"]], "#d4c9bf", "#918173"),
          product("fine-knit", "Fine Knit Crewneck", 159000, "", ["Clean", "Formal"], [["Ivory", "#E8E1D6"], ["Ink", "#20201E"], ["Mocha", "#896B5B"]], "#d7d1c9", "#e8e1d6"),
          product("pointed-flats", "Pointed Soft Flats", 179000, "", ["Formal", "Korean-inspired"], [["Hitam", "#1B1A19"], ["Burgundy", "#713A37"]], "#d7d0c9", "#1b1a19"),
          product("shoulder-bag", "Compact Shoulder Bag", 219000, "", ["Formal", "Korean-inspired"], [["Espresso", "#4C3328"], ["Wine", "#70363B"]], "#d5c4b7", "#4c3328"),
          product("overshirt", "Boxy Overshirt", 269000, "", ["Casual", "Streetwear", "Workwear"], [["Charcoal", "#403E3B"], ["Olive", "#59604A"], ["Sand", "#B9AA94"]], "#bbb5ad", "#403e3b"),
          product("heavy-tee", "Heavyweight Plain Tee", 99000, "", ["Casual", "Streetwear"], [["Graphite", "#343434"], ["Ecru", "#DDD7CD"], ["Ash", "#99958E"]], "#d5d0c8", "#343434"),
          product("cargo", "Relaxed Cargo Pants", 239000, "", ["Casual", "Streetwear", "Workwear"], [["Olive", "#58614C"], ["Black", "#22211F"], ["Stone", "#AEA599"]], "#c9c2b8", "#58614c"),
          product("retro-sneaker", "Retro Panel Sneakers", 329000, "High Rotation", ["Casual", "Streetwear"], [["White / Grey", "#E0DFDA"], ["Gum", "#A87850"]], "#d8d4ce", "#e0dfda"),
          product("denim-jacket", "Faded Denim Trucker", 289000, "", ["Casual", "Vintage"], [["Faded blue", "#72879A"], ["Black wash", "#3C3D40"]], "#cad0d2", "#72879a"),
          product("straight-denim", "Straight Denim Jeans", 249000, "", ["Casual", "Vintage"], [["Black wash", "#353638"], ["Indigo", "#3C5368"]], "#c7c5c0", "#353638"),
          product("canvas-sneaker", "Canvas Low Sneakers", 179000, "", ["Casual", "Vintage"], [["Milk", "#EAE5DD"], ["Black", "#22211F"]], "#d8d1c8", "#eae5dd"),
          product("long-outer", "Longline Soft Outer", 319000, "COMOOTD Pick", ["Modest", "Clean"], [["Taupe", "#9E8B7D"], ["Black", "#262422"]], "#d7cbbf", "#9e8b7d"),
          product("flowy-skirt", "Flowy Column Skirt", 229000, "", ["Modest", "Clean"], [["Ink", "#20201E"], ["Mushroom", "#9D8D82"]], "#cbc5bd", "#20201e"),
          product("pashmina", "Textured Pashmina", 89000, "", ["Modest", "Clean"], [["Oat", "#C7B8A6"], ["Black", "#252321"], ["Dusty blue", "#687985"]], "#d8cfc4", "#c7b8a6"),
          product("slingback", "Rounded Slingback", 249000, "", ["Modest", "Formal"], [["Black", "#201F1E"], ["Nude", "#B68B72"]], "#d6c8bc", "#201f1e"),
          product("knit-polo", "Fine Knit Polo", 189000, "", ["Formal", "Party"], [["Black", "#201F1D"], ["Mocha", "#735B50"]], "#cdc4bc", "#201f1d"),
          product("derby", "Polished Derby Shoes", 369000, "", ["Formal", "Party"], [["Black", "#181716"], ["Oxblood", "#542C2B"]], "#cec4ba", "#181716"),
          product("crossbody", "Slim Crossbody Bag", 159000, "", ["Formal", "Streetwear"], [["Black", "#1E1C1B"], ["Chrome", "#919192"]], "#d0c7bd", "#1e1c1b"),
          product("cardigan", "Soft Button Cardigan", 219000, "", ["Korean-inspired", "Casual"], [["Navy", "#344251"], ["Cocoa", "#755545"], ["Mist", "#C7C8C4"]], "#ced0cc", "#344251"),
          product("wide-trouser", "Wide Drape Trousers", 239000, "", ["Korean-inspired", "Formal"], [["Warm grey", "#817C76"], ["Black", "#252321"]], "#cfc9c1", "#817c76"),
          product("mary-jane", "Soft Mary Jane", 199000, "", ["Korean-inspired", "Casual"], [["Black", "#1D1C1A"], ["Cherry", "#883B3A"]], "#d5c9be", "#1d1c1a"),
          product("utility-jacket", "Utility Field Jacket", 299000, "", ["Workwear", "Casual"], [["Olive", "#536047"], ["Sand", "#AA9A82"]], "#c3c3ac", "#536047"),
          product("parachute", "Nylon Parachute Pants", 229000, "", ["Workwear", "Sporty"], [["Sand", "#B4A58E"], ["Black", "#252421"]], "#d3c8bc", "#b4a58e"),
          product("gum-sneaker", "Gum Sole Sneakers", 279000, "", ["Workwear", "Casual"], [["White / Gum", "#E2DED4"], ["Black / Gum", "#2A2825"]], "#d8d1c3", "#e2ded4"),
          product("satin-skirt", "Satin Midi Skirt", 249000, "", ["Casual", "Party"], [["Espresso", "#5C3F34"], ["Black", "#242220"]], "#d0c2b5", "#5c3f34"),
          product("mini-bag", "Mini Frame Bag", 199000, "", ["Casual", "Party"], [["Cocoa", "#704837"], ["Silver", "#A7A5A1"]], "#cfbdaf", "#704837"),
          product("track-jacket", "Retro Track Jacket", 239000, "", ["Sporty", "Casual"], [["Navy", "#283B53"], ["Burgundy", "#6D3334"]], "#c2c7cd", "#283b53"),
          product("nylon-pants", "Easy Nylon Pants", 219000, "", ["Sporty", "Casual"], [["Black", "#232220"], ["Slate", "#58626A"]], "#c4c5c2", "#232220"),
          product("silver-sneaker", "Silver Runner Sneakers", 349000, "High Rotation", ["Sporty", "Streetwear"], [["Silver", "#A6A7AA"], ["White", "#E3E1DC"]], "#d4d4d3", "#a6a7aa"),
          product("satin-shirt", "Fluid Satin Shirt", 259000, "", ["Party", "Formal"], [["Black", "#1C1B1A"], ["Steel", "#596166"]], "#c9c8c4", "#1c1b1a"),
          product("tank", "Ribbed Tank Top", 89000, "", ["Party", "Casual"], [["Black", "#22211F"], ["Bone", "#DDD5CA"]], "#d3cbc1", "#22211f"),
          product("leather-boots", "Sleek Leather Boots", 399000, "", ["Party", "Formal"], [["Black", "#191817"], ["Brown", "#4D352B"]], "#cfc2b6", "#191817"),
          product("metal-bag", "Metallic Mini Bag", 239000, "", ["Party", "Korean-inspired"], [["Metal", "#A5A5A1"], ["Black", "#242220"]], "#cfcdca", "#a5a5a1"),
          product("cap", "Soft Panel Cap", 79000, "", ["Streetwear", "Sporty"], [["Black", "#20201E"], ["Olive", "#5B604C"]], "#cbc7c0", "#20201e")
        ];

        const SEED_LOOKS = [
          look("l01", "Putih yang Tepat", "Uniseks", ["Clean", "Formal"], "carbon", 98, 12, [["oxford", "Putih kertas"], ["trouser", "Charcoal"], ["loafer", "Hitam"], ["tote", "Cognac"]]),
          look("l02", "Hari Kerja, Ringan", "Wanita", ["Formal", "Clean"], "mineral", 92, 11, [["blazer", "Taupe"], ["fine-knit", "Ivory"], ["trouser", "Charcoal"], ["pointed-flats", "Hitam"], ["shoulder-bag", "Espresso"]]),
          look("l03", "Layer Kota", "Pria", ["Casual", "Streetwear"], "carbon", 89, 10, [["overshirt", "Charcoal"], ["heavy-tee", "Graphite"], ["cargo", "Olive"], ["retro-sneaker", "White / Grey"], ["cap", "Black"]]),
          look("l04", "Sunday Denim", "Uniseks", ["Casual", "Vintage"], "clay", 86, 9, [["denim-jacket", "Faded blue"], ["heavy-tee", "Ecru"], ["straight-denim", "Black wash"], ["canvas-sneaker", "Milk"]]),
          look("l05", "Modest Line", "Wanita", ["Modest", "Clean"], "mineral", 95, 8, [["long-outer", "Taupe"], ["fine-knit", "Ink"], ["flowy-skirt", "Ink"], ["pashmina", "Oat"], ["slingback", "Black"]]),
          look("l06", "Sharp After Six", "Pria", ["Formal", "Party"], "midnight", 82, 7, [["knit-polo", "Black"], ["trouser", "Charcoal"], ["derby", "Black"], ["crossbody", "Black"]]),
          look("l07", "Soft Contrast", "Wanita", ["Korean-inspired", "Formal"], "midnight", 91, 6, [["cardigan", "Navy"], ["fine-knit", "Ivory"], ["wide-trouser", "Warm grey"], ["mary-jane", "Black"], ["shoulder-bag", "Wine"]]),
          look("l08", "Olive Utility", "Uniseks", ["Workwear", "Casual"], "olive", 88, 5, [["utility-jacket", "Olive"], ["heavy-tee", "Ecru"], ["parachute", "Sand"], ["gum-sneaker", "White / Gum"], ["cap", "Olive"]]),
          look("l09", "Espresso Date", "Wanita", ["Casual", "Party"], "clay", 90, 4, [["cardigan", "Cocoa"], ["satin-skirt", "Espresso"], ["mary-jane", "Black"], ["mini-bag", "Cocoa"]]),
          look("l10", "Track, Then Coffee", "Uniseks", ["Sporty", "Casual"], "midnight", 84, 3, [["track-jacket", "Navy"], ["heavy-tee", "Ash"], ["nylon-pants", "Black"], ["silver-sneaker", "Silver"], ["cap", "Black"]]),
          look("l11", "Blackout Texture", "Uniseks", ["Party", "Streetwear"], "carbon", 87, 2, [["satin-shirt", "Black"], ["tank", "Black"], ["trouser", "Charcoal"], ["leather-boots", "Black"], ["metal-bag", "Metal"]]),
          look("l12", "Polished Ease", "Pria", ["Formal", "Clean"], "mineral", 80, 1, [["blazer", "Stone"], ["fine-knit", "Ivory"], ["trouser", "Olive gelap"], ["retro-sneaker", "White / Grey"], ["tote", "Hitam"]])
        ];

        function product(id, name, price, badge, styles, variants, artBg, artInk) {
          return { id, slug: slugify(name), name, price, badge, styles, affiliatePlatform:"shopee", affiliateUrl: "https://shopee.co.id/", artBg, artInk, image: "", variants: variants.map(([name, hex]) => ({ id: slugify(name), name, hex })) };
        }
        function look(id, title, gender, styles, tone, popularity, createdOrder, items) {
          return { id, slug: slugify(title), title, gender, styles, tone, popularity, createdOrder, coverImage: "", items: items.map(([productId, variantName]) => ({ productId, variantName })) };
        }
        function preparedImageFile(input) {
          if (!input?.files?.length) return null;
          const cropper = window.COMOOTDImageCropper;
          if (!cropper) return input.files[0];
          const prepared = cropper.getFile(input);
          if (!prepared) throw new Error("Selesaikan pengaturan crop foto terlebih dahulu.");
          return prepared;
        }
        function selectedImageAspect(input, fallback = "portrait") {
          return imageAspect(window.COMOOTDImageCropper?.getAspect?.(input), fallback);
        }
        function bindImageCropper(input, options) {
          if (!input || !window.COMOOTDImageCropper?.bind) return;
          window.COMOOTDImageCropper.bind(input, options);
        }
        const cloud = window.SISIPCloud;
        const cloudEnabled = () => Boolean(cloud?.isConfigured?.());

        let state = loadState();
        let activeStyle = "all";
        let lookDraftItems = [];
        let editingLookId = "";
        let editingProductId = "";
        const studioLibraryFilters = { looks:"", products:"" };
        const studioLibraryLimits = { looks:100, products:100 };
        const studioLibrarySearchTimers = { looks:null, products:null };
        let cloudAdmin = false;
        let bulkImportGroups = [];
        let bulkImportErrors = [];
        let bulkImportWarnings = [];
        let bulkLookImportGroups = [];
        let bulkLookImportErrors = [];
        let bulkLookImportWarnings = [];
        let newSeriesIndex = 0;
        let newSeriesTimer;
        let activeMoodStyle = "";
        let journalDraftBlocks = [makeJournalBlock("paragraph")];
        let journalDraftLookCtas = [];
        let journalDraftProductCtas = [];
        let memberViewer = null;
        let memberRequests = [];
        let memberNotifications = [];
        let curatorApplications = [];
        let resendConfirmationCooldownUntil = 0;
        let resendConfirmationTimer;
        let resendConfirmationInFlight = false;
        let lookGallerySlotOrder = [0, 1, 2];
        let lookGalleryRemovedSlots = new Set();
        let lookGalleryQueue = [];
        let lookGalleryQueueIndex = 0;
        let lookGalleryPreviewUrls = [];
        const memberProfileTagState = Object.fromEntries(Object.keys(MEMBER_PROFILE_TAG_FIELDS).map((key) => [key, []]));
        const requestDrafts = new Map();

        const els = {
          moodList: document.getElementById("moodList"), popularGrid: document.getElementById("popularGrid"), personalGrid: document.getElementById("personalGrid"), lookGrid: document.getElementById("lookGrid"),
          search: document.getElementById("searchInput"), gender: document.getElementById("genderFilter"), style: document.getElementById("styleFilter"), sort: document.getElementById("sortFilter"), styleChips: document.getElementById("styleChips"), resultCount: document.getElementById("resultCount"), heroCount: document.getElementById("heroLookCount"),
          newSeriesCarousel: document.getElementById("newSeriesCarousel"), newSeriesStage: document.getElementById("newSeriesStage"), newSeriesPrev: document.getElementById("newSeriesPrev"), newSeriesNext: document.getElementById("newSeriesNext"), newSeriesDots: document.getElementById("newSeriesDots"),
          lookModal: document.getElementById("lookModal"), lookDetail: document.getElementById("lookDetail"), articleModal: document.getElementById("articleModal"), articleDetail: document.getElementById("articleDetail"), productModal: document.getElementById("productModal"), productDetail: document.getElementById("productDetail"),
          authModal: document.getElementById("authModal"), authForm: document.getElementById("authForm"), authEmail: document.getElementById("authEmail"), authPassword: document.getElementById("authPassword"), authFormError: document.getElementById("authFormError"),
          accountButton: document.getElementById("accountButton"), mobileAccountButton: document.getElementById("mobileAccountButton"), memberModal: document.getElementById("memberModal"), memberAuthView: document.getElementById("memberAuthView"), memberProfileView: document.getElementById("memberProfileView"), memberAuthTitle: document.getElementById("memberAuthTitle"), memberAuthCopy: document.getElementById("memberAuthCopy"), memberAuthForm: document.getElementById("memberAuthForm"), memberAuthError: document.getElementById("memberAuthError"), memberGoogleAuthButton: document.getElementById("memberGoogleAuthButton"), memberAuthSwitch: document.getElementById("memberAuthSwitch"), memberResendConfirmation: document.getElementById("memberResendConfirmation"), memberAuthSubmit: document.getElementById("memberAuthSubmit"), memberDisplayNameField: document.getElementById("memberDisplayNameField"), memberDisplayNameInput: document.getElementById("memberDisplayNameInput"), memberPasswordInput: document.getElementById("memberPasswordInput"), memberProfileForm: document.getElementById("memberProfileForm"), memberProfileError: document.getElementById("memberProfileError"), memberRetentionPanel: document.getElementById("memberRetentionPanel"), memberPrivacyPanel: document.getElementById("memberPrivacyPanel"), memberRequestList: document.getElementById("memberRequestList"), memberSignOutButton: document.getElementById("memberSignOutButton"),
          requestRouteLayer: document.getElementById("requestRouteLayer"), requestForm: document.getElementById("requestForm"), requestStatus: document.getElementById("requestStatus"), requestSubmitButton: document.getElementById("requestSubmitButton"),
          studioDrawer: document.getElementById("studioDrawer"), studioScrim: document.getElementById("studioScrim"), studioModeLabel: document.getElementById("studioModeLabel"), studioModeNote: document.getElementById("studioModeNote"), sampleControls: document.getElementById("sampleControls"), cloudSampleControls: document.getElementById("cloudSampleControls"), importSampleButton: document.getElementById("importSampleButton"), logoutStudioButton: document.getElementById("logoutStudioButton"), lookForm: document.getElementById("lookForm"), lookFormHeading: document.getElementById("lookFormHeading"), lookFormCopy: document.getElementById("lookFormCopy"), lookCoverLabel: document.getElementById("lookCoverLabel"), lookEditActions: document.getElementById("lookEditActions"), cancelLookEditButton: document.getElementById("cancelLookEditButton"), lookSubmitButton: document.getElementById("lookSubmitButton"), lookProduct: document.getElementById("lookProductInput"), lookVariant: document.getElementById("lookVariantInput"), lookDraftItems: document.getElementById("lookDraftItems"), lookFormError: document.getElementById("lookFormError"), productForm: document.getElementById("productForm"), productFormHeading: document.getElementById("productFormHeading"), productFormCopy: document.getElementById("productFormCopy"), productImageLabel: document.getElementById("productImageLabel"), productEditActions: document.getElementById("productEditActions"), cancelProductEditButton: document.getElementById("cancelProductEditButton"), productSubmitButton: document.getElementById("productSubmitButton"), productFormError: document.getElementById("productFormError"), studioLooksSearch: document.getElementById("studioLooksSearch"), studioLooksSearchMeta: document.getElementById("studioLooksSearchMeta"), studioLooksList: document.getElementById("studioLooksList"), loadMoreStudioLooks: document.getElementById("loadMoreStudioLooks"), studioProductsSearch: document.getElementById("studioProductsSearch"), studioProductsSearchMeta: document.getElementById("studioProductsSearchMeta"), studioProductsList: document.getElementById("studioProductsList"), loadMoreStudioProducts: document.getElementById("loadMoreStudioProducts"), studioRequestsList: document.getElementById("studioRequestsList"), journalBlocks: document.getElementById("journalBlocks"), journalLookCtaInput: document.getElementById("journalLookCtaInput"), journalProductCtaInput: document.getElementById("journalProductCtaInput"), addJournalLookCtaButton: document.getElementById("addJournalLookCtaButton"), addJournalProductCtaButton: document.getElementById("addJournalProductCtaButton"), journalLookCtas: document.getElementById("journalLookCtas"), journalProductCtas: document.getElementById("journalProductCtas"), journalForm: document.getElementById("journalForm"), journalFormError: document.getElementById("journalFormError"), studioArticlesList: document.getElementById("studioArticlesList"), newSeriesSlots: document.getElementById("newSeriesSlots"), newSeriesStatus: document.getElementById("newSeriesStatus"), newSeriesError: document.getElementById("newSeriesError"), saveNewSeriesButton: document.getElementById("saveNewSeriesButton"), stylePreviewSlots: document.getElementById("stylePreviewSlots"), stylePreviewStatus: document.getElementById("stylePreviewStatus"), stylePreviewError: document.getElementById("stylePreviewError"), saveStylePreviewsButton: document.getElementById("saveStylePreviewsButton"), bulkProductFile: document.getElementById("bulkProductFile"), downloadBulkTemplateButton: document.getElementById("downloadBulkTemplateButton"), bulkImportButton: document.getElementById("bulkImportButton"), bulkImportStatus: document.getElementById("bulkImportStatus"), bulkImportPreview: document.getElementById("bulkImportPreview"), bulkImportPreviewSummary: document.getElementById("bulkImportPreviewSummary"), bulkImportPreviewList: document.getElementById("bulkImportPreviewList"), bulkImportError: document.getElementById("bulkImportError"), bulkLookFile: document.getElementById("bulkLookFile"), downloadBulkLookTemplateButton: document.getElementById("downloadBulkLookTemplateButton"), bulkLookImportButton: document.getElementById("bulkLookImportButton"), bulkLookImportStatus: document.getElementById("bulkLookImportStatus"), bulkLookImportPreview: document.getElementById("bulkLookImportPreview"), bulkLookImportPreviewSummary: document.getElementById("bulkLookImportPreviewSummary"), bulkLookImportPreviewList: document.getElementById("bulkLookImportPreviewList"), bulkLookImportError: document.getElementById("bulkLookImportError"), toast: document.getElementById("toast")
        };
        Object.assign(els, {
          lookGalleryInput: document.getElementById("lookGalleryInput"),
          lookGalleryOrganizer: document.getElementById("lookGalleryOrganizer"),
          styleTaxonomyAddForm: document.getElementById("styleTaxonomyAddForm"),
          styleTaxonomyNewName: document.getElementById("styleTaxonomyNewName"),
          styleTaxonomyList: document.getElementById("styleTaxonomyList"),
          styleTaxonomyError: document.getElementById("styleTaxonomyError"),
          productColorSearch: document.getElementById("productColorSearch"),
          productColorOptions: document.getElementById("productColorOptions"),
          productColorCount: document.getElementById("productColorCount"),
          productVariantsInput: document.getElementById("productVariantsInput"),
          productLinkInput: document.getElementById("productLinkInput"),
          storefrontVisualSlots: document.getElementById("storefrontVisualSlots"),
          storefrontVisualStatus: document.getElementById("storefrontVisualStatus"),
          storefrontVisualError: document.getElementById("storefrontVisualError"),
          saveStorefrontVisualsButton: document.getElementById("saveStorefrontVisualsButton")
        });
        const notification = window.COMOOTDNotification.create({ element:els.toast });
        const headerNavigation = window.COMOOTDNavigation.create({
          menuButton:document.getElementById("menuButton"),
          mobileNav:document.getElementById("mobileNav")
        });
        window.COMOOTDNavigation.bindSearchShortcut({
          button:document.getElementById("searchButton"),
          target:document.getElementById("lookbook"),
          input:els.search
        });
        const memberAuthentication = window.COMOOTDAuthentication.create({
          elements:{
            title:els.memberAuthTitle, copy:els.memberAuthCopy, displayNameField:els.memberDisplayNameField,
            submit:els.memberAuthSubmit, switchButton:els.memberAuthSwitch, displayNameInput:els.memberDisplayNameInput,
            passwordInput:els.memberPasswordInput, error:els.memberAuthError
          },
          onRenderResend:()=>renderMemberResendControl()
        });
        const lookLikes = window.COMOOTDLookLikes.create({
          escapeHtml:esc, getLook, getCloud:()=>cloud, isCloudEnabled:cloudEnabled, isSignedIn:memberIsSignedIn,
          notify:showToast, requireSignIn:openMemberAccount,
          onUpdated:(entry)=>{ renderLooks(); renderNewSeries(); renderPersonalized(); renderDirectoryRoute(); if (els.lookModal.open) openLook(entry.id,{navigate:false}); },
          emit:(detail)=>window.dispatchEvent(new CustomEvent("comootd:like-change",{detail}))
        });
        const memberRetention = window.COMOOTDMemberRetention.create({
          getState:()=>state, getCloud:()=>cloud, isSignedIn:memberIsSignedIn,
          requireSignIn:openMemberAccount, notify:showToast, escapeHtml:esc, safeImage,
          onChange:()=>{ renderPersonalized(); renderDirectoryRoute(); if (memberIsSignedIn() && !els.memberProfileView.hidden) memberRetention.renderPanel(els.memberRetentionPanel); }
        });
        window.COMOOTDRetentionInstance = memberRetention;
        const memberPrivacy = window.COMOOTDPrivacy;

        function loadState() {
          const config = window.SISIP_CONFIG || {};
          const hasCloudConfig = /^https:\/\//i.test(String(config.supabaseUrl || ""))
            && Boolean(String(config.supabasePublishableKey || "").trim());
          // A configured public site must never expose prototype data while the
          // database request is still in flight (or when a network request
          // fails). Start with an empty cloud catalogue, then hydrate it from
          // Supabase. The sample library remains available only in local mode.
          if (hasCloudConfig) {
            return { products: [], looks: [], articles: [], curators: [], styleTags: [], storefrontVisuals: [], newSeriesSlots: [], newSeriesLookIds: [], newSeriesConfigured: true };
          }
          try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (saved && Array.isArray(saved.products) && Array.isArray(saved.looks)) return { ...saved, articles: Array.isArray(saved.articles) ? saved.articles : clone(ARTICLES), styleTags: Array.isArray(saved.styleTags) ? saved.styleTags : [], storefrontVisuals: Array.isArray(saved.storefrontVisuals) ? saved.storefrontVisuals : [], newSeriesSlots: Array.isArray(saved.newSeriesSlots) ? saved.newSeriesSlots : [], newSeriesLookIds: Array.isArray(saved.newSeriesLookIds) ? saved.newSeriesLookIds : [], newSeriesConfigured: typeof saved.newSeriesConfigured === "boolean" ? saved.newSeriesConfigured : Array.isArray(saved.newSeriesLookIds) && saved.newSeriesLookIds.length > 0 };
          } catch (error) { console.warn("Unable to load SISIP prototype", error); }
          return { products: clone(SEED_PRODUCTS), looks: clone(SEED_LOOKS), articles: clone(ARTICLES), styleTags: [], storefrontVisuals: [], newSeriesSlots: [], newSeriesLookIds: [], newSeriesConfigured: false };
        }
        function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
        function resetState() { state = { products: clone(SEED_PRODUCTS), looks: clone(SEED_LOOKS), articles: clone(ARTICLES), styleTags: [], storefrontVisuals: [], newSeriesSlots: [], newSeriesLookIds: [], newSeriesConfigured: false }; resetLookEditor(); resetProductEditor(); saveState(); renderAll(); showToast("12 look contoh dan product library berhasil dipulihkan."); }
        async function refreshCloudState({ admin = false, quiet = false } = {}) {
          if (!cloudEnabled()) return false;
          try {
            const remoteState = await cloud.loadState({ admin });
            state = { products: remoteState.products || [], looks: remoteState.looks || [], articles: remoteState.articles || [], styleTags: remoteState.styleTags || [], storefrontVisuals: remoteState.storefrontVisuals || [], curators: remoteState.curators || [], requests: admin ? (remoteState.requests || []) : [], newSeriesSlots: remoteState.newSeriesSlots || [], newSeriesLookIds: remoteState.newSeriesLookIds || [], newSeriesConfigured: true };
            hydrateTaxonomyPickers();
            renderAll();
            applyContentRoute({ notify: true });
            updateStudioMode();
            return true;
          } catch (error) {
            console.warn("Unable to load SISIP cloud data", error);
            if (!quiet) showToast("Data cloud belum dapat dimuat. Coba lagi sesaat lagi.");
            return false;
          }
        }
        function updateStudioMode() {
          const cloudMode = cloudEnabled();
          els.studioModeLabel.textContent = cloudMode ? "Supabase cloud" : "Local prototype";
          els.studioModeNote.textContent = cloudMode
            ? "Perubahan di Studio disimpan ke database cloud COMOOTD. Hanya akun admin yang bisa mengelola katalog; data cloud tidak di-reset dari prototype ini."
            : "Semua perubahan di panel ini tersimpan di browser perangkatmu saja. Ini sengaja dibuat supaya sample look dapat ditambah, dihapus, dan di-reset tanpa memengaruhi file asli.";
          els.logoutStudioButton.hidden = !(cloudMode && cloudAdmin);
          updateBulkImportButtons();
        }
        function getProduct(id) { return state.products.find((item) => item.id === id); }
        function getLook(id) { return state.looks.find((item) => item.id === id); }
        function getVariant(productItem, name) { return productItem?.variants?.find((variant) => variant.name === name) || productItem?.variants?.[0]; }
        function getLookTotal(lookItem) { return lookItem.items.reduce((sum, item) => sum + Number(getProduct(item.productId)?.price || 0), 0); }
        function normaliseStyleTag(value) {
          return String(value || "").trim().replace(/\s+/g, " ").slice(0,48);
        }
        function uniqueStyleTags(values) {
          const seen=new Set();
          return (values || []).map(normaliseStyleTag).filter((value)=>{
            const key=value.toLocaleLowerCase("id-ID");
            if(!value||seen.has(key)) return false;
            seen.add(key); return true;
          });
        }
        function getAllStyles() {
          const remote=(state.styleTags || []).filter((tag)=>typeof tag === "string" || tag?.isActive !== false).map((tag)=>typeof tag === "string" ? tag : tag?.name).filter(Boolean);
          const used=[...(state.looks || []).flatMap((entry)=>entry.styles||[]), ...(state.products || []).flatMap((entry)=>entry.styles||[]), ...(state.articles || []).flatMap((entry)=>entry.styles||[])];
          if (cloudEnabled() && remote.length) return uniqueStyleTags(remote);
          return uniqueStyleTags([...STYLE_ORDER,...remote,...used]);
        }
        function appendTaxonomyOption(picker, rawValue, selected = false) {
          if(!picker) return null;
          const value=normaliseStyleTag(rawValue); if(!value) return null;
          const key=value.toLocaleLowerCase("id-ID");
          const existing=[...picker.querySelectorAll("input[type=checkbox]")].find((input)=>String(input.value).toLocaleLowerCase("id-ID")===key);
          if(existing){ if(selected) existing.checked=true; return existing; }
          const template=picker.querySelector(".taxonomy-options input[type=checkbox]");
          const name=template?.name; if(!name) return null;
          const label=document.createElement("label");
          const input=document.createElement("input"); input.type="checkbox"; input.name=name; input.value=value; input.checked=selected;
          const text=document.createElement("span"); text.textContent=value;
          label.append(input,text); picker.querySelector(".taxonomy-options")?.append(label);
          return input;
        }
        function hydrateTaxonomyPickers() {
          const values=getAllStyles();
          const allowed=new Set(values.map((value)=>value.toLocaleLowerCase("id-ID")));
          document.querySelectorAll("[data-taxonomy-picker]").forEach((picker)=>{
            picker.querySelectorAll(".taxonomy-options label").forEach((label)=>{
              const input=label.querySelector("input[type=checkbox]");
              if(input&&!input.checked&&!allowed.has(String(input.value).toLocaleLowerCase("id-ID")))label.remove();
            });
            values.forEach((value)=>appendTaxonomyOption(picker,value));
            refreshTaxonomyPicker(picker);
          });
        }
        function taxonomyValues(form, name, maximum = 3) {
          return uniqueStyleTags([...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input)=>input.value)).slice(0,maximum);
        }
        function setTaxonomyValues(form, name, values = []) {
          const picker=form.querySelector(`input[name="${name}"]`)?.closest("[data-taxonomy-picker]");
          const chosen=uniqueStyleTags(values);
          chosen.forEach((value)=>appendTaxonomyOption(picker,value));
          const selectedKeys=new Set(chosen.map((value)=>value.toLocaleLowerCase("id-ID")));
          form.querySelectorAll(`input[name="${name}"]`).forEach((input)=>{ input.checked=selectedKeys.has(String(input.value).toLocaleLowerCase("id-ID")); });
          refreshTaxonomyPicker(picker);
        }
        function refreshTaxonomyPicker(picker) {
          if (!picker) return;
          const maximum = Number(picker.dataset.maxTags || 3);
          const selected = [...picker.querySelectorAll("input:checked")];
          picker.querySelector("[data-taxonomy-count]")?.replaceChildren(`${selected.length} / ${maximum}`);
          picker.querySelectorAll("label").forEach((label) => label.classList.toggle("is-selected", Boolean(label.querySelector("input")?.checked)));
        }
        function setupTaxonomyPickers() {
          hydrateTaxonomyPickers();
          document.addEventListener("change", (event) => {
            const input = event.target.closest("[data-taxonomy-picker] input[type=checkbox]");
            if (!input) return;
            const picker = input.closest("[data-taxonomy-picker]");
            const maximum = Number(picker.dataset.maxTags || 3);
            if (picker.querySelectorAll("input:checked").length > maximum) {
              input.checked = false;
              showToast(`Pilih maksimal ${maximum} tag style.`);
            }
            refreshTaxonomyPicker(picker);
          });
          document.addEventListener("click", async (event) => {
            const button=event.target.closest("[data-add-custom-style]"); if(!button) return;
            const picker=button.closest("[data-taxonomy-picker]");
            const input=picker?.querySelector("[data-custom-style-input]");
            const value=normaliseStyleTag(input?.value);
            if(!value){ input?.focus(); return; }
            const maximum=Number(picker.dataset.maxTags || 3);
            if(picker.querySelectorAll("input[type=checkbox]:checked").length>=maximum){ showToast(`Pilih maksimal ${maximum} tag style.`); return; }
            button.disabled=true;
            try {
              const saved=cloudEnabled() && typeof cloud?.ensureStyleTag === "function" ? await cloud.ensureStyleTag(value) : { name:value };
              const canonical=normaliseStyleTag(saved?.name || value);
              if (cloudEnabled()) {
                await refreshCloudState({admin:true,quiet:true});
              } else {
                state.styleTags=uniqueStyleTags([...(state.styleTags || []).map((tag)=>typeof tag === "string" ? tag : tag?.name),canonical]);
              }
              appendTaxonomyOption(picker,canonical,true);
              input.value="";
              hydrateTaxonomyPickers(); renderStyleControls(); refreshTaxonomyPicker(picker);
            } catch(error) { showToast(error?.message || "Tag style belum dapat ditambahkan."); }
            finally { button.disabled=false; }
          });
        }
        function getProductUsage(id) { return state.looks.filter((entry) => entry.items.some((item) => item.productId === id)); }
        function memberTerm(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
        function memberTags(value) {
          const source = Array.isArray(value) ? value : String(value || "").split(",");
          return [...new Set(source.map(memberTerm).filter(Boolean))].slice(0,12);
        }
        function memberTagText(value) { return memberTags(value).join(", "); }
        function memberProfileTags(value) { return memberTags(value).slice(0, MEMBER_PROFILE_TAG_LIMIT); }
        function memberProfileTagLabel(name, value) {
          const field = MEMBER_PROFILE_TAG_FIELDS[name];
          const choices = name === "styleTags" ? getAllStyles() : (field?.options || []);
          return choices.find((option) => memberTerm(option) === value) || value;
        }
        function renderMemberProfileTagPicker(name) {
          const field = MEMBER_PROFILE_TAG_FIELDS[name];
          if (!field) return;
          const input = document.getElementById(field.inputId);
          const options = document.getElementById(field.optionsId);
          const count = document.getElementById(field.countId);
          const selected = memberProfileTagState[name] || [];
          if (input) input.value = selected.join(", ");
          if (count) count.textContent = `${selected.length} / ${MEMBER_PROFILE_TAG_LIMIT}`;
          if (!options) return;
          const availableOptions = name === "styleTags" ? getAllStyles() : field.options;
          const knownOptions = availableOptions.map((label) => ({ label, value: memberTerm(label), legacy: false }));
          const knownValues = new Set(knownOptions.map((option) => option.value));
          const tags = [...knownOptions, ...selected.filter((value) => !knownValues.has(value)).map((value) => ({ label: memberProfileTagLabel(name, value), value, legacy: true }))];
          options.innerHTML = tags.map((tag) => {
            const isSelected = selected.includes(tag.value);
            const disabled = !isSelected && selected.length >= MEMBER_PROFILE_TAG_LIMIT;
            return `<button class="member-tag-option${tag.legacy ? " is-legacy" : ""}" type="button" data-member-profile-tag="${esc(name)}" data-member-profile-value="${esc(tag.value)}" aria-pressed="${String(isSelected)}"${disabled ? " disabled" : ""}>${esc(tag.label)}</button>`;
          }).join("");
        }
        function setMemberProfileTags(name, value) {
          if (!MEMBER_PROFILE_TAG_FIELDS[name]) return;
          memberProfileTagState[name] = memberProfileTags(value);
          renderMemberProfileTagPicker(name);
        }
        function memberIdr(value) {
          const digits = String(value ?? "").replace(/[^0-9]/g, "");
          if (!digits) return null;
          const amount = Number(digits);
          return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
        }
        function memberPreference() {
          const preference = memberViewer?.preferences || {};
          return {
            genderTarget: String(preference.genderTarget ?? preference.gender_target ?? "").trim().toLowerCase(),
            styleTags: memberProfileTags(preference.styleTags ?? preference.style_tags),
            budgetMin: Number(preference.budgetMin ?? preference.budget_min_idr) || null,
            budgetMax: Number(preference.budgetMax ?? preference.budget_max_idr) || null,
            onboardingCompleted: Boolean(preference.onboardingCompleted ?? preference.onboarding_completed)
          };
        }
        function memberDisplayName() {
          const profile = memberViewer?.profile || {};
          const name = String(profile.displayName ?? profile.display_name ?? "").trim();
          return name || String(memberViewer?.user?.email || "COMOOTD Member").split("@")[0] || "COMOOTD Member";
        }
        function memberIsSignedIn() { return Boolean(memberViewer?.user?.id); }
        function databaseGender(value) {
          const gender = memberTerm(value);
          if (gender === "pria" || gender === "wanita" || gender === "unisex" || gender === "uniseks") return gender === "uniseks" ? "unisex" : gender;
          return "";
        }
        function publishedMatchCandidate(entry) {
          if (!entry) return false;
          if (!cloudEnabled()) return true;
          return entry.status === "published" && Boolean(entry.publishedAt) && new Date(entry.publishedAt).getTime() <= Date.now();
        }
        function styleOverlapScore(catalogueTags, preferred, weight) {
          const catalogue = new Set(memberTags(catalogueTags));
          return memberProfileTags(preferred).reduce((score, tag) => {
            const matches = [tag, ...(MEMBER_STYLE_ALIASES[tag] || [])];
            return score + (matches.some((candidate) => catalogue.has(candidate)) ? weight : 0);
          }, 0);
        }
        function memberMatchScore(entry, type) {
          const preference = memberPreference();
          const catalogueTags = memberTags(entry.styles);
          const entryGender = databaseGender(type === "look" ? entry.gender : entry.genderTarget);
          const price = type === "look" ? getLookTotal(entry) : Number(entry.price || 0);
          let score = styleOverlapScore(catalogueTags, preference.styleTags, 12);
          if (preference.genderTarget) {
            if (entryGender === preference.genderTarget) score += 6;
            else if (entryGender === "unisex") score += 3;
            else score -= 3;
          }
          if (preference.budgetMax) score += price <= preference.budgetMax ? 5 : Math.max(-10, -Math.ceil((price - preference.budgetMax) / Math.max(preference.budgetMax, 1) * 10));
          if (preference.budgetMin && price >= preference.budgetMin) score += 1;
          score += memberRetention.score(entry, type);
          return score;
        }
        function hasMemberMatchSignals(preference = memberPreference()) {
          return Boolean(preference.genderTarget || preference.styleTags.length || preference.budgetMin || preference.budgetMax || memberRetention.hasSignals());
        }
        function getMemberMatches() {
          const preference = memberPreference();
          const candidatePool = (entries, type) => {
            let pool = entries.filter(publishedMatchCandidate);
            if (preference.genderTarget) {
              pool = pool.filter((entry) => {
                const gender = databaseGender(type === "look" ? entry.gender : entry.genderTarget);
                return gender === preference.genderTarget || gender === "unisex";
              });
            }
            if (preference.styleTags.length) {
              pool = pool.filter((entry) => styleOverlapScore(entry.styles, preference.styleTags, 1) > 0);
            }
            if (preference.budgetMax) {
              pool = pool.filter((entry) => (type === "look" ? getLookTotal(entry) : Number(entry.price || 0)) <= preference.budgetMax);
            }
            if (preference.budgetMin) {
              pool = pool.filter((entry) => (type === "look" ? getLookTotal(entry) : Number(entry.price || 0)) >= preference.budgetMin);
            }
            return pool;
          };
          const compare = (type) => (a, b) => {
            const scoreDiff = memberMatchScore(b, type) - memberMatchScore(a, type);
            if (scoreDiff) return scoreDiff;
            return Number(b.popularity || b.createdOrder || 0) - Number(a.popularity || a.createdOrder || 0);
          };
          return {
            looks: candidatePool(state.looks, "look").sort(compare("look")).slice(0,3),
            products: candidatePool(state.products, "product").sort(compare("product")).slice(0,4)
          };
        }
        function requestStatusLabel(status) {
          return ({ new:"Baru", reviewing:"Diproses", replied:"Rekomendasi siap", closed:"Selesai", spam:"Ditolak" })[String(status || "").toLowerCase()] || "Baru";
        }
        function renderMemberRequests() {
          if (!els.memberRequestList) return;
          if (!memberIsSignedIn()) { els.memberRequestList.innerHTML = ""; return; }
          const rows = Array.isArray(memberRequests) ? memberRequests : [];
          els.memberRequestList.innerHTML = rows.length ? rows.map((request) => {
            const recommendations = (request.recommendations || []).map((item) => {
              const type = item.type || item.targetType;
              const targetId = item.targetId || (type === "look" ? item.lookId : item.productId);
              if (type === "look") {
                const look = getLook(targetId);
                return look ? `<button type="button" data-member-open-look="${esc(look.id)}">${esc(item.label || "Lihat look")}</button>` : "";
              }
              const product = getProduct(targetId);
              return product ? `<a href="${esc(safeUrl(product.affiliateUrl))}" target="_blank" rel="sponsored noopener">${esc(item.label || "Lihat produk")}</a>` : "";
            }).filter(Boolean).join("");
            return `<article class="member-request"><div class="member-request-top"><div><h4>${esc(request.occasion || "Request outfit")}</h4><p class="request-admin-meta">${esc(new Date(request.createdAt || request.created_at || Date.now()).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" }))}</p></div><span class="request-status is-${esc(String(request.status || "new").toLowerCase())}">${esc(requestStatusLabel(request.status))}</span></div>${request.responseMessage || request.response_message ? `<p>${esc(request.responseMessage || request.response_message)}</p>` : `<p>Kurasi sedang disiapkan oleh COMOOTD.</p>`}${recommendations ? `<div class="member-request-links">${recommendations}</div>` : ""}</article>`;
          }).join("") : `<p class="member-help">Belum ada request. Kirim brief dari bagian Request Outfit saat kamu sudah siap.</p>`;
        }
        function resendConfirmationSecondsLeft() {
          return Math.max(0, Math.ceil((resendConfirmationCooldownUntil - Date.now()) / 1000));
        }
        function renderMemberResendControl() {
          const button = els.memberResendConfirmation;
          if (!button) return;
          const shouldShow = memberAuthentication.mode === "signup" && Boolean(memberAuthentication.pendingEmail);
          window.clearTimeout(resendConfirmationTimer);
          button.hidden = !shouldShow;
          if (!shouldShow) {
            button.disabled = false;
            button.textContent = "Kirim ulang email konfirmasi";
            return;
          }
          const seconds = resendConfirmationSecondsLeft();
          button.disabled = resendConfirmationInFlight || seconds > 0;
          button.textContent = resendConfirmationInFlight ? "Mengirim…" : seconds ? `Kirim ulang dalam ${seconds} dtk` : "Kirim ulang email konfirmasi";
          if (!resendConfirmationInFlight && seconds > 0) resendConfirmationTimer = window.setTimeout(renderMemberResendControl, 1000);
        }
        function renderMemberAuth() {
          memberAuthentication.render();
        }
        function renderMemberNotifications() {
          const list=document.getElementById("memberNotificationList");
          const markAll=document.getElementById("markAllNotificationsRead");
          if(!list || !markAll) return;
          const unread=memberNotifications.filter((item)=>!item.readAt).length;
          markAll.hidden=unread===0;
          list.innerHTML=memberNotifications.length?memberNotifications.map((item)=>{
            const created=item.createdAt?new Date(item.createdAt).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"";
            return `<article class="member-notification${item.readAt?"":" is-unread"}" data-notification-id="${esc(item.id)}"><div><p class="eyebrow">${esc(created)}${item.readAt?"":" · BARU"}</p><h4>${esc(item.title)}</h4><p>${esc(item.message)}</p></div>${item.actionUrl?`<a class="small-button muted" href="${esc(item.actionUrl)}">Buka ↗</a>`:""}</article>`;
          }).join(""):`<p class="microcopy">Belum ada notifikasi.</p>`;
        }
        function renderMemberProfile() {
          if (!memberIsSignedIn()) return;
          const profile = memberViewer?.profile || {};
          const preference = memberPreference();
          const form = els.memberProfileForm;
          form.elements.displayName.value = String(profile.displayName ?? profile.display_name ?? "");
          form.elements.genderTarget.value = preference.genderTarget;
          setMemberProfileTags("styleTags", preference.styleTags);
          form.elements.budgetMin.value = preference.budgetMin || "";
          form.elements.budgetMax.value = preference.budgetMax || "";
          els.memberProfileError.textContent = "";
          renderMemberNotifications();
          memberRetention.renderPanel(els.memberRetentionPanel);
          memberPrivacy?.renderPanel?.(els.memberPrivacyPanel);
          renderMemberRequests();
        }
        function updateMemberUi() {
          const signedIn = memberIsSignedIn();
          const unread=memberNotifications.filter((item)=>!item.readAt).length;
          const label = signedIn ? `Profil ${memberDisplayName()}${unread?`, ${unread} notifikasi baru`:""}` : "Masuk atau buka profil COMOOTD";
          els.accountButton.setAttribute("aria-label", label);
          els.accountButton.title = label;
          els.accountButton.classList.toggle("has-unread",unread>0);
          els.mobileAccountButton.textContent = signedIn ? `Profil ${memberDisplayName()}${unread?` · ${unread} baru`:""}` : "Masuk / Profil";
          els.requestSubmitButton.innerHTML = signedIn ? `Kirim request ke Studio <span aria-hidden="true">↗</span>` : `Masuk untuk mengirim <span aria-hidden="true">↗</span>`;
          if (signedIn) prefillRequestForm();
          renderMemberRequests();
          renderPersonalized();
        }
        function prefillRequestForm() {
          if (!memberIsSignedIn() || !els.requestForm) return;
          const preference = memberPreference();
          const form = els.requestForm;
          if (!form.elements.genderTarget.value && preference.genderTarget) form.elements.genderTarget.value = preference.genderTarget;
          if (!form.elements.styleTags.value && preference.styleTags.length) form.elements.styleTags.value = memberTagText(preference.styleTags);
          if (!form.elements.budgetMin.value && preference.budgetMin) form.elements.budgetMin.value = preference.budgetMin;
          if (!form.elements.budgetMax.value && preference.budgetMax) form.elements.budgetMax.value = preference.budgetMax;
        }
        function renderPersonalized() {
          if (!els.personalGrid) return;
          if (!cloudEnabled()) {
            els.personalGrid.innerHTML = `<div class="personal-intro"><div><p class="eyebrow">COMOOTD / PERSONAL</p><h3>Profil personal aktif saat katalog cloud terhubung.</h3></div><p>Versi production COMOOTD akan menyimpan pilihanmu secara aman di akun sendiri.</p></div><div class="personal-results"><p class="personal-empty">Hubungkan Supabase cloud untuk mencoba akun dan rekomendasi personal.</p></div>`;
            return;
          }
          if (!memberIsSignedIn()) {
            els.personalGrid.innerHTML = `<div class="personal-intro"><div><p class="eyebrow">COMOOTD / PERSONAL</p><h3>Mulai dari gaya yang terasa kamu.</h3></div><p>Masuk untuk menyimpan style, gender preferensi, dan budget yang akan dipakai untuk mengurutkan kurasi.</p><button class="button-outline" type="button" data-open-member>Masuk / buat akun ↗</button></div><div class="personal-results"><p class="personal-empty">Katalog tetap terbuka untuk semua orang. Akun hanya dipakai saat kamu ingin rekomendasi yang lebih personal.</p></div>`;
            return;
          }
          const preference = memberPreference();
          if ((!preference.onboardingCompleted || !hasMemberMatchSignals(preference)) && !memberRetention.hasSignals()) {
            els.personalGrid.innerHTML = `<div class="personal-intro"><div><p class="eyebrow">HALO, ${esc(memberDisplayName().toUpperCase())}</p><h3>Berikan sedikit arah untuk kurasimu.</h3></div><p>Pilih minimal satu style, gender preferensi, atau budget. Kamu bisa mengubahnya kapan saja.</p><button class="button-outline" type="button" data-open-member>Isi preferensi ↗</button></div><div class="personal-results"><p class="personal-empty">Setelah disimpan, COMOOTD akan mencocokkan tag katalog dan menampilkan Look serta produk yang paling dekat dengan preferensimu.</p></div>`;
            return;
          }
          const matches = getMemberMatches();
          const looks = matches.looks.map((entry) => `<article class="personal-look"><button class="personal-look-open" type="button" data-open-look="${esc(entry.id)}">${lookVisual(entry)}<span class="personal-look-copy"><strong>${esc(entry.title)}</strong><span>${esc(entry.styles.slice(0,2).join(" / ") || "Kurasi COMOOTD")}</span></span></button><div class="catalogue-card-actions">${lookLikeButton(entry,true)}${memberRetention.saveButton("look",entry.id,true)}</div></article>`).join("");
          const products = matches.products.map((item) => { const variant = item.variants?.[0]; return `<article class="personal-product"><button class="product-card-open" type="button" data-open-product="${esc(item.id)}" aria-label="Buka detail ${esc(item.name)}">${productArt(item,variant,true)}</button><button class="product-name-link" type="button" data-open-product="${esc(item.id)}"><h5>${esc(item.name)}</h5></button><p>${money(item.price)}</p>${memberRetention.saveButton("product",item.id)}<a href="${esc(safeUrl(item.affiliateUrl))}" target="_blank" rel="sponsored noopener" data-insight-target="product" data-insight-id="${esc(item.id)}">${esc(marketplaceLabel(item))} ↗</a></article>`; }).join("");
          els.personalGrid.innerHTML = `<div class="personal-intro"><div><p class="eyebrow">UNTUK ${esc(memberDisplayName().toUpperCase())}</p><h3>Kurasi yang belajar dari pilihanmu.</h3></div><p>Urutan memakai profil, item tersimpan, Curator yang diikuti, dan riwayat yang hanya terlihat olehmu.</p><button class="button-outline" type="button" data-open-member>Atur profil &amp; koleksi ↗</button></div><div class="personal-results"><div class="personal-group"><div class="personal-group-head"><h4>Look yang mungkin kamu suka</h4><span class="eyebrow">${matches.looks.length} pilihan</span></div><div class="personal-looks">${looks || `<p class="personal-empty">Belum ada look yang cukup cocok.</p>`}</div></div><div class="personal-group"><div class="personal-group-head"><h4>Pieces untuk disisipkan</h4><span class="eyebrow">${matches.products.length} pilihan</span></div><div class="personal-products">${products || `<p class="personal-empty">Belum ada produk yang cukup cocok.</p>`}</div></div></div>`;
        }

        const { productArt, blendHex, lookMediaEntries, lookVisual } = window.COMOOTDCatalogMedia.create({ safeImage, esc, tones:TONES, lookAttribution:(entry)=>lookAttribution(entry) });
        function lookSearchText(entry) {
          const itemText = entry.items.map((item) => {
            if (item?.affiliateUrl && !item?.productId) return `${item.name||""} ${item.category||""} ${item.colorLabel||item.variantName||""}`;
            const p=getProduct(item.productId); return `${p?.name||""} ${item.variantName||""} ${p?.styles?.join(" ")||""}`;
          }).join(" ");
          const curator = entry.curator || {};
          const curatorText = `${curator.displayName||curator.name||""} ${curator.handle||""} ${curator.bio||""} ${(curator.jobTags||[]).join(" ")}`;
          return `${entry.title} ${entry.gender} ${entry.styles.join(" ")} ${itemText} ${curatorText}`.toLowerCase();
        }
        function filteredLooks() {
          const search = els.search.value.trim().toLowerCase();
          const gender = els.gender.value;
          const style = activeStyle !== "all" ? activeStyle : els.style.value;
          const sort = els.sort.value;
          const items = state.looks.filter((entry) => {
            const bySearch = !search || lookSearchText(entry).includes(search);
            const byGender = gender === "all" || entry.gender === gender || entry.gender === "Uniseks";
            const byStyle = style === "all" || entry.styles.includes(style);
            return bySearch && byGender && byStyle;
          });
          return items.sort((a,b) => {
            if (sort === "newest") return Number(b.createdOrder || 0) - Number(a.createdOrder || 0);
            if (sort === "low") return getLookTotal(a) - getLookTotal(b);
            if (sort === "high") return getLookTotal(b) - getLookTotal(a);
            return Number(b.popularity || 0) - Number(a.popularity || 0);
          });
        }

        function isNewSeriesEligible(entry) {
          if (!entry) return false;
          if (!cloudEnabled()) return true;
          return entry.status === "published" && Boolean(entry.publishedAt) && new Date(entry.publishedAt).getTime() <= Date.now();
        }
        function getNewSeriesCandidates() {
          return [...state.looks]
            .filter(isNewSeriesEligible)
            .sort((a,b) => Number(b.createdOrder || 0) - Number(a.createdOrder || 0) || Number(b.popularity || 0) - Number(a.popularity || 0));
        }
        function getNewSeriesLookIds() {
          const candidates = getNewSeriesCandidates();
          const candidateIds = new Set(candidates.map((entry) => entry.id));
          const configuredSlots = Array.isArray(state.newSeriesSlots) && state.newSeriesSlots.length
            ? [...state.newSeriesSlots].sort((a,b) => Number(a.slot || 0) - Number(b.slot || 0)).map((slot) => slot.lookId)
            : (state.newSeriesLookIds || []);
          const selected = [];
          configuredSlots.forEach((id) => {
            if (candidateIds.has(id) && !selected.includes(id)) selected.push(id);
          });
          if (cloudEnabled() || state.newSeriesConfigured) return selected.slice(0,5);
          candidates.forEach((entry) => {
            if (!selected.includes(entry.id)) selected.push(entry.id);
          });
          return selected.slice(0,5);
        }
        function getNewSeriesLooks() {
          const lookMap = new Map(state.looks.map((entry) => [entry.id, entry]));
          return getNewSeriesLookIds().map((id) => lookMap.get(id)).filter(Boolean);
        }
        function stopNewSeriesAutoplay() {
          if (newSeriesTimer) clearInterval(newSeriesTimer);
          newSeriesTimer = undefined;
        }
        function startNewSeriesAutoplay() {
          stopNewSeriesAutoplay();
          const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (typeof window.matchMedia !== "function" || reducedMotion || getNewSeriesLooks().length < 2) return;
          newSeriesTimer = setInterval(() => moveNewSeries(1), 6200);
        }
        function moveNewSeries(direction) {
          const entries = getNewSeriesLooks();
          if (entries.length < 2) return;
          newSeriesIndex = (newSeriesIndex + direction + entries.length) % entries.length;
          renderNewSeries();
        }
        function renderNewSeries() {
          const entries = getNewSeriesLooks();
          stopNewSeriesAutoplay();
          if (!entries.length) {
            els.newSeriesStage.innerHTML = `<div class="new-series-empty"><p>New Series akan hadir setelah look pertama dipublikasikan.</p></div>`;
            els.newSeriesDots.innerHTML = "";
            els.newSeriesPrev.disabled = true;
            els.newSeriesNext.disabled = true;
            return;
          }
          newSeriesIndex = Math.min(Math.max(newSeriesIndex, 0), entries.length - 1);
          const entry = entries[newSeriesIndex];
          const styles = entry.styles?.slice(0,2).join(" / ") || "Kurasi COMOOTD";
          const count = String(newSeriesIndex + 1).padStart(2,"0") + " / " + String(entries.length).padStart(2,"0");
          els.newSeriesStage.innerHTML = `<button class="new-series-slide" type="button" data-open-look="${esc(entry.id)}" aria-label="Buka look ${esc(entry.title)}"><span class="new-series-visual">${lookVisual(entry)}</span><span class="new-series-overlay"><span class="new-series-count meta">${count}</span><strong>${esc(entry.title)}</strong><span class="new-series-meta">${esc(entry.gender)} · ${esc(styles)}</span><span class="new-series-open">Buka look ↗</span></span></button>`;
          els.newSeriesDots.innerHTML = entries.map((item,index) => `<button class="new-series-dot ${index === newSeriesIndex ? "is-active" : ""}" type="button" data-new-series-index="${index}" aria-label="Tampilkan look ${index + 1}: ${esc(item.title)}" aria-current="${index === newSeriesIndex ? "true" : "false"}"></button>`).join("");
          const canMove = entries.length > 1;
          els.newSeriesPrev.disabled = !canMove;
          els.newSeriesNext.disabled = !canMove;
          startNewSeriesAutoplay();
        }

        function renderMoodList() {
          const taxonomy = (state.styleTags || []).filter((tag) => typeof tag === "object" && tag?.name && tag?.isActive !== false);
          const configured = taxonomy.filter((tag) => tag.isExploreVisible);
          const fallback = ["Minimalist", "Techwear", "Whimsy", "Workwear", "Clean", "Casual"].map((name) => ({ id:"", name, previewLookId:"" }));
          const moodPool = [...configured, ...taxonomy, ...fallback];
          const moodNames = new Set();
          const moods = moodPool.filter((tag) => {
            const key = String(tag?.name || "").trim().toLocaleLowerCase("id-ID");
            if (!key || moodNames.has(key)) return false;
            moodNames.add(key);
            return true;
          }).slice(0,6).map((tag) => typeof tag === "string" ? { id:"", name:tag, previewLookId:"" } : tag);
          if (!moods.some((tag) => tag.name === activeMoodStyle)) activeMoodStyle = moods[0]?.name || "";
          const activeTag = moods.find((tag) => tag.name === activeMoodStyle) || moods[0];
          const styleKey = String(activeTag?.name || "").toLocaleLowerCase("id-ID");
          const eligible = state.looks.filter((look) => isNewSeriesEligible(look) && (look.styles || []).some((style) => String(style).toLocaleLowerCase("id-ID") === styleKey));
          const configuredLook = eligible.find((look) => look.id === activeTag?.previewLookId);
          const preview = configuredLook || [...eligible].sort((a,b) => Number(b.popularity || 0) - Number(a.popularity || 0) || Number(b.createdOrder || 0) - Number(a.createdOrder || 0))[0] || getNewSeriesCandidates()[0];
          const previewMarkup = preview
            ? `<div class="mood-preview"><button class="mood-preview-button" type="button" data-open-look="${esc(preview.id)}" aria-label="Buka preview ${esc(activeTag.name)}: ${esc(preview.title)}"><span class="mood-preview-visual">${lookVisual(preview)}</span><span class="mood-preview-overlay"><span class="mood-preview-meta">${esc(lookAttribution(preview))} / ${esc(activeTag.name)}</span><strong>${esc(preview.title)}</strong><span class="mood-preview-meta">${esc(preview.gender)} · ${esc(preview.styles.slice(0,2).join(" / ") || activeTag.name)}</span><span class="mood-preview-open">Buka look ↗</span></span></button><a class="mood-style-link" href="/styles/${esc(slugify(activeTag.name))}"><span>Semua ${esc(activeTag.name)}</span><span aria-hidden="true">↗</span></a></div>`
            : `<div class="mood-preview"><div class="new-series-empty"><p>Preview ${esc(activeTag?.name || "style")} akan hadir setelah look dipublikasikan.</p></div></div>`;
          const buttons = moods.map((mood, index) => `<button class="mood-button${mood.name === activeMoodStyle ? " is-active" : ""}" type="button" data-mood-style="${esc(mood.name)}" aria-pressed="${String(mood.name === activeMoodStyle)}"><strong>${esc(mood.name)}</strong><span>${String(index+1).padStart(2,"0")} ↘</span></button>`).join("");
          els.moodList.innerHTML = `${previewMarkup}<div class="mood-options" style="--mood-count:${moods.length}">${buttons}</div>`;
        }
        function discoveryRailStep(rail) {
          const card = rail?.firstElementChild;
          if (!card) return 0;
          const style = getComputedStyle(rail);
          return card.getBoundingClientRect().width + (Number.parseFloat(style.columnGap || style.gap) || 0);
        }
        function syncDiscoveryRail(shell) {
          const rail = shell?.querySelector(".discovery-rail");
          if (!rail) return;
          const controls = [...shell.querySelectorAll("[data-discovery-move]")];
          const status = shell.querySelector("[data-discovery-status]");
          const total = rail.children.length;
          const step = discoveryRailStep(rail);
          const current = total && step ? Math.min(total, Math.max(1, Math.round(rail.scrollLeft / step) + 1)) : total ? 1 : 0;
          const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
          if (status) status.textContent = `${String(current).padStart(2,"0")} / ${String(total).padStart(2,"0")}`;
          controls.forEach((button) => { button.disabled = button.dataset.discoveryMove === "-1" ? rail.scrollLeft <= 2 : rail.scrollLeft >= max - 2; });
        }
        function syncDiscoveryRails() {
          document.querySelectorAll("[data-discovery-carousel]").forEach((shell) => {
            const rail = shell.querySelector(".discovery-rail");
            if (rail && !rail.dataset.discoveryReady) {
              rail.dataset.discoveryReady = "true";
              rail.addEventListener("scroll",()=>requestAnimationFrame(()=>syncDiscoveryRail(shell)),{passive:true});
            }
            syncDiscoveryRail(shell);
          });
        }
        function moveDiscoveryRail(shell, direction) {
          const rail = shell?.querySelector(".discovery-rail");
          if (!rail) return;
          rail.scrollBy({ left:discoveryRailStep(rail) * direction, behavior:"smooth" });
        }
        window.COMOOTDSyncDiscoveryRails = () => requestAnimationFrame(syncDiscoveryRails);
        function renderPopular() {
          const counts = new Map();
          state.looks.forEach((entry) => entry.items.forEach((item) => {
            if (item.productId) counts.set(item.productId, (counts.get(item.productId)||0)+1);
          }));
          const popular = [...state.products].sort((a,b) => (counts.get(b.id)||0)-(counts.get(a.id)||0)).slice(0,12);
          els.popularGrid.innerHTML = popular.map((item) => {
            const variant = item.variants[0];
            return `<article class="popular-card"><button class="product-card-open" type="button" data-open-product="${esc(item.id)}" aria-label="Buka detail ${esc(item.name)}">${productArt(item, variant)}</button><p class="eyebrow" style="color:var(--taupe);margin:.1rem 0 .45rem">${esc(item.badge || "COMOOTD PICK")}</p><h3 class="product-name"><button class="product-name-link" type="button" data-open-product="${esc(item.id)}">${esc(item.name)}</button></h3><p class="product-price">${money(item.price)}</p><div class="product-meta"><span class="swatch" style="--swatch:${esc(variant?.hex || "#ccc")}" title="${esc(variant?.name || "")}"></span><a class="product-link" href="${esc(safeUrl(item.affiliateUrl))}" target="_blank" rel="sponsored noopener" data-insight-target="product" data-insight-id="${esc(item.id)}">${esc(marketplaceLabel(item))} ↗</a></div></article>`;
          }).join("") || `<div class="empty-state"><h3>Belum ada produk</h3><p>Tambahkan dari COMOOTD Studio.</p></div>`;
          window.COMOOTDSyncDiscoveryRails();
        }
        function renderStyleControls() {
          window.COMOOTDFilters.renderStyleControls({ styles:getAllStyles(), select:els.style, chips:els.styleChips, activeStyle, escapeHtml:esc });
        }
        function lookAttribution(entry) {
          const curator = entry?.curator;
          if (entry?.publisherType === "curator" || curator?.handle) return curator?.handle ? `CURATED BY @${curator.handle}` : "CURATED BY CURATOR";
          return "BY COMOOTD";
        }
        function curatorMetricsMarkup(entry, compact = false) {
          const curator = entry?.curator;
          if (!(entry?.publisherType === "curator" || curator?.handle)) return "";
          const metrics = [];
          if (curator?.heightCm !== null && curator?.heightCm !== undefined) metrics.push(`${curator.heightCm} CM`);
          if (curator?.weightKg !== null && curator?.weightKg !== undefined) metrics.push(`${curator.weightKg} KG`);
          return metrics.length ? `<p class="look-curator-metrics${compact ? " is-compact" : ""}" aria-label="Tinggi dan berat curator">${metrics.map(esc).join(" · ")}</p>` : "";
        }
        function lookLikeButton(entry, compact = false) {
          return lookLikes.button(entry, compact);
        }
        async function toggleMainLookLike(lookId) {
          await lookLikes.toggle(lookId);
        }
        function renderLooks() {
          const entries = [...state.looks].sort((a,b)=>Number(b.popularity||0)-Number(a.popularity||0)||Number(b.createdOrder||0)-Number(a.createdOrder||0)).slice(0,4);
          els.heroCount.textContent = state.looks.length;
          els.resultCount.textContent = `${state.looks.length} look tersedia`;
          if (!entries.length) {
            els.lookGrid.innerHTML = `<div class="empty-state"><h3>Kurasi sedang disiapkan.</h3><p>Look pilihan COMOOTD akan segera tampil di sini.</p></div>`;
            return;
          }
          els.lookGrid.innerHTML = entries.map((entry) => `<article class="look-card"><button class="look-card-image" type="button" data-open-look="${esc(entry.id)}" aria-label="Buka detail ${esc(entry.title)}">${lookVisual(entry)}</button><div class="look-card-body"><div class="look-card-meta"><span class="eyebrow">${esc(lookAttribution(entry))}</span><span class="meta">${esc(entry.gender)}</span></div><h3 class="look-card-title">${esc(entry.title)}</h3>${curatorMetricsMarkup(entry,true)}<div class="look-card-footer"><div class="look-card-tags">${entry.styles.slice(0,3).map((style)=>`<span class="tag">${esc(style)}</span>`).join("")}<span class="tag">${entry.items.length} items</span></div><div class="catalogue-card-actions">${lookLikeButton(entry,true)}${memberRetention.saveButton("look",entry.id,true)}</div></div></div></article>`).join("");
        }
        function articleCategoryLabel(category) { return ARTICLE_CATEGORIES[category] || ARTICLE_CATEGORIES.editorial; }
        function makeJournalBlock(type) {
          return { id:uid("journal-block"), type, content:"", level:type === "heading" ? 2 : null, file:null, fileName:"", imageAspect:"portrait", alt:"", caption:"" };
        }
        function isPublishedCatalogueEntry(entry) {
          if (!entry) return false;
          if (!cloudEnabled()) return true;
          return entry.status === "published" && Boolean(entry.publishedAt) && new Date(entry.publishedAt).getTime() <= Date.now();
        }
        function journalLookCandidates() { return state.looks.filter(isPublishedCatalogueEntry); }
        function journalProductCandidates() { return state.products.filter(isPublishedCatalogueEntry); }
        function defaultJournalCtaLabel(type) { return type === "look" ? "Lihat look lengkap" : "Lihat produk"; }
        function renderJournalBlockEditor() {
          els.journalBlocks.innerHTML = journalDraftBlocks.length ? journalDraftBlocks.map((block,index) => {
            const typeLabel = block.type === "paragraph" ? "Paragraf" : block.type === "heading" ? "Heading" : block.type === "quote" ? "Kutipan" : "Foto";
            const remove = `<button class="small-button danger" type="button" data-remove-journal-block="${index}" aria-label="Hapus blok ${typeLabel}">×</button>`;
            if (block.type === "image") {
              const fileNote = block.fileName ? `Dipilih: ${block.fileName}` : "Belum ada foto dipilih.";
              return `<div class="journal-block" data-journal-block="${index}"><div class="journal-block-head"><span class="journal-block-type">${typeLabel}</span>${remove}</div><div class="field"><label>Foto artikel</label><input type="file" accept="image/jpeg,image/png,image/webp" data-journal-block-file="${index}" /></div><div class="compact-row"><div class="field"><label>Deskripsi foto</label><input maxlength="240" data-journal-block-alt="${index}" value="${esc(block.alt)}" placeholder="Jelaskan isi foto" /></div><div class="field"><label>Caption (opsional)</label><input maxlength="500" data-journal-block-caption="${index}" value="${esc(block.caption)}" placeholder="Keterangan kecil di bawah foto" /></div></div><p class="journal-block-image-note">${esc(fileNote)} · JPEG, PNG, atau WebP, maksimal 5 MB di cloud.</p></div>`;
            }
            const maxlength = block.type === "heading" ? 240 : block.type === "quote" ? 800 : 6000;
            const placeholder = block.type === "heading" ? "Subjudul yang memberi arah" : block.type === "quote" ? "Kalimat yang ingin diberi penekanan" : "Tulis bagian cerita di sini…";
            const level = block.type === "heading" ? `<div class="field"><label>Ukuran heading</label><select data-journal-block-level="${index}"><option value="2" ${Number(block.level) === 2 ? "selected" : ""}>Heading besar</option><option value="3" ${Number(block.level) === 3 ? "selected" : ""}>Heading kecil</option></select></div>` : "";
            return `<div class="journal-block" data-journal-block="${index}"><div class="journal-block-head"><span class="journal-block-type">${typeLabel}</span>${remove}</div>${level}<div class="field"><label>${block.type === "heading" ? "Teks heading" : block.type === "quote" ? "Isi kutipan" : "Isi paragraf"}</label><textarea maxlength="${maxlength}" data-journal-block-content="${index}" placeholder="${placeholder}">${esc(block.content)}</textarea></div></div>`;
          }).join("") : `<p class="microcopy" style="color:var(--taupe);margin:0">Tambahkan blok pertama untuk mulai menulis.</p>`;
          els.journalBlocks.querySelectorAll("[data-journal-block-file]").forEach((input) => bindImageCropper(input, {
            defaultAspect:"portrait",
            label:"foto artikel"
          }));
        }
        function renderJournalCtaList(type) {
          const entries = type === "look" ? journalDraftLookCtas : journalDraftProductCtas;
          const target = type === "look" ? els.journalLookCtas : els.journalProductCtas;
          const source = type === "look" ? state.looks : state.products;
          const removeKey = type === "look" ? "data-remove-journal-look-cta" : "data-remove-journal-product-cta";
          target.innerHTML = entries.length ? entries.map((entry,index) => {
            const item = source.find((candidate) => candidate.id === entry.id);
            return `<div class="journal-cta-item"><strong title="${esc(item?.title || item?.name || "Kurasi")}">${esc(item?.title || item?.name || "Kurasi")}</strong><input maxlength="80" data-journal-${type}-cta-label="${index}" value="${esc(entry.label || defaultJournalCtaLabel(type))}" aria-label="Label CTA ${type}" /><button class="small-button danger" type="button" ${removeKey}="${index}" aria-label="Hapus CTA">×</button></div>`;
          }).join("") : `<p class="microcopy" style="color:var(--taupe);margin:0">Belum ada ${type === "look" ? "look" : "produk"} terkait.</p>`;
        }
        function renderJournalCuration() {
          const looks = journalLookCandidates();
          const products = journalProductCandidates();
          const selectedLookIds = new Set(journalDraftLookCtas.map((entry) => entry.id));
          const selectedProductIds = new Set(journalDraftProductCtas.map((entry) => entry.id));
          const previousLook = els.journalLookCtaInput.value;
          const previousProduct = els.journalProductCtaInput.value;
          els.journalLookCtaInput.innerHTML = `<option value="">Pilih look published</option>${looks.filter((entry) => !selectedLookIds.has(entry.id)).map((entry) => `<option value="${esc(entry.id)}">${esc(entry.title)} · ${esc(entry.gender)}</option>`).join("")}`;
          els.journalProductCtaInput.innerHTML = `<option value="">Pilih produk published</option>${products.filter((entry) => !selectedProductIds.has(entry.id)).map((entry) => `<option value="${esc(entry.id)}">${esc(entry.name)} · ${money(entry.price)}</option>`).join("")}`;
          if (Array.from(els.journalLookCtaInput.options || []).some((option) => option.value === previousLook)) els.journalLookCtaInput.value = previousLook;
          if (Array.from(els.journalProductCtaInput.options || []).some((option) => option.value === previousProduct)) els.journalProductCtaInput.value = previousProduct;
          els.addJournalLookCtaButton.disabled = journalDraftLookCtas.length >= JOURNAL_CTA_LIMIT || !looks.length;
          els.addJournalProductCtaButton.disabled = journalDraftProductCtas.length >= JOURNAL_CTA_LIMIT || !products.length;
          renderJournalCtaList("look");
          renderJournalCtaList("product");
        }
        function renderJournalStudio() { renderJournalBlockEditor(); renderJournalCuration(); }
        function renderJournal() {
          document.getElementById("journalGrid").innerHTML = state.articles.length ? state.articles.slice(0,12).map((article) => {
            const cover = safeImage(article.coverImage);
            return `<article class="journal-card">${cover ? `<div class="journal-card-cover ${imageFrameClass(article.coverAspect || article.coverImage, "portrait")}" aria-hidden="true"><img src="${esc(cover)}" alt="" /></div>` : ""}<span class="article-number eyebrow">${esc(articleCategoryLabel(article.category))} / ${esc(article.number)}</span><h3>${esc(article.title)}</h3>${article.excerpt ? `<p class="journal-card-excerpt">${esc(article.excerpt)}</p>` : ""}<button class="text-link" type="button" data-open-article="${esc(article.id)}">Baca catatan ↗</button></article>`;
          }).join("") : `<div class="empty-state"><h3>Journal segera hadir.</h3><p>Catatan fashion berikutnya sedang disiapkan.</p></div>`;
          window.COMOOTDSyncDiscoveryRails();
        }
        const STOREFRONT_CARD_LABELS = { looks:"Looks", products:"Products", curators:"Curators", journal:"Journal" };
        function storefrontSourceId(key, entry) {
          if (key === "curators") return String(entry?.userId || entry?.id || "");
          return String(entry?.id || "");
        }
        function storefrontSourceLabel(key, entry) {
          if (!entry) return "konten terbaru";
          if (key === "products") return entry.name || "Produk COMOOTD";
          if (key === "curators") return entry.displayName || entry.name || entry.handle || "COMOOTD Curator";
          return entry.title || "Konten COMOOTD";
        }
        function storefrontCandidates(key) {
          if (key === "looks") return (state.looks || []).filter(isPublishedCatalogueEntry);
          if (key === "products") return (state.products || []).filter(isPublishedCatalogueEntry);
          if (key === "curators") return (state.curators || []).filter((entry) => entry?.isActive !== false && storefrontSourceId(key, entry));
          return (state.articles || []).filter(isPublishedCatalogueEntry);
        }
        function storefrontImage(key, entry) {
          if (!entry) return "";
          if (key === "looks") return safeImage(entry.coverImage || entry.media?.[0]?.image);
          if (key === "products") return safeImage(entry.image || entry.variants?.[0]?.image);
          if (key === "journal") return safeImage(entry.coverImage);
          const curatorId = storefrontSourceId("curators", entry);
          const curatorLook = (state.looks || []).find((look) => isPublishedCatalogueEntry(look) && String(look.creatorId || look.creator_id || look.curator?.userId || "") === curatorId && safeImage(look.coverImage));
          return safeImage(curatorLook?.coverImage || entry.avatar || entry.avatarUrl || "");
        }
        function storefrontVisualFor(key) {
          const setting = (state.storefrontVisuals || []).find((entry) => entry.cardKey === key || entry.card_key === key) || {};
          const customImage = safeImage(setting.customImage || setting.custom_image || "");
          if (customImage) return { entry:null, image:customImage, focalPosition:String(setting.focalPosition || setting.focal_position || "center") };
          const candidates = storefrontCandidates(key);
          const sourceId = String(setting.sourceId || setting.source_id || "");
          const selected = candidates.find((entry) => storefrontSourceId(key, entry) === sourceId);
          const fallback = candidates.find((entry) => storefrontImage(key, entry));
          const entry = selected && storefrontImage(key, selected) ? selected : fallback;
          return { entry, image:storefrontImage(key, entry), focalPosition:String(setting.focalPosition || setting.focal_position || "center") };
        }
        function renderStorefrontVisuals() {
          document.querySelectorAll("[data-storefront-visual]").forEach((card) => {
            const visual = storefrontVisualFor(String(card.dataset.storefrontVisual || ""));
            card.classList.toggle("has-visual", Boolean(visual.image));
            if (visual.image) {
              card.style.setProperty("--storefront-image", `url(${JSON.stringify(visual.image)})`);
              card.style.setProperty("--storefront-position", visual.focalPosition);
            } else {
              card.style.removeProperty("--storefront-image");
              card.style.removeProperty("--storefront-position");
            }
          });
        }
        function renderStorefrontVisualStudio() {
          if (!els.storefrontVisualSlots) return;
          const focalOptions = [["center","Tengah"],["top","Atas"],["bottom","Bawah"],["left","Kiri"],["right","Kanan"]];
          const customCount = (state.storefrontVisuals || []).filter((entry) => entry.sourceId || entry.source_id || entry.customImagePath || entry.custom_image_path).length;
          els.storefrontVisualSlots.innerHTML = Object.keys(STOREFRONT_CARD_LABELS).map((key, index) => {
            const setting = (state.storefrontVisuals || []).find((entry) => entry.cardKey === key || entry.card_key === key) || {};
            const selectedId = String(setting.sourceId || setting.source_id || "");
            const customImagePath = String(setting.customImagePath || setting.custom_image_path || "");
            const customImage = safeImage(setting.customImage || setting.custom_image || "");
            const focal = String(setting.focalPosition || setting.focal_position || "center");
            const candidates = storefrontCandidates(key).filter((entry) => storefrontImage(key, entry));
            const fallback = candidates[0];
            const options = [`<option value=""${!selectedId && !customImagePath ? " selected" : ""}>Otomatis · ${esc(storefrontSourceLabel(key, fallback))}</option>`, `<option value="__custom__"${customImagePath ? " selected" : ""}>Upload desain sendiri</option>`, ...candidates.map((entry) => `<option value="${esc(storefrontSourceId(key, entry))}"${!customImagePath && storefrontSourceId(key, entry) === selectedId ? " selected" : ""}>${esc(storefrontSourceLabel(key, entry))}</option>`)].join("");
            const positions = focalOptions.map(([value,label]) => `<option value="${value}"${value === focal ? " selected" : ""}>Crop ${label}</option>`).join("");
            return `<div class="storefront-visual-slot" data-storefront-slot="${key}" data-storefront-current="${esc(customImagePath)}"><span class="new-series-slot-number">${String(index + 1).padStart(2,"0")}</span><label><span>${esc(STOREFRONT_CARD_LABELS[key])}</span><select data-storefront-source="${key}">${options}</select></label><label><span>Posisi foto</span><select data-storefront-focal="${key}">${positions}</select></label><label class="storefront-upload-field"><span>Desain sendiri</span><input type="file" accept="image/jpeg,image/png,image/webp" data-storefront-file="${key}" /><small>${customImagePath ? "Desain aktif tersimpan · pilih file untuk mengganti" : "JPEG, PNG, atau WebP · maks. 2 MB"}</small></label>${customImage ? `<img class="storefront-upload-preview" src="${esc(customImage)}" alt="Preview desain kartu ${esc(STOREFRONT_CARD_LABELS[key])}" />` : ""}</div>`;
          }).join("");
          els.storefrontVisualStatus.textContent = `${customCount} dari 4 kartu memakai visual khusus. Upload desain memakai Storage COMOOTD yang sudah tersedia.`;
          els.saveStorefrontVisualsButton.disabled = false;
        }
        function renderNewSeriesStudio() {
          const candidates = getNewSeriesCandidates();
          const candidateIds = new Set(candidates.map((entry) => entry.id));
          const configuredSlotMap = new Map((state.newSeriesSlots || []).map((slot) => [Number(slot.slot), String(slot.lookId || "")]));
          const fallbackIds = getNewSeriesLookIds();
          const useConfiguredSlots = cloudEnabled() || state.newSeriesConfigured || configuredSlotMap.size > 0;
          const selectedSlotIds = Array.from({ length: 5 }, (_, index) => {
            const configuredId = configuredSlotMap.get(index + 1) || "";
            return candidateIds.has(configuredId) ? configuredId : (useConfiguredSlots ? "" : (fallbackIds[index] || ""));
          });
          els.newSeriesSlots.innerHTML = selectedSlotIds.map((selectedId, index) => {
            const options = [`<option value="">— Kosongkan slot —</option>`, ...candidates.map((entry) => `<option value="${esc(entry.id)}" ${entry.id === selectedId ? "selected" : ""}>${esc(entry.title)} · ${esc(entry.gender)}</option>`)].join("");
            return `<label class="new-series-slot"><span class="new-series-slot-number">${String(index + 1).padStart(2,"0")}</span><select data-new-series-slot="${index + 1}" aria-label="Look New Series nomor ${index + 1}">${options}</select></label>`;
          }).join("");
          const selectedCount = selectedSlotIds.filter(Boolean).length;
          els.newSeriesStatus.classList.toggle("is-warning", selectedCount === 0);
          els.newSeriesStatus.textContent = selectedCount
            ? `${selectedCount} dari 5 slot terisi. Kosongkan slot lalu simpan untuk melepas look dari carousel.`
            : "Belum ada look di carousel. Pilih hingga lima look, atau biarkan kosong sementara.";
          els.saveNewSeriesButton.disabled = false;
        }
        function renderStylePreviewStudio() {
          const tags = (state.styleTags || []).filter((tag) => typeof tag === "object" && tag?.isExploreVisible).slice(0,5);
          if (!tags.length) {
            els.stylePreviewSlots.innerHTML = `<p class="microcopy" style="color:var(--taupe)">Aktifkan tag untuk Explore terlebih dahulu.</p>`;
            els.stylePreviewStatus.textContent = "Belum ada style yang tampil di Match Your Vibe.";
            els.saveStylePreviewsButton.disabled = true;
            return;
          }
          els.stylePreviewSlots.innerHTML = tags.map((tag,index) => {
            const key=String(tag.name||"").toLocaleLowerCase("id-ID");
            const candidates=getNewSeriesCandidates().filter((look)=>(look.styles||[]).some((style)=>String(style).toLocaleLowerCase("id-ID")===key));
            const selectedId=candidates.some((look)=>look.id===tag.previewLookId) ? tag.previewLookId : "";
            const options=[`<option value="">Otomatis pilih look relevan</option>`,...candidates.map((look)=>`<option value="${esc(look.id)}" ${look.id===selectedId?"selected":""}>${esc(look.title)} · ${esc(look.gender)}</option>`)].join("");
            return `<label class="new-series-slot"><span class="new-series-slot-number">${String(index+1).padStart(2,"0")}</span><span><span class="eyebrow" style="display:block;margin-bottom:.35rem;color:var(--clay)">${esc(tag.name)}</span><select data-style-preview-tag="${esc(tag.id||tag.name)}" data-style-preview-name="${esc(tag.name)}">${options}</select></span></label>`;
          }).join("");
          const customCount=tags.filter((tag)=>tag.previewLookId).length;
          els.stylePreviewStatus.textContent=`${customCount} dari ${tags.length} style memakai pilihan khusus. Sisanya menggunakan fallback otomatis.`;
          els.saveStylePreviewsButton.disabled=false;
        }
        function renderStyleTaxonomyStudio() {
          if (!els.styleTaxonomyList) return;
          const tags = (state.styleTags || []).filter((tag) => typeof tag === "object").sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)||String(a.name||"").localeCompare(String(b.name||""),"id"));
          els.styleTaxonomyList.innerHTML = tags.length ? tags.map((tag) => `<form class="style-taxonomy-row${tag.isActive === false ? " is-inactive" : ""}" data-style-taxonomy-row="${esc(tag.id)}">
            <label><span>Nama style</span><input name="name" maxlength="48" value="${esc(tag.name)}" required /></label>
            <label class="style-taxonomy-order"><span>Urutan</span><input name="sortOrder" type="number" min="0" max="1000" step="1" value="${Number(tag.sortOrder||0)}" /></label>
            <label class="style-taxonomy-check"><input name="isActive" type="checkbox"${tag.isActive === false ? "" : " checked"} /><span>Aktif</span></label>
            <label class="style-taxonomy-check"><input name="isExploreVisible" type="checkbox"${tag.isExploreVisible ? " checked" : ""} /><span>Match Your Vibe</span></label>
            <button class="small-button muted" type="submit">Simpan</button>
          </form>`).join("") : `<p class="microcopy" style="color:var(--taupe)">Belum ada style resmi. Tambahkan style pertama di atas.</p>`;
        }
        function renderProductColorPicker() {
          if (!els.productColorOptions || !els.productVariantsInput) return;
          const query=String(els.productColorSearch?.value||"").trim().toLocaleLowerCase("id-ID");
          const options=[...els.productVariantsInput.options];
          const visible=options.filter((option)=>!query || String(option.textContent||option.value).toLocaleLowerCase("id-ID").includes(query));
          els.productColorOptions.innerHTML=visible.map((option)=>{
            const [name,rawHex]=String(option.value||"").split("|");
            const hex=/^#[0-9a-f]{6}$/i.test(rawHex||"")?rawHex:"#B8AEA1";
            return `<button class="product-color-option${option.selected?" is-selected":""}" type="button" data-product-color-value="${esc(option.value)}" aria-pressed="${String(option.selected)}"><span class="product-color-swatch" style="--product-color:${esc(hex)}"></span><span><strong>${esc(name)}</strong><small>${esc(hex.toUpperCase())}</small></span><span class="product-color-check" aria-hidden="true">${option.selected?"✓":"+"}</span></button>`;
          }).join("") || `<p class="product-color-empty">Warna tidak ditemukan.</p>`;
          if (els.productColorCount) els.productColorCount.textContent=`${options.filter((option)=>option.selected).length} dipilih`;
        }
        function getRequestDraft(request) {
          const id = String(request?.id || "");
          if (!id) return { status:"new", responseMessage:"", adminNote:"", recommendations:[] };
          if (!requestDrafts.has(id)) {
            requestDrafts.set(id, {
              status: String(request.status || "new"),
              responseMessage: String(request.responseMessage ?? request.response_message ?? ""),
              adminNote: String(request.adminNote ?? request.admin_note ?? request.note ?? ""),
              recommendations: (request.recommendations || []).map((item) => ({
                type: String(item.type || item.targetType || ""),
                targetId: String(item.targetId || item.id || (item.type === "look" || item.targetType === "look" ? item.lookId : item.productId) || ""),
                label: String(item.label || (item.type === "look" || item.targetType === "look" ? "Lihat look" : "Lihat produk"))
              })).filter((item) => (item.type === "look" || item.type === "product") && item.targetId)
            });
          }
          return requestDrafts.get(id);
        }
        function syncRequestDraft(form) {
          const id = String(form?.dataset?.adminRequestForm || "");
          if (!id || !requestDrafts.has(id)) return;
          const draft = requestDrafts.get(id);
          if (form.elements.status) draft.status = String(form.elements.status.value || "new");
          if (form.elements.responseMessage) draft.responseMessage = String(form.elements.responseMessage.value || "");
          if (form.elements.adminNote) draft.adminNote = String(form.elements.adminNote.value || "");
        }
        function requestCandidateLabel(type, targetId) {
          const target = type === "look" ? getLook(targetId) : getProduct(targetId);
          return target?.title || target?.name || "Kurasi tidak tersedia";
        }
        function renderRequestsStudio() {
          if (!els.studioRequestsList) return;
          const requests = Array.isArray(state.requests) ? [...state.requests] : [];
          if (!cloudEnabled()) {
            els.studioRequestsList.innerHTML = `<p class="microcopy" style="color:var(--taupe)">Antrean request aktif setelah COMOOTD terhubung ke Supabase cloud.</p>`;
            return;
          }
          if (!requests.length) {
            els.studioRequestsList.innerHTML = `<p class="microcopy" style="color:var(--taupe)">Belum ada request dari member. Request akan masuk ke sini setelah user login dan mengirim brief.</p>`;
            return;
          }
          const looks = state.looks.filter(isPublishedCatalogueEntry);
          const products = state.products.filter(isPublishedCatalogueEntry);
          els.studioRequestsList.innerHTML = requests.sort((a,b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)).map((request) => {
            const draft = getRequestDraft(request);
            const selected = new Set(draft.recommendations.map((item) => `${item.type}:${item.targetId}`));
            const title = request.requesterName || request.requester_name || "Member COMOOTD";
            const email = request.requesterEmail || request.requester_email || "";
            const created = new Date(request.createdAt || request.created_at || Date.now()).toLocaleString("id-ID", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
            const tags = memberTags(request.styleTags ?? request.style_tags).map((tag) => `<span>${esc(tag)}</span>`).join("");
            const colors = memberTags(request.preferredColors ?? request.preferred_colors).map((color) => `<span>${esc(color)}</span>`).join("");
            const selection = draft.recommendations.map((item,index) => `<div class="request-rec-chip"><strong>${esc(item.label)} · ${esc(requestCandidateLabel(item.type,item.targetId))}</strong><button type="button" data-remove-request-rec="${esc(request.id)}" data-request-rec-index="${index}" aria-label="Hapus rekomendasi">×</button></div>`).join("") || `<p class="microcopy" style="color:var(--taupe);margin:0">Belum ada kurasi yang dipilih.</p>`;
            return `<form class="request-admin-card" data-admin-request-form="${esc(request.id)}"><div class="request-admin-title"><div><h4>${esc(request.occasion || "Request outfit")}</h4><p class="request-admin-meta">${esc(title)}${email ? ` · ${esc(email)}` : ""} · ${esc(created)}</p></div><span class="request-status is-${esc(String(draft.status || "new").toLowerCase())}">${esc(requestStatusLabel(draft.status))}</span></div><p class="request-admin-brief">${esc(request.message || "Tanpa detail tambahan.")}</p>${tags || colors || request.budgetMin || request.budget_min_idr || request.budgetMax || request.budget_max_idr ? `<div class="request-admin-pills">${tags}${colors}${request.genderTarget || request.gender_target ? `<span>${esc(request.genderTarget || request.gender_target)}</span>` : ""}${request.budgetMin || request.budget_min_idr || request.budgetMax || request.budget_max_idr ? `<span>${esc(money(request.budgetMin ?? request.budget_min_idr ?? 0))} – ${esc(money(request.budgetMax ?? request.budget_max_idr ?? 0))}</span>` : ""}</div>` : ""}<div class="compact-row"><div class="field"><label>Status</label><select name="status"><option value="new" ${draft.status === "new" ? "selected" : ""}>Baru</option><option value="reviewing" ${draft.status === "reviewing" ? "selected" : ""}>Diproses</option><option value="replied" ${draft.status === "replied" ? "selected" : ""}>Rekomendasi siap</option><option value="closed" ${draft.status === "closed" ? "selected" : ""}>Selesai</option><option value="spam" ${draft.status === "spam" ? "selected" : ""}>Ditolak</option></select></div><div class="field"><label>Balasan untuk member</label><input name="responseMessage" maxlength="3000" value="${esc(draft.responseMessage)}" placeholder="Contoh: Kurasi kamu sudah siap." /></div></div><div class="field"><label>Catatan internal admin</label><textarea name="adminNote" maxlength="3000" placeholder="Tidak terlihat oleh member.">${esc(draft.adminNote)}</textarea></div><div class="request-rec-controls"><div class="field"><label>Tambahkan look</label><div class="editor-product-row"><select data-request-look-select="${esc(request.id)}"><option value="">Pilih look published</option>${looks.filter((item) => !selected.has(`look:${item.id}`)).map((item) => `<option value="${esc(item.id)}">${esc(item.title)}</option>`).join("")}</select><button class="small-button muted" type="button" data-add-request-rec="${esc(request.id)}" data-request-rec-type="look">+ Look</button></div></div><div class="field"><label>Tambahkan produk</label><div class="editor-product-row"><select data-request-product-select="${esc(request.id)}"><option value="">Pilih produk published</option>${products.filter((item) => !selected.has(`product:${item.id}`)).map((item) => `<option value="${esc(item.id)}">${esc(item.name)} · ${money(item.price)}</option>`).join("")}</select><button class="small-button muted" type="button" data-add-request-rec="${esc(request.id)}" data-request-rec-type="product">+ Produk</button></div></div></div><div class="request-rec-list">${selection}</div><p class="form-error" data-request-error="${esc(request.id)}" role="alert"></p><button class="small-button" type="button" data-save-request="${esc(request.id)}">Simpan jawaban</button></form>`;
          }).join("");
        }
        function normalizeLibrarySearch(value) { return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g," ").trim(); }
        function productLibrarySearchText(item) {
          return normalizeLibrarySearch([
            item.name, item.slug, item.badge, item.genderTarget,
            ...(item.styles || []),
            ...(item.variants || []).flatMap((variant)=>[variant.name,variant.colorName,variant.hex])
          ].filter(Boolean).join(" "));
        }
        function lookLibrarySearchText(entry) {
          return normalizeLibrarySearch([
            entry.title, entry.slug, entry.gender, ...(entry.styles || []),
            ...(entry.items || []).flatMap((item)=>[
              item?.affiliateUrl && !item?.productId ? item.name : getProduct(item.productId)?.name,
              item.category,
              item.colorLabel,
              item.variantName
            ])
          ].filter(Boolean).join(" "));
        }
        function isInlineCuratorLook(entry) {
          return Boolean((entry?.items || []).some((item) => item?.affiliateUrl && !item?.productId));
        }
        function setLibrarySearchMeta(meta, moreButton, { total, matched, visible, label, query }) {
          if (!total) meta.textContent=`Belum ada ${label}.`;
          else if (query && !matched) meta.textContent=`Tidak ada hasil untuk “${query}”.`;
          else meta.textContent=matched===total ? `${matched} ${label}` : `${matched} dari ${total} ${label}`;
          const remaining=Math.max(0,matched-visible);
          moreButton.hidden=remaining===0;
          moreButton.textContent=remaining>0?`Muat ${Math.min(100,remaining)} ${label} lagi`:"";
        }
        function renderStudioLibraries() {
          const lookQuery=normalizeLibrarySearch(studioLibraryFilters.looks);
          const productQuery=normalizeLibrarySearch(studioLibraryFilters.products);
          const sortedLooks=[...state.looks].sort((a,b)=>Number(b.createdOrder||0)-Number(a.createdOrder||0));
          const matchedLooks=lookQuery?sortedLooks.filter((entry)=>lookLibrarySearchText(entry).includes(lookQuery)):sortedLooks;
          const visibleLooks=matchedLooks.slice(0,studioLibraryLimits.looks);
          els.studioLooksList.innerHTML=visibleLooks.length?visibleLooks.map((entry)=>`<div class="studio-row"><p><strong>${esc(entry.title)}</strong><span>${esc(entry.gender)} · ${esc((entry.styles||[]).join(", "))} · ${(entry.items||[]).length} item${isInlineCuratorLook(entry)?" · Curator":""}</span></p><div class="studio-row-actions">${isInlineCuratorLook(entry)?`<span class="microcopy" style="color:var(--taupe)">Dikelola Curator</span>`:`<button class="small-button muted" data-edit-look="${esc(entry.id)}" type="button">Edit</button><button class="small-button danger" data-delete-look="${esc(entry.id)}" type="button">Hapus</button>`}</div></div>`).join(""):(state.looks.length?`<p class="microcopy" style="color:var(--taupe)">Tidak ada look yang cocok dengan pencarian.</p>`:`<p class="microcopy" style="color:var(--taupe)">Belum ada look tersimpan.</p>`);
          setLibrarySearchMeta(els.studioLooksSearchMeta,els.loadMoreStudioLooks,{total:state.looks.length,matched:matchedLooks.length,visible:visibleLooks.length,label:"look",query:studioLibraryFilters.looks});

          const sortedProducts=[...state.products];
          const matchedProducts=productQuery?sortedProducts.filter((item)=>productLibrarySearchText(item).includes(productQuery)):sortedProducts;
          const visibleProducts=matchedProducts.slice(0,studioLibraryLimits.products);
          els.studioProductsList.innerHTML=visibleProducts.length?visibleProducts.map((item)=>{ const usage=getProductUsage(item.id).length; return `<div class="studio-row"><p><strong>${esc(item.name)}</strong><span>${money(item.price)} · ${(item.variants||[]).length} warna · dipakai ${usage} look</span></p><div class="studio-row-actions"><button class="small-button muted" data-edit-product="${esc(item.id)}" type="button">Edit</button><button class="small-button danger" data-delete-product="${esc(item.id)}" type="button">Hapus</button></div></div>`; }).join(""):(state.products.length?`<p class="microcopy" style="color:var(--taupe)">Tidak ada produk yang cocok dengan pencarian.</p>`:`<p class="microcopy" style="color:var(--taupe)">Belum ada produk.</p>`);
          setLibrarySearchMeta(els.studioProductsSearchMeta,els.loadMoreStudioProducts,{total:state.products.length,matched:matchedProducts.length,visible:visibleProducts.length,label:"produk",query:studioLibraryFilters.products});
        }
        function renderCuratorAdmin() {
          const list=document.getElementById("studioCuratorsList");
          const applicationList=document.getElementById("studioCuratorApplicationsList");
          if(!list || !applicationList) return;
          if(!cloudEnabled() || !cloudAdmin) {
            list.innerHTML=`<p class="microcopy" style="color:var(--taupe)">Masuk sebagai admin untuk mengatur Curator.</p>`;
            applicationList.innerHTML=`<p class="microcopy" style="color:var(--taupe)">Masuk sebagai admin untuk melihat pengajuan.</p>`;
            return;
          }
          const pendingApplications=curatorApplications.filter((item)=>item.status==="submitted");
          const pendingMarkup=pendingApplications.length?pendingApplications.map((item)=>{
            const links=[item.instagramUrl&&`<a href="${esc(item.instagramUrl)}" target="_blank" rel="noopener">Instagram ↗</a>`,item.tiktokUrl&&`<a href="${esc(item.tiktokUrl)}" target="_blank" rel="noopener">TikTok ↗</a>`,item.portfolioUrl&&`<a href="${esc(item.portfolioUrl)}" target="_blank" rel="noopener">Portofolio ↗</a>`].filter(Boolean).join(" · ");
            return `<article class="curator-application-card" data-curator-application-id="${esc(item.id)}"><div class="curator-application-summary"><p class="eyebrow">@${esc(item.requestedHandle)} · ${esc(item.contactEmail)}</p><h4>${esc(item.displayName)}</h4><p>${esc(item.bio||"Belum ada bio.")}</p><div class="curator-application-tags">${(item.profileTags||[]).map((tag)=>`<span>${esc(tag)}</span>`).join("")}</div>${links?`<p class="curator-application-links">${links}</p>`:""}<blockquote>${esc(item.motivation)}</blockquote></div><div class="curator-application-review"><label>Trust level<select data-application-trust><option value="emerging">Emerging</option><option value="verified">Verified</option><option value="editorial">Editorial</option></select></label><label>Limit look<input data-application-limit type="number" min="0" max="1000" step="1" value="30" /></label><label>Catatan keputusan<textarea data-application-note maxlength="1000" placeholder="Alasan atau arahan perbaikan"></textarea></label><div class="studio-row-actions"><button class="small-button" type="button" data-review-curator-application="approved">Setujui</button><button class="small-button danger" type="button" data-review-curator-application="rejected">Tolak</button></div></div></article>`;
          }).join(""):`<p class="microcopy" style="color:var(--taupe)">Tidak ada pengajuan baru.</p>`;
          const reviewedApplications=curatorApplications.filter((item)=>item.status==="approved"||item.status==="rejected").slice(0,20);
          const historyMarkup=reviewedApplications.length?`<div class="curator-application-history"><h4>Riwayat keputusan</h4>${reviewedApplications.map((item)=>`<div class="studio-row"><p><strong>${esc(item.displayName)}</strong><span>@${esc(item.requestedHandle)} · ${item.status==="approved"?"Disetujui":"Ditolak"}${item.adminNote?` · ${esc(item.adminNote)}`:""}</span></p></div>`).join("")}</div>`:"";
          applicationList.innerHTML=pendingMarkup+historyMarkup;
          const activeLookCounts=new Map();
          (state.looks||[]).filter((look)=>look.status!=="archived").forEach((look)=>{
            const creatorId=String(look.creatorId||look.creator_id||"");
            if(creatorId) activeLookCounts.set(creatorId,(activeLookCounts.get(creatorId)||0)+1);
          });
          const curators=[...(state.curators||[])]
            .filter((curator)=>String(curator?.userId||curator?.id||""))
            .sort((a,b)=>String(a.displayName||a.name||a.handle||"").localeCompare(String(b.displayName||b.name||b.handle||"")));
          list.innerHTML=curators.length?curators.map((curator)=>{
            const id=String(curator.userId||curator.id||"");
            const name=String(curator.displayName||curator.name||curator.handle||"COMOOTD Curator");
            const handle=String(curator.handle||"");
            const rawQuota=Number(curator.maxPublishedLooks??curator.activeLookLimit??30);
            const quota=Number.isInteger(rawQuota)&&rawQuota>=0&&rawQuota<=1000?rawQuota:30;
            const active=curator.isActive!==false;
            const trust=String(curator.trustLevel||"emerging");
            const lookCount=activeLookCounts.get(id)||0;
            return `<div class="studio-row curator-admin-row" data-curator-admin-row data-curator-admin-id="${esc(id)}"><p><strong>${esc(name)}</strong><span>@${esc(handle||"tanpa-handle")} · ${lookCount} look aktif · ${active?"Aktif":"Dinonaktifkan"}</span></p><div class="curator-admin-actions"><label>Trust <select data-curator-trust><option value="emerging"${trust==="emerging"?" selected":""}>Emerging</option><option value="verified"${trust==="verified"?" selected":""}>Verified</option><option value="editorial"${trust==="editorial"?" selected":""}>Editorial</option></select></label><label>Limit <input data-curator-limit type="number" min="0" max="1000" step="1" value="${quota}" inputmode="numeric" /></label><label><input data-curator-active type="checkbox"${active?" checked":""} /> Aktif</label><button class="small-button muted" type="button" data-save-curator-access>Simpan</button></div></div>`;
          }).join(""):`<p class="microcopy" style="color:var(--taupe)">Belum ada akun Curator.</p>`;
        }
        function renderStudio() {
          const currentProduct = els.lookProduct.value;
          els.lookProduct.innerHTML = state.products.length ? state.products.map((item)=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("") : `<option value="">Tambah produk terlebih dahulu</option>`;
          if (state.products.some((item)=>item.id===currentProduct)) els.lookProduct.value=currentProduct;
          renderVariantSelect();
          renderDraftItems();
          renderNewSeriesStudio();
          renderStorefrontVisualStudio();
          renderStyleTaxonomyStudio();
          renderStylePreviewStudio();
          renderJournalStudio();
          renderRequestsStudio();
          renderStudioLibraries();
          renderCuratorAdmin();
          renderProductColorPicker();
          els.studioArticlesList.innerHTML = state.articles.length ? [...state.articles].map((article)=>`<div class="studio-row"><p><strong>${esc(article.title)}</strong><span>${esc(articleCategoryLabel(article.category))} · ${(article.blocks || []).length || "teks"} blok · ${(article.ctas || []).length} CTA</span></p><div class="studio-row-actions"><button class="small-button danger" data-delete-article="${esc(article.id)}" type="button">Hapus</button></div></div>`).join("") : `<p class="microcopy" style="color:var(--taupe)">Belum ada artikel tersimpan.</p>`;
        }
        function renderVariantSelect() {
          const chosen = getProduct(els.lookProduct.value) || state.products[0];
          els.lookVariant.innerHTML = chosen?.variants?.map((variant)=>`<option value="${esc(variant.name)}">${esc(variant.name)}</option>`).join("") || `<option value="">—</option>`;
        }
        function renderDraftItems() {
          els.lookDraftItems.innerHTML = lookDraftItems.length ? lookDraftItems.map((item,index)=>{ const productItem=getProduct(item.productId); return `<div class="draft-item"><p><strong>${esc(productItem?.name || "Produk dihapus")}</strong><span>Warna pilihan: ${esc(item.variantName)}</span></p><button class="small-button danger" type="button" data-remove-draft="${index}">×</button></div>`; }).join("") : `<p class="microcopy" style="color:var(--taupe);margin:0">Masukkan 2–5 item untuk mempublikasikan look.</p>`;
        }
        function getLookImageInputs() {
          return [document.getElementById("lookCoverInput"),document.getElementById("lookMedia2Input"),document.getElementById("lookMedia3Input")];
        }
        function currentLookPriorMedia() {
          const entry=editingLookId?getLook(editingLookId):null;
          return Array.isArray(entry?.media)&&entry.media.length ? entry.media : entry?.coverImage ? [{path:entry.coverImage,image:entry.coverImage,alt:entry.coverAlt||"",aspect:entry.coverAspect||"portrait"}] : [];
        }
        function clearLookGalleryPreviewUrls() {
          lookGalleryPreviewUrls.forEach((url)=>URL.revokeObjectURL(url));
          lookGalleryPreviewUrls=[];
        }
        function lookGallerySlot(slot) {
          if (lookGalleryRemovedSlots.has(slot)) return null;
          const input=getLookImageInputs()[slot];
          const file=window.COMOOTDImageCropper?.getFile?.(input) || (input?.files?.[0] || null);
          const prior=currentLookPriorMedia()[slot] || null;
          if (!file && !prior?.image && !prior?.path) return null;
          let image=safeImage(prior?.image || prior?.path || "");
          if (file) { image=URL.createObjectURL(file); lookGalleryPreviewUrls.push(image); }
          return {slot,input,file,prior,image,aspect:file?selectedImageAspect(input,"portrait"):imageAspect(prior?.aspect||prior?.path||prior?.image,"portrait")};
        }
        function renderLookGalleryOrganizer() {
          if (!els.lookGalleryOrganizer) return;
          clearLookGalleryPreviewUrls();
          const entries=lookGallerySlotOrder.map(lookGallerySlot).filter(Boolean);
          if (!entries.length) {
            els.lookGalleryOrganizer.innerHTML=`<div class="look-gallery-empty"><strong>Belum ada foto</strong><span>Pilih hingga tiga foto sekaligus. Setelah crop, atur urutan cover di sini.</span></div>`;
            return;
          }
          els.lookGalleryOrganizer.innerHTML=entries.map((entry,index)=>`<article class="look-gallery-card${index===0?" is-cover":""}" data-look-gallery-slot="${entry.slot}">
            <div class="look-gallery-preview ${imageFrameClass(entry.aspect,"portrait")}">${entry.image?`<img src="${esc(entry.image)}" alt="Preview foto look ${index+1}" />`:""}<span>${index===0?"COVER":`FOTO ${index+1}`}</span></div>
            <div class="look-gallery-card-actions"><button type="button" data-gallery-move="left" aria-label="Geser foto ke kiri"${index===0?" disabled":""}>←</button><button type="button" data-gallery-cover${index===0?" disabled":""}>Jadikan cover</button><button type="button" data-gallery-move="right" aria-label="Geser foto ke kanan"${index===entries.length-1?" disabled":""}>→</button><button class="is-danger" type="button" data-gallery-remove aria-label="Hapus foto">×</button></div>
          </article>`).join("");
        }
        function resetLookGallery({ preserveExisting = false } = {}) {
          lookGalleryQueue=[]; lookGalleryQueueIndex=0; lookGallerySlotOrder=[0,1,2];
          lookGalleryRemovedSlots=preserveExisting?new Set():new Set([0,1,2]);
          getLookImageInputs().forEach((input)=>window.COMOOTDImageCropper?.clear?.(input));
          if (els.lookGalleryInput) els.lookGalleryInput.value="";
          renderLookGalleryOrganizer();
        }
        function processNextLookGalleryFile() {
          if (lookGalleryQueueIndex>=lookGalleryQueue.length) { lookGalleryQueue=[]; lookGalleryQueueIndex=0; if(els.lookGalleryInput) els.lookGalleryInput.value=""; renderLookGalleryOrganizer(); return; }
          const slot=lookGalleryQueueIndex;
          const file=lookGalleryQueue[lookGalleryQueueIndex++];
          const input=getLookImageInputs()[slot];
          try {
            const transfer=new DataTransfer(); transfer.items.add(file); input.files=transfer.files;
            input.dispatchEvent(new Event("change",{bubbles:true}));
          } catch(error) {
            els.lookFormError.textContent="Perangkat ini belum mendukung pemilihan beberapa foto sekaligus. Coba gunakan browser terbaru.";
            lookGalleryQueue=[];
          }
        }
        function setupLookGalleryInput() {
          els.lookGalleryInput?.addEventListener("change",()=>{
            const files=[...(els.lookGalleryInput.files||[])];
            if(files.length>3){els.lookFormError.textContent="Pilih maksimal tiga foto untuk satu look.";els.lookGalleryInput.value="";return;}
            if(!files.length)return;
            getLookImageInputs().forEach((input)=>window.COMOOTDImageCropper?.clear?.(input));
            lookGalleryRemovedSlots=new Set([0,1,2]);
            files.forEach((_,slot)=>lookGalleryRemovedSlots.delete(slot));
            lookGallerySlotOrder=[0,1,2]; lookGalleryQueue=files; lookGalleryQueueIndex=0;
            els.lookFormError.textContent=""; processNextLookGalleryFile();
          });
          getLookImageInputs().forEach((input)=>{
            input?.addEventListener("comootd:image-ready",()=>{renderLookGalleryOrganizer();processNextLookGalleryFile();});
            input?.addEventListener("comootd:image-clear",(event)=>{if(event.detail?.reason==="cancelled")processNextLookGalleryFile();renderLookGalleryOrganizer();});
            input?.addEventListener("comootd:image-error",()=>{processNextLookGalleryFile();renderLookGalleryOrganizer();});
          });
          els.lookGalleryOrganizer?.addEventListener("click",(event)=>{
            const card=event.target.closest("[data-look-gallery-slot]"); if(!card)return;
            const slot=Number(card.dataset.lookGallerySlot); const position=lookGallerySlotOrder.indexOf(slot);
            if(event.target.closest("[data-gallery-cover]")){lookGallerySlotOrder.splice(position,1);lookGallerySlotOrder.unshift(slot);renderLookGalleryOrganizer();return;}
            const move=event.target.closest("[data-gallery-move]")?.dataset.galleryMove;
            if(move){const next=move==="left"?position-1:position+1;if(next>=0&&next<lookGallerySlotOrder.length){[lookGallerySlotOrder[position],lookGallerySlotOrder[next]]=[lookGallerySlotOrder[next],lookGallerySlotOrder[position]];renderLookGalleryOrganizer();}return;}
            if(event.target.closest("[data-gallery-remove]")){lookGalleryRemovedSlots.add(slot);window.COMOOTDImageCropper?.clear?.(getLookImageInputs()[slot]);renderLookGalleryOrganizer();}
          });
          renderLookGalleryOrganizer();
        }
        function resetLookEditor() {
          editingLookId="";
          lookDraftItems=[];
          els.lookForm.reset();
          setTaxonomyValues(els.lookForm,"lookStyles",[]);
          els.lookFormHeading.textContent="Tambah look";
          els.lookFormCopy.textContent="Pilih 2–5 produk dari library. Warna dapat dipilih berbeda meski link marketplace-nya sama.";
          els.lookCoverLabel.textContent="Foto look (opsional, maksimal 3)";
          els.lookSubmitButton.textContent="Publikasikan look";
          els.lookEditActions.hidden=true;
          els.lookFormError.textContent="";
          resetLookGallery();
          renderVariantSelect();
          renderDraftItems();
        }
        function startLookEdit(entry) {
          if(!entry) return;
          editingLookId=entry.id;
          lookDraftItems=clone(entry.items||[]);
          els.lookForm.elements.title.value=entry.title||"";
          els.lookForm.elements.excerpt.value=entry.excerpt||"";
          els.lookForm.elements.gender.value=entry.gender||"Uniseks";
          setTaxonomyValues(els.lookForm,"lookStyles",entry.styles||[]);
          els.lookFormHeading.textContent="Edit look";
          els.lookFormCopy.textContent="Perbarui detail dan item look tanpa mengubah ID atau relasi New Series, Journal, dan request outfit.";
          els.lookCoverLabel.textContent="Ganti atau atur foto look (maksimal 3)";
          els.lookSubmitButton.textContent="Simpan perubahan look";
          els.lookEditActions.hidden=false;
          els.lookFormError.textContent="";
          lookGallerySlotOrder=[0,1,2]; lookGalleryRemovedSlots=new Set(); renderLookGalleryOrganizer();
          renderVariantSelect();
          renderDraftItems();
          els.lookFormHeading.scrollIntoView?.({behavior:"smooth",block:"start"});
        }
        function resetProductEditor() {
          editingProductId="";
          [...els.productForm.elements.variants.querySelectorAll("[data-legacy-color]")].forEach((option)=>option.remove());
          els.productForm.reset();
          setTaxonomyValues(els.productForm,"productStyles",[]);
          els.productFormHeading.textContent="Tambah produk";
          els.productFormCopy.textContent="Tempel link tujuan. Shopee, TikTok Shop, dan website umum dikenali otomatis.";
          els.productImageLabel.textContent="Upload foto produk (opsional)";
          els.productSubmitButton.textContent="Simpan produk";
          els.productEditActions.hidden=true;
          els.productFormError.textContent="";
          if (els.productColorSearch) els.productColorSearch.value="";
          renderProductColorPicker();
        }
        function startProductEdit(item) {
          if(!item) return;
          editingProductId=item.id;
          els.productForm.elements.title.value=item.name||"";
          els.productForm.elements.price.value=item.price||"";
          els.productForm.elements.badge.value=item.badge||"";
          els.productForm.elements.genderTarget.value=item.genderTarget||"unisex";
          els.productForm.elements.category.value=item.category||"other";
          els.productForm.elements.link.value=item.affiliateUrl||"";
          const secondary=marketplaceLinksOf(item).find((link)=>!link.isPrimary)||marketplaceLinksOf(item)[1]||null;
          els.productForm.elements.secondaryLink.value=secondary?.affiliateUrl||"";
          setTaxonomyValues(els.productForm,"productStyles",item.styles||[]);
          const variantSelect=els.productForm.elements.variants;
          [...variantSelect.querySelectorAll("[data-legacy-color]")].forEach((option)=>option.remove());
          const selectedVariants=new Set((item.variants||[]).map((variant)=>`${variant.name}|${String(variant.hex||"").toUpperCase()}`));
          selectedVariants.forEach((value)=>{if(![...variantSelect.options].some((option)=>`${option.value.split("|")[0]}|${option.value.split("|")[1].toUpperCase()}`===value)){const option=document.createElement("option");option.value=value;option.textContent=`${value.replace("|"," · ")} · existing`;option.dataset.legacyColor="true";variantSelect.append(option);}});
          [...variantSelect.options].forEach((option)=>{option.selected=selectedVariants.has(`${option.value.split("|")[0]}|${option.value.split("|")[1].toUpperCase()}`);});
          if (els.productColorSearch) els.productColorSearch.value="";
          renderProductColorPicker();
          // Storage paths are intentionally not copied into this visible URL field.
          els.productForm.elements.imageUrl.value="";
          els.productFormHeading.textContent="Edit produk";
          els.productFormCopy.textContent="Perbarui produk yang sama. Harga, link, dan semua look yang menggunakannya tetap terhubung.";
          els.productImageLabel.textContent="Ganti foto produk (opsional)";
          els.productSubmitButton.textContent="Simpan perubahan produk";
          els.productEditActions.hidden=false;
          els.productFormError.textContent="";
          els.productFormHeading.scrollIntoView?.({behavior:"smooth",block:"start"});
        }
        function reconcileProductVariantIds(variants, productItem) {
          const existing=productItem?.variants||[];
          const claimed=new Set();
          const resolved=new Array(variants.length).fill("");
          variants.forEach((variant,index)=>{
            const name=normalizeLibrarySearch(variant.name);
            const matched=existing.find((candidate)=>!claimed.has(candidate.id)&&normalizeLibrarySearch(candidate.name)===name);
            if(matched){resolved[index]=matched.id;claimed.add(matched.id);}
          });
          variants.forEach((variant,index)=>{
            if(resolved[index]) return;
            const candidate=existing[index];
            if(candidate&&!claimed.has(candidate.id)){resolved[index]=candidate.id;claimed.add(candidate.id);}
          });
          return variants.map((variant,index)=>({...variant,id:resolved[index]||null}));
        }
        function assertLocalProductVariantSafety(item, variants) {
          const usedNames=new Set(state.looks.filter((look)=>look.items.some((entry)=>entry.productId===item.id)).flatMap((look)=>look.items.filter((entry)=>entry.productId===item.id).map((entry)=>normalizeLibrarySearch(entry.variantName))));
          const nextNames=new Set(variants.map((variant)=>normalizeLibrarySearch(variant.name)));
          const removed=[...usedNames].filter((name)=>!nextNames.has(name));
          if(removed.length) throw new Error("Warna yang sudah dipakai look tidak dapat dihapus atau diganti namanya. Edit look terkait terlebih dahulu.");
        }
        function renderAll() { renderMoodList(); renderPopular(); renderStyleControls(); renderLooks(); renderNewSeries(); renderJournal(); renderStorefrontVisuals(); renderStudio(); renderPersonalized(); }

        function marketplaceFromUrl(value) {
          let parsed;
          try { parsed = new URL(String(value || "").trim()); }
          catch { throw new Error("Gunakan link tujuan yang lengkap."); }
          if (parsed.protocol !== "https:" || !parsed.hostname.includes(".")) throw new Error("Link tujuan harus berupa alamat HTTPS publik.");
          const host = parsed.hostname.toLowerCase();
          if (host === "shope.ee" || host === "shopee.co.id" || host.endsWith(".shopee.co.id")) return "shopee";
          if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok_shop";
          return "website";
        }
        function affiliateUrl(value, expectedMarketplace = "") {
          const marketplace = marketplaceFromUrl(value);
          if (expectedMarketplace && marketplace !== expectedMarketplace) throw new Error(`Link tidak sesuai jenis platform (${MARKETPLACES[expectedMarketplace]?.label || expectedMarketplace}).`);
          return new URL(String(value).trim()).href;
        }
        function marketplaceOf(item) { try { return item?.affiliatePlatform || marketplaceFromUrl(item?.affiliateUrl); } catch { return "website"; } }
        function marketplaceLabel(item) { return MARKETPLACES[marketplaceOf(item)]?.label || "Website"; }
        function marketplaceLinksOf(item) {
          const links=Array.isArray(item?.marketplaceLinks)?item.marketplaceLinks.filter((link)=>link?.affiliateUrl&&link.status!=="disabled"):[];
          const available=links.length?links:[item?.affiliateUrl?{id:"",marketplace:marketplaceOf(item),affiliateUrl:item.affiliateUrl,label:marketplaceLabel(item),status:item.linkStatus||"active",isPrimary:true}:null].filter(Boolean);
          const prioritized=[...available].sort((left,right)=>Number(left.marketplace==="website")-Number(right.marketplace==="website"));
          return prioritized.map((link,index)=>({...link,isPrimary:index===0}));
        }
        function marketplaceDestinationsMarkup(item,{contextLook="",reportType="product_link",className="marketplace-destination"}={}) {
          return `<div class="marketplace-destinations">${marketplaceLinksOf(item).map((link,index)=>`<a class="${className}${link.isPrimary||index===0?" is-primary":""}${link.status==="reported"?" is-reported":""}" href="${esc(safeUrl(link.affiliateUrl))}" target="_blank" rel="sponsored noopener" data-insight-target="${item?.type==="reference"?"curator_item":"product"}" data-insight-id="${esc(item.id)}"${contextLook?` data-insight-context-look="${esc(contextLook)}"`:""} data-report-target="${esc(link.id?reportType:(item?.type==="reference"?"curator_item":"product"))}" data-report-id="${esc(link.id||item.id)}">${esc(link.label||MARKETPLACES[link.marketplace]?.label||"Website")} ↗</a>`).join("")}</div>`;
        }
        function safeUrl(value) { try { return affiliateUrl(value); } catch { return "#"; } }
        let contentRouteSyncing = false;
        function contentRouteSegment(type) { return type === "look" ? "looks" : type === "product" ? "products" : "journal"; }
        function contentEntitySlug(entry, type) { return String(entry?.slug || slugify(entry?.title || entry?.name || type || "comootd")).trim(); }
        function contentRouteUrl(type, entry, variantId = "") {
          const url = new URL("/", window.location.origin);
          url.pathname = `/${contentRouteSegment(type)}/${encodeURIComponent(contentEntitySlug(entry, type))}`;
          if (type === "product" && variantId) url.searchParams.set("variant", variantId);
          return url;
        }
        function readContentRoute() {
          const parts = window.location.pathname.split("/").filter(Boolean);
          if (parts.length !== 2) return null;
          if (parts[0] === "looks" && (parts[1] === "comootd" || parts[1] === "curators")) return null;
          const type = parts[0] === "looks" ? "look" : parts[0] === "products" ? "product" : parts[0] === "journal" ? "article" : "";
          if (!type) return null;
          try {
            const slug = decodeURIComponent(parts[1]).trim().toLowerCase();
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
            return { type, slug, variantId: type === "product" ? String(new URL(window.location.href).searchParams.get("variant") || "") : "" };
          } catch { return null; }
        }
        const directoryPage = window.COMOOTDCatalogueDirectory.create({
          getState:()=>state, esc, slugify, money, safeImage,
          marketplaces:MARKETPLACES, productCategories:PRODUCT_CATEGORIES,
          marketplaceOf, marketplaceLabel, lookVisual, productArt, lookAttribution,
          curatorMetricsMarkup, lookLikeButton, saveButton:(type,id,compact)=>memberRetention.saveButton(type,id,compact), articleCategoryLabel
        });
        function readDirectoryRoute() { return directoryPage.readRoute(); }
        function ensureCatalogueRouteLayer() { return directoryPage.ensureLayer(); }
        function renderDirectoryRoute() { return directoryPage.render(); }
        function renderRequestRoute() {
          const active = window.location.pathname.replace(/\/+$/, "") === "/request";
          if (els.requestRouteLayer) {
            els.requestRouteLayer.hidden = !active;
            els.requestRouteLayer.classList.toggle("is-open", active);
          }
          document.body.classList.toggle("request-route-open", active);
          if (!active) return false;
          renderDirectoryRoute();
          const title = "Request Outfit — COMOOTD";
          const description = "Kirim brief agenda, budget, dan arah gaya untuk menerima rekomendasi outfit personal dari COMOOTD.";
          const canonical = new URL("/request", window.location.origin).href;
          document.title = title;
          document.getElementById("pageTitle")?.replaceChildren(title);
          document.getElementById("canonicalUrl")?.setAttribute("href", canonical);
          setMetaContent("pageDescription", description); setMetaContent("openGraphType", "website"); setMetaContent("openGraphTitle", title);
          setMetaContent("openGraphDescription", description); setMetaContent("openGraphUrl", canonical); setMetaContent("twitterCard", "summary");
          setMetaContent("twitterTitle", title); setMetaContent("twitterDescription", description);
          setOptionalMeta("openGraphImage", "property", "og:image", ""); setOptionalMeta("twitterImage", "name", "twitter:image", "");
          return true;
        }
        function contentEntryForRoute(route) {
          const source = route?.type === "look" ? state.looks : route?.type === "product" ? state.products : state.articles;
          return source?.find((entry) => contentEntitySlug(entry, route?.type).toLowerCase() === route?.slug) || null;
        }
        function contentPresentation(type, entry, variantId = "") {
          const name = String(entry?.title || entry?.name || "COMOOTD");
          const styles = Array.isArray(entry?.styles) ? entry.styles.filter(Boolean).slice(0, 3) : [];
          if (type === "look") return { title: `${name} — COMOOTD Look`, description: styles.length ? `${styles.join(" · ")} — temukan setiap item dalam look ini di COMOOTD.` : "Temukan setiap item dalam look kurasi COMOOTD ini.", image: safeImage(entry?.coverImage), ogType: "website" };
          if (type === "product") { const variant = entry?.variants?.find((item) => item.id === variantId) || entry?.variants?.[0]; return { title: `${name} — COMOOTD`, description: `${money(entry?.price)}${styles.length ? ` · ${styles.join(" · ")}` : ""} — pilihan kurasi COMOOTD yang mudah dipadankan.`, image: safeImage(variant?.image || entry?.image || entry?.variants?.[0]?.image), ogType: "product" }; }
          return { title: `${name} — COMOOTD Journal`, description: String(entry?.excerpt || "Catatan style dari COMOOTD.").trim(), image: safeImage(entry?.coverImage), ogType: "article" };
        }
        function setMetaContent(id, value) { const node = document.getElementById(id); if (node) node.setAttribute("content", value); }
        function setOptionalMeta(id, attribute, attributeValue, value) {
          let node = document.getElementById(id);
          if (!value) { node?.remove(); return; }
          if (!node) { node = document.createElement("meta"); node.id = id; node.setAttribute(attribute, attributeValue); document.head.append(node); }
          node.setAttribute("content", value);
        }
        function updateClientMetadata(route = null, entry = null) {
          const presentation = route && entry ? contentPresentation(route.type, entry, route.variantId) : { title:"COMOOTD — Temukan look yang kamu banget.", description:"COMOOTD - katalog look fashion all-gender yang dikurasi untuk memudahkan menemukan style yang tepat.", image:"", ogType:"website" };
          const canonical = route && entry ? contentRouteUrl(route.type, entry).href : new URL("/", window.location.origin).href;
          document.title = presentation.title;
          document.getElementById("pageTitle")?.replaceChildren(presentation.title);
          document.getElementById("canonicalUrl")?.setAttribute("href", canonical);
          setMetaContent("pageDescription", presentation.description);
          setMetaContent("openGraphType", presentation.ogType);
          setMetaContent("openGraphTitle", presentation.title);
          setMetaContent("openGraphDescription", presentation.description);
          setMetaContent("openGraphUrl", canonical);
          setMetaContent("twitterCard", presentation.image ? "summary_large_image" : "summary");
          setMetaContent("twitterTitle", presentation.title);
          setMetaContent("twitterDescription", presentation.description);
          setOptionalMeta("openGraphImage", "property", "og:image", presentation.image);
          setOptionalMeta("twitterImage", "name", "twitter:image", presentation.image);
        }
        function withContentRouteSync(callback) {
          const wasSyncing = contentRouteSyncing;
          contentRouteSyncing = true;
          try { callback(); } finally { contentRouteSyncing = wasSyncing; }
        }
        function closeContentDialogs(except = null) {
          withContentRouteSync(() => [els.lookModal, els.productModal, els.articleModal].forEach((dialog) => { if (dialog && dialog !== except && dialog.open) dialog.close(); }));
        }
        function contentReturnPath() {
          const stateReturn = typeof window.history.state?.contentReturn === "string" ? window.history.state.contentReturn : "";
          if (stateReturn) return stateReturn;
          const currentDirectory = readDirectoryRoute();
          if (currentDirectory) return `${window.location.pathname}${window.location.search}`;
          return "/";
        }
        function navigateToContent(type, entry, { variantId = "", replace = false } = {}) {
          const url = contentRouteUrl(type, entry, variantId);
          if (`${window.location.pathname}${window.location.search}` !== `${url.pathname}${url.search}`) {
            window.history[replace ? "replaceState" : "pushState"]({ comootdContent: true, contentReturn: contentReturnPath() }, "", `${url.pathname}${url.search}`);
          }
          updateClientMetadata({ type, slug: contentEntitySlug(entry, type), variantId }, entry);
        }
        function closeContentView() {
          closeContentDialogs();
          if (readContentRoute()) {
            const returnPath = contentReturnPath();
            window.history.replaceState({}, "", returnPath);
            applyContentRoute();
            return;
          }
          updateClientMetadata();
        }
        function applyContentRoute({ notify = false } = {}) {
          if (renderRequestRoute()) { closeContentDialogs(); return; }
          if (renderDirectoryRoute()) { closeContentDialogs(); return; }
          const route = readContentRoute();
          if (!route) { closeContentDialogs(); updateClientMetadata(); return; }
          const entry = contentEntryForRoute(route);
          if (!entry) {
            closeContentDialogs();
            if (notify) showToast("Konten ini belum tersedia atau sudah tidak dipublikasikan.");
            return;
          }
          if (route.type === "look") openLook(entry.id, { navigate: false });
          else if (route.type === "product") openProduct(entry.id, { navigate: false, variantId: route.variantId });
          else openArticle(entry.id, { navigate: false });
        }
        function openLook(id, { navigate = true } = {}) {
          const entry = state.looks.find((lookItem)=>lookItem.id===id);
          if (!entry) return;
          void memberRetention.recordView("look", entry.id);
          void window.COMOOTDInsights?.track?.("look_view", "look", entry.id, `look:${entry.id}:${location.pathname}`);
          if (navigate) { navigateToContent("look", entry); renderDirectoryRoute(); }
          else updateClientMetadata({ type:"look", slug:contentEntitySlug(entry,"look") }, entry);
          closeContentDialogs(els.lookModal);
          const itemsHtml = entry.items.map((item)=>{
            if (!item?.productId) {
              const itemAction=item.affiliateUrl?marketplaceDestinationsMarkup(item,{contextLook:entry.id,reportType:"curator_link",className:"marketplace-destination"}):`<span class="item-link" aria-disabled="true">Link nonaktif</span>`;
              return `<li class="look-item"><div class="look-item-art" aria-hidden="true" style="display:grid;place-items:center;background:var(--paper-deep);color:var(--clay-dark)"><span class="meta">${esc(String(item.category||"item").slice(0,4))}</span></div><div><p class="look-item-title">${esc(item.name||"Item pilihan")}</p><div class="look-item-info"><span>${esc(item.colorLabel||item.variantName||"Warna pilihan")}</span><span>·</span><span>${Number(item.price)>0?money(item.price):"Harga belum dicantumkan"}</span></div></div>${itemAction}</li>`;
            }
            const productItem=getProduct(item.productId); if (!productItem) return "";
            const variant=getVariant(productItem,item.variantName);
            return `<li class="look-item"><button class="look-item-art product-card-open" type="button" data-open-product="${esc(productItem.id)}" aria-label="Buka detail ${esc(productItem.name)}">${productArt(productItem,variant,true)}</button><div><button class="look-item-title" type="button" data-open-product="${esc(productItem.id)}">${esc(productItem.name)}</button><div class="look-item-info"><span class="swatch" style="--swatch:${esc(variant?.hex||"#ccc")}"></span><span>${esc(variant?.name||"Warna pilihan")}</span><span>·</span><span>${money(productItem.price)}</span></div></div>${marketplaceDestinationsMarkup(productItem,{contextLook:entry.id,reportType:"product_link",className:"marketplace-destination"})}</li>`;
          }).join("");
          const curatorName = entry.curator?.displayName || entry.curator?.name || "";
          const curatorHandle = entry.curator?.handle || "";
          const curatorLine = curatorName ? `<p class="eyebrow" style="color:var(--taupe);margin:.5rem 0 0">CURATED BY ${esc(curatorName)}${curatorHandle ? ` / @${esc(curatorHandle)}` : ""}</p>` : "";
          els.lookDetail.innerHTML = `<div class="look-detail"><div class="detail-visual">${lookVisual(entry,true)}</div><div class="detail-content"><div class="detail-heading"><p class="eyebrow" style="color:var(--clay)">${esc(lookAttribution(entry))} / ${esc(entry.gender)}</p><h2>${esc(entry.title)}</h2>${curatorLine}${curatorMetricsMarkup(entry)}<div class="look-card-tags">${entry.styles.map((style)=>`<span class="tag">${esc(style)}</span>`).join("")}<span class="tag">${entry.items.length} item</span></div>${entry.excerpt ? `<p class="detail-description">${esc(entry.excerpt)}</p>` : ""}</div><div class="detail-actions">${lookLikeButton(entry)}${memberRetention.saveButton("look",entry.id)}<button class="button-outline icon-action" type="button" data-share-look="${esc(entry.id)}" aria-label="Bagikan look ${esc(entry.title)}" title="Bagikan look">${SHARE_ICON}</button></div><ol class="item-list" style="list-style:none;padding:0;margin:0">${itemsHtml}</ol><p class="price-note">Harga referensi saat kurasi. Warna, stok, dan harga akhir dapat berubah di marketplace.</p></div></div>`;
          if (!els.lookModal.open) els.lookModal.showModal();
        }
        function openProduct(id, { navigate = true, variantId = "", replace = false } = {}) {
          const entry = getProduct(id);
          if (!entry) return;
          void memberRetention.recordView("product", entry.id);
          const selectedVariant = entry.variants?.find((variant) => variant.id === variantId) || entry.variants?.[0] || null;
          if (navigate) { navigateToContent("product", entry, { variantId: selectedVariant?.id || "", replace }); renderDirectoryRoute(); }
          else updateClientMetadata({ type:"product", slug:contentEntitySlug(entry,"product"), variantId:selectedVariant?.id || "" }, entry);
          closeContentDialogs(els.productModal);
          const variants = (entry.variants || []).map((variant) => `<button class="product-variant-option${variant.id === selectedVariant?.id ? " is-selected" : ""}" type="button" data-select-product-variant="${esc(variant.id)}" aria-pressed="${String(variant.id === selectedVariant?.id)}"><span class="swatch" style="--swatch:${esc(variant.hex || "#ccc")}"></span>${esc(variant.name || "Warna pilihan")}</button>`).join("");
          const gender = ({ pria:"Pria", wanita:"Wanita", unisex:"Uniseks" })[String(entry.genderTarget || "").toLowerCase()] || "Uniseks";
          const relatedLooks=state.looks.filter((look)=>look.items?.some((item)=>item.productId===entry.id)).slice(0,4);
          const relatedLooksMarkup=relatedLooks.length ? `<section class="product-related-looks"><h3>Dipakai dalam kurasi</h3><div class="product-related-look-list">${relatedLooks.map((look)=>`<button class="product-related-look" type="button" data-open-product-look="${esc(look.id)}">${lookVisual(look)}<span class="product-related-look-copy"><span>${esc(lookAttribution(look))}</span><strong>${esc(look.title)}</strong></span></button>`).join("")}</div></section>` : "";
          els.productDetail.innerHTML = `<div class="product-detail"><div>${productArt(entry, selectedVariant)}</div><div><p class="eyebrow" style="color:var(--clay)">COMOOTD / ${esc(gender)}</p><h2>${esc(entry.name)}</h2>${entry.badge ? `<p class="eyebrow" style="color:var(--taupe)">${esc(entry.badge)}</p>` : ""}<p class="product-detail-price">${money(entry.price)}</p><div class="look-card-tags">${(entry.styles || []).map((style) => `<span class="tag">${esc(style)}</span>`).join("")}</div>${variants ? `<div class="product-variant-options" aria-label="Pilih warna">${variants}</div>` : ""}<div class="detail-actions">${marketplaceDestinationsMarkup(entry,{reportType:"product_link"})}${memberRetention.saveButton("product",entry.id)}<button class="button-outline" type="button" data-share-product="${esc(entry.id)}" data-share-variant="${esc(selectedVariant?.id || "")}">Bagikan</button></div><p class="price-note">Harga referensi saat kurasi. Warna, stok, dan harga akhir dapat berubah di marketplace.</p>${relatedLooksMarkup}</div></div>`;
          if (!els.productModal.open) els.productModal.showModal();
        }
        function articlePlainText(blocks) {
          return (blocks || []).filter((block) => block.type !== "image").map((block) => String(block.content || "").trim()).filter(Boolean).join("\n\n");
        }
        function articleBlockMarkup(block) {
          const type = String(block?.type || "paragraph");
          if (type === "image") {
            const image = safeImage(block.image || block.imageUrl);
            if (!image) return "";
            return `<figure class="article-block article-figure ${imageFrameClass(block.imageAspect || image, "portrait")}"><img src="${esc(image)}" alt="${esc(block.alt || "Foto artikel COMOOTD")}" />${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ""}</figure>`;
          }
          const content = String(block?.content || "").trim();
          if (!content) return "";
          if (type === "heading") {
            const tag = Number(block.level) === 3 ? "h4" : "h3";
            return `<section class="article-block"><${tag}>${esc(content)}</${tag}></section>`;
          }
          if (type === "quote") return `<blockquote class="article-block">${esc(content)}</blockquote>`;
          return `<p class="article-block">${esc(content)}</p>`;
        }
        function resolveArticleCta(cta) {
          if (!cta) return null;
          if (cta.type === "look") {
            const look = cta.look || state.looks.find((entry) => entry.id === cta.lookId);
            return look ? { ...cta, look } : null;
          }
          if (cta.type === "product") {
            const product = cta.product || state.products.find((entry) => entry.id === cta.productId);
            return product ? { ...cta, product } : null;
          }
          return null;
        }
        function articleCurationMarkup(article) {
          const ctas = (article.ctas || []).map(resolveArticleCta).filter(Boolean);
          if (!ctas.length) return "";
          const looks = ctas.filter((cta) => cta.type === "look");
          const products = ctas.filter((cta) => cta.type === "product");
          const lookMarkup = looks.length ? `<div class="article-related-looks">${looks.map((cta) => `<button class="article-related-look" type="button" data-open-article-look="${esc(cta.look.id)}"><strong>${esc(cta.label || defaultJournalCtaLabel("look"))}</strong><span>${esc(cta.look.title)} ↗</span></button>`).join("")}</div>` : "";
          const productMarkup = products.length ? `<div class="article-related-products">${products.map((cta) => { const product = cta.product; return `<article class="article-related-product"><button class="article-related-product-open" type="button" data-open-product="${esc(product.id)}">${productArt(product, product.variants?.[0], true)}<div><h4>${esc(product.name)}</h4><p class="microcopy" style="margin:.25rem 0 0;color:var(--taupe)">${money(product.price)}</p></div></button><a href="${esc(safeUrl(product.affiliateUrl))}" target="_blank" rel="sponsored noopener">${esc(cta.label || defaultJournalCtaLabel("product"))} ↗</a></article>`; }).join("")}</div>` : "";
          return `<section class="article-curation"><h3>Temukan kurasinya</h3>${lookMarkup}${productMarkup}</section>`;
        }
        function articleReadMinutes(article) {
          const text=[article?.excerpt,article?.body,...(article?.blocks||[]).map((block)=>block.content || block.alt || "")].join(" ").trim();
          const words=text ? text.split(/\s+/).length : 0;
          return Math.max(1,Math.ceil(words/210));
        }
        function articlePublishedLabel(article) {
          const date=article?.publishedAt ? new Date(article.publishedAt) : null;
          if(!date || Number.isNaN(date.getTime())) return "COMOOTD Journal";
          return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"long",year:"numeric"}).format(date);
        }
        function openArticle(id, { navigate = true } = {}) {
          const article=state.articles.find((entry)=>entry.id===id); if (!article) return;
          if (navigate) { navigateToContent("article", article); renderDirectoryRoute(); }
          else updateClientMetadata({ type:"article", slug:contentEntitySlug(article,"article") }, article);
          closeContentDialogs(els.articleModal);
          const cover = safeImage(article.coverImage);
          const blocks = Array.isArray(article.blocks) && article.blocks.length ? article.blocks.map(articleBlockMarkup).join("") : String(article.body || article.excerpt || "").split("\n\n").filter(Boolean).map((p)=>`<p class="article-block">${esc(p)}</p>`).join("");
          els.articleDetail.innerHTML=`<article class="editorial-article"><header class="editorial-article-head"><p class="eyebrow">COMOOTD JOURNAL / ${esc(articleCategoryLabel(article.category))}</p><h2>${esc(article.title)}</h2>${article.excerpt ? `<p class="article-lede">${esc(article.excerpt)}</p>` : ""}<div class="editorial-article-meta"><span>${esc(articlePublishedLabel(article))}</span><span>${articleReadMinutes(article)} menit baca</span><span>${esc((article.styles||[]).slice(0,3).join(" / ") || "Style notes")}</span></div><div class="detail-actions" style="margin:1.35rem 0 0"><button class="button-outline" type="button" data-share-article="${esc(article.id)}">Bagikan artikel ↗</button></div></header><div class="editorial-article-visual">${cover ? `<figure class="article-cover ${imageFrameClass(article.coverAspect || article.coverImage, "portrait")}"><img src="${esc(cover)}" alt="${esc(article.coverAlt || article.title)}" /></figure>` : `<div class="article-cover" aria-hidden="true"></div>`}</div><div class="editorial-article-main"><div class="article-content">${blocks}</div>${articleCurationMarkup(article)}<button class="button-outline" type="button" data-close-article style="margin-top:1.7rem">Tutup artikel</button></div></article>`;
          if (!els.articleModal.open) els.articleModal.showModal();
        }
        function showToast(message) { notification.show(message); }
        function closeStudio() { els.studioDrawer.classList.remove("is-open"); els.studioScrim.classList.remove("is-open"); els.studioDrawer.setAttribute("aria-hidden","true"); document.body.classList.remove("drawer-open"); }
        function openStudioDrawer() { els.studioDrawer.classList.add("is-open"); els.studioScrim.classList.add("is-open"); els.studioDrawer.setAttribute("aria-hidden","false"); document.body.classList.add("drawer-open"); headerNavigation.close(); }
        function openAuth() {
          els.authFormError.textContent = "";
          els.authEmail.value = cloud?.config?.adminEmail || "";
          els.authPassword.value = "";
          if (!els.authModal.open) els.authModal.showModal();
          setTimeout(() => els.authPassword.focus(), 0);
        }
        async function syncMemberSession({ quiet = true } = {}) {
          if (!cloudEnabled() || typeof cloud?.getMemberProfile !== "function") {
            memberViewer = null;
            memberRequests = [];
            memberNotifications = [];
            lookLikes.clear();
            cloudAdmin = false;
            updateMemberUi();
            return;
          }
          try {
            memberViewer = await cloud.getMemberProfile();
            if (memberIsSignedIn() && typeof cloud?.loadMyOutfitRequests === "function") memberRequests = await cloud.loadMyOutfitRequests();
            else memberRequests = [];
            if (memberIsSignedIn() && typeof cloud?.loadMyLookLikes === "function") lookLikes.replace(await cloud.loadMyLookLikes());
            else lookLikes.clear();
            if (memberIsSignedIn() && typeof cloud?.loadNotifications === "function") memberNotifications = await cloud.loadNotifications();
            else memberNotifications = [];
            await memberPrivacy?.hydrate?.(memberIsSignedIn());
            await memberRetention.hydrate();
            cloudAdmin = memberIsSignedIn() && typeof cloud?.isAdmin === "function" ? await cloud.isAdmin() : false;
            updateMemberUi();
            renderLooks();
            renderNewSeries();
            renderPersonalized();
            renderDirectoryRoute();
            if (memberIsSignedIn() && !els.memberProfileView.hidden) renderMemberProfile();
          } catch (error) {
            console.warn("Unable to load SISIP member session", error);
            memberViewer = null;
            memberRequests = [];
            memberNotifications = [];
            lookLikes.clear();
            await memberPrivacy?.hydrate?.(false);
            await memberRetention.hydrate();
            cloudAdmin = false;
            updateMemberUi();
            renderLooks();
            renderNewSeries();
            renderPersonalized();
            renderDirectoryRoute();
            if (!quiet) showToast("Profil COMOOTD belum dapat dimuat. Coba lagi sesaat lagi.");
          }
        }
        function openMemberAccount() {
          if (!cloudEnabled()) { showToast("Akun COMOOTD aktif saat katalog cloud terhubung."); return; }
          if (memberIsSignedIn()) {
            els.memberAuthView.hidden = true;
            els.memberProfileView.hidden = false;
            renderMemberProfile();
          } else {
            els.memberAuthView.hidden = false;
            els.memberProfileView.hidden = true;
            renderMemberAuth();
          }
          if (!els.memberModal.open) els.memberModal.showModal();
        }
        async function openStudio() {
          if (!cloudEnabled()) { updateStudioMode(); openStudioDrawer(); return; }
          try {
            cloudAdmin = await cloud.isAdmin();
            if (!cloudAdmin) { openAuth(); return; }
            const jobs=[refreshCloudState({ admin: true })];
            if(typeof cloud?.loadCuratorApplications === "function") jobs.push(cloud.loadCuratorApplications().then((items)=>{curatorApplications=items||[];}));
            await Promise.all(jobs);
            renderCuratorAdmin();
            updateStudioMode();
            openStudioDrawer();
          } catch (error) {
            console.warn("Unable to open SISIP Studio", error);
            showToast("Studio belum dapat dibuka. Coba masuk kembali.");
          }
        }
        function switchStudioTab(tab) {
          document.querySelectorAll("[data-studio-tab]").forEach((button)=>button.classList.toggle("is-active",button.dataset.studioTab===tab));
          document.querySelectorAll("[data-studio-panel]").forEach((panel)=>panel.classList.toggle("is-active",panel.dataset.studioPanel===tab));
        }
        async function saveNewSeries() {
          els.newSeriesError.textContent = "";
          const slotInputs = Array.from(els.newSeriesSlots.querySelectorAll("[data-new-series-slot]"));
          const slotIds = slotInputs.map((input) => String(input.value || "").trim());
          const lookIds = slotIds.filter(Boolean);
          if (slotIds.length !== 5) {
            els.newSeriesError.textContent = "New Series harus memiliki lima slot.";
            return;
          }
          if (new Set(lookIds).size !== lookIds.length) {
            els.newSeriesError.textContent = "Satu look hanya boleh dipakai sekali di New Series.";
            return;
          }
          const buttonLabel = els.saveNewSeriesButton.textContent;
          els.saveNewSeriesButton.disabled = true;
          els.saveNewSeriesButton.textContent = "Menyimpan…";
          try {
            if (cloudEnabled()) {
              await cloud.setNewSeries(slotIds);
              await refreshCloudState({ admin: true });
              showToast(lookIds.length ? `New Series diperbarui dengan ${lookIds.length} look.` : "Carousel New Series dikosongkan.");
              return;
            }
            state.newSeriesLookIds = lookIds;
            state.newSeriesSlots = slotIds.map((lookId, index) => ({ slot: index + 1, lookId }));
            state.newSeriesConfigured = true;
            newSeriesIndex = 0;
            saveState();
            renderAll();
            showToast(lookIds.length ? `New Series prototype diperbarui dengan ${lookIds.length} look.` : "Carousel prototype dikosongkan.");
          } catch (error) {
            els.newSeriesError.textContent = error.message || "New Series belum dapat disimpan.";
          } finally {
            els.saveNewSeriesButton.textContent = buttonLabel;
            els.saveNewSeriesButton.disabled = false;
          }
        }
        async function saveStylePreviews() {
          els.stylePreviewError.textContent="";
          const assignments=Array.from(els.stylePreviewSlots.querySelectorAll("[data-style-preview-tag]")).map((select)=>({
            tagId:String(select.dataset.stylePreviewTag||"").trim(),
            tagName:String(select.dataset.stylePreviewName||"").trim(),
            lookId:String(select.value||"").trim()
          }));
          if (!assignments.length) return;
          const label=els.saveStylePreviewsButton.textContent;
          els.saveStylePreviewsButton.disabled=true;
          els.saveStylePreviewsButton.textContent="Menyimpan…";
          try {
            if (cloudEnabled()) {
              if (typeof cloud?.setStylePreviews!=="function") throw new Error("Pengaturan preview style belum tersedia pada katalog cloud.");
              await cloud.setStylePreviews(assignments);
              await refreshCloudState({admin:true});
            } else {
              state.styleTags=(state.styleTags||[]).map((tag)=>{
                const assignment=assignments.find((item)=>item.tagId===String(tag?.id||tag?.name||tag));
                return assignment && typeof tag==="object" ? {...tag,previewLookId:assignment.lookId} : tag;
              });
              saveState(); renderAll();
            }
            showToast("Preview Match Your Vibe berhasil diperbarui.");
          } catch(error) {
            els.stylePreviewError.textContent=error?.message||"Preview style belum dapat disimpan.";
          } finally {
            els.saveStylePreviewsButton.textContent=label;
            els.saveStylePreviewsButton.disabled=false;
          }
        }
        async function saveStorefrontVisuals() {
          els.storefrontVisualError.textContent = "";
          const assignments = Object.keys(STOREFRONT_CARD_LABELS).map((cardKey) => {
            const slot = els.storefrontVisualSlots.querySelector(`[data-storefront-slot="${cardKey}"]`);
            const sourceValue = String(slot?.querySelector(`[data-storefront-source="${cardKey}"]`)?.value || "").trim();
            const imageFile = slot?.querySelector(`[data-storefront-file="${cardKey}"]`)?.files?.[0] || null;
            const mode = sourceValue === "__custom__" || imageFile ? "custom" : "catalogue";
            return {
              cardKey,
              mode,
              sourceId:mode === "catalogue" ? sourceValue : "",
              customImagePath:String(slot?.dataset.storefrontCurrent || "").trim(),
              imageFile,
              focalPosition:String(slot?.querySelector(`[data-storefront-focal="${cardKey}"]`)?.value || "center").trim()
            };
          });
          const label = els.saveStorefrontVisualsButton.textContent;
          els.saveStorefrontVisualsButton.disabled = true;
          els.saveStorefrontVisualsButton.textContent = "Menyimpan…";
          try {
            if (cloudEnabled()) {
              if (typeof cloud?.setStorefrontVisuals !== "function") throw new Error("Pengaturan visual homepage belum tersedia pada katalog cloud.");
              await cloud.setStorefrontVisuals(assignments);
              await refreshCloudState({ admin:true });
            } else {
              state.storefrontVisuals = assignments.map((assignment) => ({
                cardKey:assignment.cardKey,
                sourceId:assignment.sourceId,
                customImagePath:assignment.mode === "custom" ? assignment.customImagePath : "",
                customImage:assignment.mode === "custom" ? (assignment.imageFile ? URL.createObjectURL(assignment.imageFile) : storefrontVisualFor(assignment.cardKey).image) : "",
                focalPosition:assignment.focalPosition
              }));
              saveState();
              renderAll();
            }
            showToast("Visual pintu utama berhasil diperbarui.");
          } catch (error) {
            els.storefrontVisualError.textContent = error?.message || "Visual homepage belum dapat disimpan.";
          } finally {
            els.saveStorefrontVisualsButton.textContent = label;
            els.saveStorefrontVisualsButton.disabled = false;
          }
        }
        function addDraftItem() {
          const productId=els.lookProduct.value; const variantName=els.lookVariant.value; const productItem=getProduct(productId);
          if (!productItem || !variantName) return;
          if (lookDraftItems.length >= 5) { els.lookFormError.textContent="Satu look maksimal memiliki 5 item."; return; }
          const variant = getVariant(productItem,variantName);
          lookDraftItems.push({productId,variantId:variant?.id,variantName}); els.lookFormError.textContent=""; renderDraftItems();
        }
        function addJournalCta(type) {
          const input = type === "look" ? els.journalLookCtaInput : els.journalProductCtaInput;
          const entries = type === "look" ? journalDraftLookCtas : journalDraftProductCtas;
          const source = type === "look" ? state.looks : state.products;
          const id = String(input.value || "").trim();
          if (!id || !source.some((entry) => entry.id === id)) return;
          if (entries.length >= JOURNAL_CTA_LIMIT) { els.journalFormError.textContent = `Maksimal ${JOURNAL_CTA_LIMIT} ${type === "look" ? "look" : "produk"} terkait.`; return; }
          if (entries.some((entry) => entry.id === id)) return;
          entries.push({ id, label:defaultJournalCtaLabel(type) });
          els.journalFormError.textContent = "";
          input.value = "";
          renderJournalCuration();
        }
        function resetJournalDraft() {
          journalDraftBlocks = [makeJournalBlock("paragraph")];
          journalDraftLookCtas = [];
          journalDraftProductCtas = [];
          renderJournalStudio();
        }
        function validateJournalBlocks() {
          if (!journalDraftBlocks.length || journalDraftBlocks.length > JOURNAL_BLOCK_LIMIT) throw new Error(`Artikel dapat memiliki 1–${JOURNAL_BLOCK_LIMIT} blok.`);
          const limits = { paragraph:6000, heading:240, quote:800 };
          const prepared = journalDraftBlocks.map((block) => {
            const type = String(block.type || "");
            if (!["paragraph","heading","quote","image"].includes(type)) throw new Error("Jenis blok artikel belum sesuai.");
            if (type === "image") {
              const alt = String(block.alt || "").trim();
              if (!block.file) throw new Error("Pilih file untuk setiap blok foto.");
              if (!alt) throw new Error("Setiap foto artikel membutuhkan deskripsi.");
              return { type, file:block.file, imageAspect:imageAspect(block.imageAspect, "portrait"), alt:alt.slice(0,240), caption:String(block.caption || "").trim().slice(0,500) };
            }
            const content = String(block.content || "").trim();
            if (!content) throw new Error("Lengkapi atau hapus blok teks yang kosong.");
            if (content.length > limits[type]) throw new Error("Salah satu blok artikel melebihi batas karakter.");
            return { type, content, level:type === "heading" ? (Number(block.level) === 3 ? 3 : 2) : null };
          });
          if (!prepared.some((block) => block.type !== "image")) throw new Error("Tambahkan minimal satu blok teks agar artikel memiliki konteks.");
          return prepared;
        }
        function validateJournalCtas(type, entries) {
          const source = type === "look" ? state.looks : state.products;
          if (entries.length > JOURNAL_CTA_LIMIT) throw new Error(`Maksimal ${JOURNAL_CTA_LIMIT} ${type === "look" ? "look" : "produk"} terkait.`);
          return entries.map((entry) => {
            const item = source.find((candidate) => candidate.id === entry.id);
            if (!item || !isPublishedCatalogueEntry(item)) throw new Error(`Salah satu ${type === "look" ? "look" : "produk"} terkait belum published.`);
            return { id:item.id, label:(String(entry.label || "").trim() || defaultJournalCtaLabel(type)).slice(0,80) };
          });
        }
        async function readImage(input) {
          return readImageFile(preparedImageFile(input));
        }
        async function readImageFile(file) {
          if (!file) return "";
          if (file.size > 1.6 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 1.6 MB agar muat di prototype browser.");
          return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=()=>reject(new Error("Gambar tidak dapat dibaca.")); reader.readAsDataURL(file); });
        }
        function parseVariants(value) {
          return String(value).split(",").map((raw)=>raw.trim()).filter(Boolean).map((raw,index)=>{ const [name,hexInput] = raw.split("|").map((piece)=>piece.trim()); const hex=/^#[0-9a-fA-F]{3,8}$/.test(hexInput||"") ? hexInput : ["#DAD4CA","#514A44","#A9553C","#68736B"][index%4]; return {id:uid("variant"),name:name||`Warna ${index+1}`,hex}; });
        }
        const { parseTags, normalizeBulkHeader, parseCsvMatrix, matrixToImportRows, matrixToBulkRows, matrixToBulkLookRows, normalizeBulkImageUrl, normalizeBulkColorHex, normalizeBulkGender, parseBulkPrice, parseBulkTags, parseBulkBadge, validateBulkRows, validateBulkLookRows, affiliateUrlFromBulk, readBulkMatrix } = window.COMOOTDBulkImport.create({ STYLE_ORDER, PRODUCT_BADGE_OPTIONS, MARKETPLACES, PRODUCT_CATEGORIES, BULK_IMPORT_MAX_ROWS, BULK_IMPORT_MAX_PRODUCTS, BULK_LOOK_IMPORT_MAX_ROWS, BULK_LOOK_IMPORT_MAX_LOOKS, marketplaceFromUrl, affiliateUrl });
        function updateBulkImportButtons() {
          const productReady = cloudEnabled() && bulkImportGroups.length > 0 && bulkImportErrors.length === 0;
          els.bulkImportButton.disabled = !productReady;
          els.bulkImportButton.textContent = bulkImportGroups.length ? "Import " + bulkImportGroups.length + " produk" : "Import produk";
          const lookReady = cloudEnabled() && bulkLookImportGroups.length > 0 && bulkLookImportErrors.length === 0;
          els.bulkLookImportButton.disabled = !lookReady;
          els.bulkLookImportButton.textContent = bulkLookImportGroups.length ? "Import " + bulkLookImportGroups.length + " look" : "Import looks";
        }
        function renderBulkImportPreview() {
          const variantCount = bulkImportGroups.reduce((total, group) => total + group.variants.length, 0);
          const messages = [];
          if (bulkImportGroups.length) messages.push({ className: "", text: bulkImportGroups.length + " produk / " + variantCount + " warna siap ditinjau." });
          bulkImportWarnings.slice(0, 8).forEach((message) => messages.push({ className: "warning", text: message }));
          bulkImportErrors.slice(0, 8).forEach((message) => messages.push({ className: "invalid", text: message }));
          els.bulkImportPreview.hidden = !messages.length;
          els.bulkImportPreviewSummary.textContent = bulkImportErrors.length ? "Preview: ada " + bulkImportErrors.length + " masalah yang perlu diperbaiki" : "Preview: " + bulkImportGroups.length + " produk / " + variantCount + " warna";
          els.bulkImportPreviewList.innerHTML = messages.map((message) => "<li class=\"" + message.className + "\">" + esc(message.text) + "</li>").join("");
          els.bulkImportError.textContent = bulkImportErrors[0] || "";
          updateBulkImportButtons();
        }
        async function inspectBulkProductFile() {
          const file = els.bulkProductFile.files?.[0];
          bulkImportGroups = [];
          bulkImportErrors = [];
          bulkImportWarnings = [];
          if (!file) {
            els.bulkImportStatus.textContent = "Pilih file CSV atau Excel untuk melihat preview.";
            renderBulkImportPreview();
            return;
          }
          if (file.size > 5 * 1024 * 1024) {
            bulkImportErrors = ["Ukuran file maksimal 5 MB."];
            els.bulkImportStatus.textContent = "File terlalu besar untuk diproses di browser.";
            renderBulkImportPreview();
            return;
          }
          els.bulkImportStatus.textContent = "Membaca " + file.name + "…";
          try {
            const rows = matrixToBulkRows(await readBulkMatrix(file, "Produk"));
            const result = validateBulkRows(rows);
            bulkImportGroups = result.groups;
            bulkImportErrors = result.errors;
            bulkImportWarnings = result.warnings;
            els.bulkImportStatus.textContent = bulkImportErrors.length ? "Perbaiki baris yang ditandai, lalu upload ulang file." : file.name + " siap diimpor. Produk dengan product_key sama akan diperbarui.";
          } catch (error) {
            bulkImportErrors = [error.message || "File belum dapat dibaca."];
            els.bulkImportStatus.textContent = "File belum dapat diproses.";
          }
          renderBulkImportPreview();
        }
        function renderBulkLookImportPreview() {
          const itemCount = bulkLookImportGroups.reduce((total, group) => total + group.items.length, 0);
          const messages = [];
          if (bulkLookImportGroups.length) messages.push({ className: "", text: bulkLookImportGroups.length + " look / " + itemCount + " item siap ditinjau." });
          bulkLookImportWarnings.slice(0, 8).forEach((message) => messages.push({ className: "warning", text: message }));
          bulkLookImportErrors.slice(0, 8).forEach((message) => messages.push({ className: "invalid", text: message }));
          els.bulkLookImportPreview.hidden = !messages.length;
          els.bulkLookImportPreviewSummary.textContent = bulkLookImportErrors.length ? "Preview: ada " + bulkLookImportErrors.length + " masalah yang perlu diperbaiki" : "Preview: " + bulkLookImportGroups.length + " look / " + itemCount + " item";
          els.bulkLookImportPreviewList.innerHTML = messages.map((message) => "<li class=\"" + message.className + "\">" + esc(message.text) + "</li>").join("");
          els.bulkLookImportError.textContent = bulkLookImportErrors[0] || "";
          updateBulkImportButtons();
        }
        async function inspectBulkLookFile() {
          const file = els.bulkLookFile.files?.[0];
          bulkLookImportGroups = [];
          bulkLookImportErrors = [];
          bulkLookImportWarnings = [];
          if (!file) {
            els.bulkLookImportStatus.textContent = "Pilih file CSV atau Excel untuk melihat preview.";
            renderBulkLookImportPreview();
            return;
          }
          if (file.size > 5 * 1024 * 1024) {
            bulkLookImportErrors = ["Ukuran file maksimal 5 MB."];
            els.bulkLookImportStatus.textContent = "File terlalu besar untuk diproses di browser.";
            renderBulkLookImportPreview();
            return;
          }
          els.bulkLookImportStatus.textContent = "Membaca " + file.name + "…";
          try {
            const rows = matrixToBulkLookRows(await readBulkMatrix(file, "Looks"));
            const result = validateBulkLookRows(rows);
            bulkLookImportGroups = result.groups;
            bulkLookImportErrors = result.errors;
            bulkLookImportWarnings = result.warnings;
            els.bulkLookImportStatus.textContent = bulkLookImportErrors.length ? "Perbaiki baris yang ditandai, lalu upload ulang file." : file.name + " siap diimpor. Upload ulang dengan look_key sama akan memperbarui look yang belum dipakai di New Series, artikel, atau request outfit.";
          } catch (error) {
            bulkLookImportErrors = [error.message || "File belum dapat dibaca."];
            els.bulkLookImportStatus.textContent = "File belum dapat diproses.";
          }
          renderBulkLookImportPreview();
        }
        function downloadBulkCsvTemplate(headers, rows, filename) {
          const csvCell = (value) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
          const content = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
          const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
        }
        function downloadBulkTemplate() { downloadBulkCsvTemplate(BULK_IMPORT_HEADERS, BULK_IMPORT_TEMPLATE_ROWS, "sisip-template-produk.csv"); }
        function downloadBulkLookTemplate() { downloadBulkCsvTemplate(BULK_LOOK_IMPORT_HEADERS, BULK_LOOK_IMPORT_TEMPLATE_ROWS, "sisip-template-looks.csv"); }
        function setupImageCropperInputs() {
          const inputs = [
            [document.getElementById("lookCoverInput"), { defaultAspect:"portrait", label:"foto cover look" }],
            [document.getElementById("lookMedia2Input"), { defaultAspect:"portrait", label:"foto look kedua" }],
            [document.getElementById("lookMedia3Input"), { defaultAspect:"portrait", label:"foto look ketiga" }],
            [document.getElementById("journalCoverInput"), { defaultAspect:"portrait", label:"foto cover artikel" }],
            [document.getElementById("productImageInput"), { defaultAspect:"square", allowedAspects:["square"], label:"foto produk" }]
          ];
          inputs.forEach(([input, options]) => {
            bindImageCropper(input, options);
            input?.form?.addEventListener("reset", () => window.COMOOTDImageCropper?.clear?.(input));
          });
        }
        function setupStudioEnhancements() {
          setupLookGalleryInput();
          els.productColorSearch?.addEventListener("input",renderProductColorPicker);
          els.productColorOptions?.addEventListener("click",(event)=>{
            const button=event.target.closest("[data-product-color-value]"); if(!button)return;
            const option=[...els.productVariantsInput.options].find((item)=>item.value===button.dataset.productColorValue);
            if(!option)return; option.selected=!option.selected; renderProductColorPicker();
          });
          els.styleTaxonomyAddForm?.addEventListener("submit",async(event)=>{
            event.preventDefault(); els.styleTaxonomyError.textContent="";
            const name=normaliseStyleTag(els.styleTaxonomyNewName.value); if(!name)return;
            const button=event.currentTarget.querySelector("button[type=submit]"); button.disabled=true;
            try {
              if(cloudEnabled()) { await cloud.ensureStyleTag(name); await refreshCloudState({admin:true,quiet:true}); }
              else { state.styleTags.push({id:uid("style"),name,isActive:true,isExploreVisible:false,sortOrder:state.styleTags.length+1,previewLookId:""});saveState();renderAll(); }
              els.styleTaxonomyNewName.value=""; showToast(`Style ${name} ditambahkan.`);
            } catch(error){els.styleTaxonomyError.textContent=error?.message||"Style belum dapat ditambahkan.";}
            finally{button.disabled=false;}
          });
          els.styleTaxonomyList?.addEventListener("submit",async(event)=>{
            const form=event.target.closest("[data-style-taxonomy-row]"); if(!form)return; event.preventDefault(); els.styleTaxonomyError.textContent="";
            const id=form.dataset.styleTaxonomyRow; const name=normaliseStyleTag(form.elements.name.value);
            const payload={id,name,isActive:form.elements.isActive.checked,isExploreVisible:form.elements.isExploreVisible.checked,sortOrder:Number(form.elements.sortOrder.value)||0};
            if(!name){els.styleTaxonomyError.textContent="Nama style wajib diisi.";return;}
            const button=form.querySelector("button[type=submit]"); button.disabled=true;
            try {
              if(cloudEnabled()) { if(typeof cloud?.updateStyleTag!=="function")throw new Error("Pembaruan style belum tersedia."); await cloud.updateStyleTag(payload); await refreshCloudState({admin:true,quiet:true}); }
              else { const tag=state.styleTags.find((item)=>item?.id===id); if(tag)Object.assign(tag,payload);saveState();renderAll(); }
              showToast(`Style ${name} diperbarui.`);
            } catch(error){els.styleTaxonomyError.textContent=error?.message||"Style belum dapat diperbarui.";}
            finally{button.disabled=false;}
          });
        }

        document.getElementById("currentYear").textContent=new Date().getFullYear();
        setupImageCropperInputs();
        setupStudioEnhancements();
        setupTaxonomyPickers();
        updateStudioMode();
        renderAll();
        if (cloudEnabled()) {
          void refreshCloudState({ quiet: true });
          void syncMemberSession({ quiet: true });
          if (typeof cloud?.onAuthStateChange === "function") {
            cloud.onAuthStateChange(() => {
              window.setTimeout(() => { void syncMemberSession({ quiet: true }); }, 0);
            });
          }
        } else applyContentRoute({ notify: true });

        const authReturnUrl = new URL(window.location.href);
        const authReturnProvider = authReturnUrl.searchParams.get("auth");
        if (authReturnProvider === "google") {
          authReturnUrl.searchParams.delete("auth");
          window.history.replaceState({}, "", `${authReturnUrl.pathname}${authReturnUrl.search}${authReturnUrl.hash}`);
          window.setTimeout(async () => {
            await syncMemberSession({ quiet: false });
            if (memberIsSignedIn()) {
              openMemberAccount();
              showToast("Kamu sudah masuk dengan Google.");
            } else {
              openMemberAccount();
              els.memberAuthError.textContent="Google Login belum selesai. Coba kembali atau gunakan email.";
            }
          }, 350);
        }

        let lastPublicCloudRefresh = Date.now();
        function refreshPublicCatalogueWhenActive() {
          if (!cloudEnabled() || cloudAdmin || document.visibilityState === "hidden") return;
          if (els.studioDrawer?.classList.contains("is-open")) return;
          const now = Date.now();
          if (now - lastPublicCloudRefresh < 60000) return;
          lastPublicCloudRefresh = now;
          void refreshCloudState({ quiet: true });
        }
        window.addEventListener("focus", refreshPublicCatalogueWhenActive);
        window.addEventListener("pageshow", refreshPublicCatalogueWhenActive);
        document.addEventListener("visibilitychange", refreshPublicCatalogueWhenActive);
        window.addEventListener("comootd:open-retention-item", (event) => {
          const type = String(event.detail?.type || "");
          const id = String(event.detail?.id || "");
          if (!id || (type !== "look" && type !== "product")) return;
          if (els.memberModal.open) els.memberModal.close();
          if (type === "look") openLook(id); else openProduct(id);
        });

        els.search.addEventListener("input",()=>{ activeStyle="all"; renderStyleControls(); renderLooks(); });
        els.gender.addEventListener("change",renderLooks);
        els.style.addEventListener("change",()=>{ activeStyle="all"; renderStyleControls(); renderLooks(); });
        els.sort.addEventListener("change",renderLooks);
        els.newSeriesStage.addEventListener("click",(event)=>{ const button=event.target.closest("[data-open-look]"); if(button) openLook(button.dataset.openLook); });
        els.newSeriesPrev.addEventListener("click",()=>moveNewSeries(-1));
        els.newSeriesNext.addEventListener("click",()=>moveNewSeries(1));
        els.newSeriesDots.addEventListener("click",(event)=>{ const button=event.target.closest("[data-new-series-index]"); if(!button)return; newSeriesIndex=Number(button.dataset.newSeriesIndex)||0; renderNewSeries(); });
        els.newSeriesCarousel.addEventListener("pointerenter",stopNewSeriesAutoplay);
        els.newSeriesCarousel.addEventListener("pointerleave",startNewSeriesAutoplay);
        els.lookGrid.addEventListener("click",(event)=>{ const like=event.target.closest("[data-toggle-main-like]"); if(like){event.preventDefault();void toggleMainLookLike(like.dataset.toggleMainLike);return;} const button=event.target.closest("[data-open-look]"); if(button) openLook(button.dataset.openLook); const clear=event.target.closest("#clearFilterButton"); if(clear){ els.search.value="";els.gender.value="all";els.style.value="all";activeStyle="all";renderStyleControls();renderLooks(); } });
        document.addEventListener("click",(event)=>{
          const withinDirectory=event.target.closest("#catalogueRouteLayer"); if(!withinDirectory) return;
          const like=event.target.closest("[data-toggle-main-like]"); if(like){event.preventDefault();void toggleMainLookLike(like.dataset.toggleMainLike);return;}
          const look=event.target.closest("[data-open-look]"); if(look){event.preventDefault();openLook(look.dataset.openLook);return;}
          const product=event.target.closest("[data-open-product]"); if(product){event.preventDefault();openProduct(product.dataset.openProduct);return;}
          const article=event.target.closest("[data-open-article]"); if(article){event.preventDefault();openArticle(article.dataset.openArticle);return;}
          const link=event.target.closest("a[href]"); if(!link) return;
          const url=new URL(link.href,window.location.origin); if(url.origin!==window.location.origin) return;
          event.preventDefault(); history.pushState({},"",`${url.pathname}${url.search}`); applyContentRoute({notify:true}); ensureCatalogueRouteLayer().scrollTo({top:0,behavior:"auto"});
        });
        els.styleChips.addEventListener("click",(event)=>{ const button=event.target.closest("[data-style]"); if(!button)return; activeStyle=button.dataset.style; els.style.value="all"; renderStyleControls();renderLooks(); });
        els.moodList.addEventListener("click",(event)=>{
          const like=event.target.closest("[data-toggle-main-like]"); if(like){event.preventDefault();void toggleMainLookLike(like.dataset.toggleMainLike);return;}
          const look=event.target.closest("[data-open-look]"); if(look){openLook(look.dataset.openLook);return;}
          const button=event.target.closest("[data-mood-style]"); if(!button)return;
          activeMoodStyle=button.dataset.moodStyle; renderMoodList();
        });
        document.addEventListener("click",(event)=>{
          const control=event.target.closest("[data-discovery-move]");
          if(!control)return;
          moveDiscoveryRail(control.closest("[data-discovery-carousel]"),Number(control.dataset.discoveryMove)||1);
        });
        document.addEventListener("keydown",(event)=>{
          const rail=event.target.closest?.(".discovery-rail");
          if(!rail || (event.key!=="ArrowLeft" && event.key!=="ArrowRight"))return;
          event.preventDefault();
          moveDiscoveryRail(rail.closest("[data-discovery-carousel]"),event.key==="ArrowLeft"?-1:1);
        });
        window.addEventListener("resize",()=>requestAnimationFrame(syncDiscoveryRails),{passive:true});
        [document.getElementById("studioButton"),document.getElementById("mobileStudioButton")].forEach((button)=>button.addEventListener("click",openStudio));
        [els.accountButton, els.mobileAccountButton].forEach((button)=>button.addEventListener("click",()=>{
          headerNavigation.close();
          openMemberAccount();
        }));
        els.personalGrid.addEventListener("click",(event)=>{
          const button=event.target.closest("[data-open-member]"); if(button) openMemberAccount();
          const like=event.target.closest("[data-toggle-main-like]"); if(like){event.preventDefault();void toggleMainLookLike(like.dataset.toggleMainLike);return;}
          const look=event.target.closest("[data-open-look]"); if(look) openLook(look.dataset.openLook);
          const product=event.target.closest("[data-open-product]"); if(product) openProduct(product.dataset.openProduct);
        });
        els.popularGrid.addEventListener("click",(event)=>{ const product=event.target.closest("[data-open-product]"); if(product) openProduct(product.dataset.openProduct); });
        document.getElementById("closeStudioButton").addEventListener("click",closeStudio); els.studioScrim.addEventListener("click",closeStudio);
        document.getElementById("closeLookModal").addEventListener("click",closeContentView);
        document.getElementById("closeArticleModal").addEventListener("click",closeContentView);
        document.getElementById("closeProductModal").addEventListener("click",closeContentView);
        document.getElementById("closeAuthModal").addEventListener("click",()=>els.authModal.close());
        document.getElementById("closeMemberModal").addEventListener("click",()=>els.memberModal.close());
        els.authModal.addEventListener("click",(event)=>{ if(event.target===els.authModal)els.authModal.close(); });
        els.memberModal.addEventListener("click",(event)=>{ if(event.target===els.memberModal)els.memberModal.close(); });
        els.authForm.addEventListener("submit",async(event)=>{
          event.preventDefault();
          els.authFormError.textContent="";
          try {
            const form = new FormData(event.currentTarget);
            await cloud.signInAdmin(String(form.get("email")||"").trim(),String(form.get("password")||""));
            cloudAdmin=true;
            els.authModal.close();
            await syncMemberSession({ quiet: true });
            await openStudio();
            showToast("Masuk sebagai admin COMOOTD.");
          } catch(error) {
            els.authFormError.textContent=error.message||"Email atau password belum sesuai.";
          }
        });
        els.logoutStudioButton.addEventListener("click",async()=>{
          try {
            await cloud.signOut();
            cloudAdmin=false;
            closeStudio();
            updateStudioMode();
            await refreshCloudState({ quiet: true });
            await syncMemberSession({ quiet: true });
            showToast("Kamu sudah keluar dari COMOOTD Studio.");
          } catch(error) { showToast("Sesi belum dapat diakhiri. Coba lagi."); }
        });
        els.memberAuthSwitch.addEventListener("click",()=>{
          memberAuthentication.toggleMode();
        });
        els.memberAuthForm.addEventListener("submit",async(event)=>{
          event.preventDefault();
          els.memberAuthError.textContent="";
          const form=event.currentTarget;
          const submit=els.memberAuthSubmit;
          const originalLabel=submit.textContent;
          submit.disabled=true;
          try {
            const data=new FormData(form);
            const email=String(data.get("email")||"").trim();
            const password=String(data.get("password")||"");
            if(memberAuthentication.mode === "signup") {
              const result=await cloud.signUpMember({email,password,displayName:String(data.get("displayName")||"").trim()});
              if(result?.needsEmailConfirmation) {
                memberAuthentication.setPendingEmail(email);
                renderMemberAuth();
                els.memberAuthError.textContent=result?.possiblyExistingAccount
                  ? "Jika email ini sudah pernah terdaftar, masuk dengan password yang sudah ada. Jika baru mendaftar, cek inbox, Spam, atau Promosi untuk email konfirmasi COMOOTD."
                  : "Cek inbox, Spam, atau Promosi untuk email konfirmasi COMOOTD. Link hanya dapat digunakan sekali; gunakan tombol kirim ulang setelah 60 detik bila belum masuk.";
                return;
              }
              showToast("Akun COMOOTD berhasil dibuat.");
            } else {
              await cloud.signInMember(email,password);
              showToast("Kamu sudah masuk ke profil COMOOTD.");
            }
            form.reset();
            await syncMemberSession({ quiet:false });
            openMemberAccount();
          } catch(error) {
            els.memberAuthError.textContent=error.message||"Akun belum dapat diproses. Coba lagi.";
          } finally {
            submit.disabled=false;
            submit.textContent=originalLabel;
          }
        });
        els.memberResendConfirmation.addEventListener("click",async()=>{
          const email=memberAuthentication.pendingEmail||String(new FormData(els.memberAuthForm).get("email")||"").trim();
          if(resendConfirmationInFlight || resendConfirmationSecondsLeft() > 0) { renderMemberResendControl(); return; }
          resendConfirmationInFlight=true;
          renderMemberResendControl();
          try {
            if(!email) throw new Error("Masukkan email yang dipakai saat daftar terlebih dahulu.");
            if(typeof cloud.resendMemberConfirmation!=="function") throw new Error("Fitur kirim ulang belum siap. Muat ulang halaman lalu coba lagi.");
            await cloud.resendMemberConfirmation(email);
            memberAuthentication.setPendingEmail(email);
            resendConfirmationCooldownUntil=Date.now()+60000;
            els.memberAuthError.textContent="Permintaan email konfirmasi sudah diproses. Jika email masuk, gunakan link terbaru saja.";
          } catch(error) {
            els.memberAuthError.textContent=error.message||"Email konfirmasi belum dapat dikirim ulang.";
          } finally {
            resendConfirmationInFlight=false;
            renderMemberResendControl();
          }
        });
        els.memberProfileForm.addEventListener("click",(event)=>{
          const button=event.target.closest("[data-member-profile-tag]");
          if(!button || button.disabled) return;
          const name=String(button.dataset.memberProfileTag||"");
          const value=memberTerm(button.dataset.memberProfileValue);
          if(!MEMBER_PROFILE_TAG_FIELDS[name] || !value) return;
          const selected=memberProfileTagState[name]||[];
          if(selected.includes(value)) {
            memberProfileTagState[name]=selected.filter((tag)=>tag!==value);
          } else if(selected.length >= MEMBER_PROFILE_TAG_LIMIT) {
            els.memberProfileError.textContent=`Maksimal ${MEMBER_PROFILE_TAG_LIMIT} pilihan untuk ${MEMBER_PROFILE_TAG_FIELDS[name].label}.`;
            return;
          } else {
            memberProfileTagState[name]=[...selected,value];
          }
          els.memberProfileError.textContent="";
          renderMemberProfileTagPicker(name);
        });
        els.memberProfileForm.addEventListener("submit",async(event)=>{
          event.preventDefault();
          els.memberProfileError.textContent="";
          const form=event.currentTarget;
          const submit=form.querySelector("button[type='submit']");
          const originalLabel=submit?.textContent||"Simpan preferensi";
          if(submit) { submit.disabled=true; submit.textContent="Menyimpan…"; }
          try {
            const data=new FormData(form);
            const budgetMin=memberIdr(data.get("budgetMin"));
            const budgetMax=memberIdr(data.get("budgetMax"));
            if(budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) throw new Error("Budget maksimum tidak boleh lebih kecil dari budget minimum.");
            await cloud.saveMemberProfile({
              displayName:String(data.get("displayName")||"").trim(),
              genderTarget:String(data.get("genderTarget")||"").trim(),
              styleTags:memberProfileTags(data.get("styleTags")),
              budgetMin,
              budgetMax,
              onboardingCompleted:true
            });
            await syncMemberSession({ quiet:false });
            renderMemberProfile();
            showToast("Preferensi gayamu sudah disimpan.");
          } catch(error) {
            els.memberProfileError.textContent=error.message||"Preferensi belum dapat disimpan.";
          } finally {
            if(submit) { submit.disabled=false; submit.textContent=originalLabel; }
          }
        });
        els.memberSignOutButton.addEventListener("click",async()=>{
          try {
            await cloud.signOut();
            memberViewer=null;
            memberRequests=[];
            cloudAdmin=false;
            els.memberModal.close();
            await refreshCloudState({ quiet:true });
            await syncMemberSession({ quiet:true });
            showToast("Kamu sudah keluar dari profil COMOOTD.");
          } catch(error) { showToast("Sesi belum dapat diakhiri. Coba lagi."); }
        });
        els.memberRequestList.addEventListener("click",(event)=>{
          const button=event.target.closest("[data-member-open-look]");
          if(!button) return;
          els.memberModal.close();
          openLook(button.dataset.memberOpenLook);
        });
        els.lookModal.addEventListener("click",(event)=>{
          if(event.target===els.lookModal){closeContentView();return;}
          const like=event.target.closest("[data-toggle-main-like]"); if(like){void toggleMainLookLike(like.dataset.toggleMainLike);return;}
          const share=event.target.closest("[data-share-look]"); if(share){void shareEntity("look",share.dataset.shareLook);return;}
          const product=event.target.closest("[data-open-product]"); if(product) openProduct(product.dataset.openProduct);
        });
        els.articleModal.addEventListener("click",(event)=>{
          if(event.target===els.articleModal){closeContentView();return;}
          const close=event.target.closest("[data-close-article]"); if(close){closeContentView();return;}
          const share=event.target.closest("[data-share-article]"); if(share){void shareEntity("article",share.dataset.shareArticle);return;}
          const look=event.target.closest("[data-open-article-look]"); if(look){openLook(look.dataset.openArticleLook);return;}
          const product=event.target.closest("[data-open-product]"); if(product) openProduct(product.dataset.openProduct);
        });
        els.productModal.addEventListener("click",(event)=>{
          if(event.target===els.productModal){closeContentView();return;}
          const share=event.target.closest("[data-share-product]"); if(share){void shareEntity("product",share.dataset.shareProduct,{variantId:share.dataset.shareVariant||""});return;}
          const relatedLook=event.target.closest("[data-open-product-look]"); if(relatedLook){openLook(relatedLook.dataset.openProductLook);return;}
          const variant=event.target.closest("[data-select-product-variant]");
          if(variant){const route=readContentRoute(); const product=route?.type==="product"?contentEntryForRoute(route):null; if(product) openProduct(product.id,{variantId:variant.dataset.selectProductVariant,replace:true});}
        });
        document.getElementById("journalGrid").addEventListener("click",(event)=>{ const button=event.target.closest("[data-open-article]"); if(button)openArticle(button.dataset.openArticle); });
        [els.lookModal,els.articleModal,els.productModal].forEach((dialog)=>dialog.addEventListener("close",()=>{ if(!contentRouteSyncing&&readContentRoute()){window.history.replaceState({},"",contentReturnPath());applyContentRoute();} }));
        window.addEventListener("popstate",()=>applyContentRoute({notify:true}));
        window.addEventListener("comootd:like-change",(event)=>{
          const detail=event?.detail || {};
          if (detail.source === "main" || !detail.lookId) return;
          const lookId=String(detail.lookId);
          lookLikes.applyExternal(lookId,Boolean(detail.liked));
          const entry=getLook(lookId);
          if (entry) entry.popularity=Math.max(0,Number(entry.popularity||0)+Number(detail.delta||0));
          renderLooks(); renderNewSeries(); renderPersonalized(); renderDirectoryRoute();
          if (els.lookModal.open && entry) openLook(lookId,{navigate:false});
        });
        document.getElementById("markAllNotificationsRead").addEventListener("click",async(event)=>{
          const button=event.currentTarget;
          button.disabled=true;
          try {
            await cloud.markNotificationRead();
            memberNotifications=await cloud.loadNotifications();
            renderMemberNotifications();
          } catch(error) { showToast(error?.message||"Notifikasi belum dapat diperbarui."); }
          finally { button.disabled=false; }
        });
        els.memberGoogleAuthButton.addEventListener("click",async()=>{
          els.memberAuthError.textContent="";
          const button=els.memberGoogleAuthButton;
          const originalLabel=button.innerHTML;
          button.disabled=true;
          button.querySelector("span").textContent="Menghubungkan ke Google…";
          try {
            await cloud.signInWithGoogle();
          } catch(error) {
            button.disabled=false;
            button.innerHTML=originalLabel;
            els.memberAuthError.textContent=error.message||"Google Login belum dapat dimulai. Coba lagi.";
          }
        });
        document.querySelectorAll("[data-studio-tab]").forEach((button)=>button.addEventListener("click",()=>switchStudioTab(button.dataset.studioTab)));
        els.saveStylePreviewsButton.addEventListener("click",()=>void saveStylePreviews());
        els.saveStorefrontVisualsButton.addEventListener("click",()=>void saveStorefrontVisuals());
        els.storefrontVisualSlots.addEventListener("change",(event)=>{
          const input=event.target.closest("[data-storefront-file]");
          if(!input?.files?.length)return;
          const key=String(input.dataset.storefrontFile||"");
          const source=els.storefrontVisualSlots.querySelector(`[data-storefront-source="${key}"]`);
          if(source)source.value="__custom__";
        });
        document.querySelectorAll("[data-add-journal-block]").forEach((button)=>button.addEventListener("click",()=>{ if(journalDraftBlocks.length>=JOURNAL_BLOCK_LIMIT){els.journalFormError.textContent=`Artikel maksimal memiliki ${JOURNAL_BLOCK_LIMIT} blok.`;return;} journalDraftBlocks.push(makeJournalBlock(button.dataset.addJournalBlock));els.journalFormError.textContent="";renderJournalBlockEditor(); }));
        els.saveNewSeriesButton.addEventListener("click",saveNewSeries);
        els.lookProduct.addEventListener("change",renderVariantSelect);
        document.getElementById("addLookItemButton").addEventListener("click",addDraftItem);
        els.lookDraftItems.addEventListener("click",(event)=>{ const button=event.target.closest("[data-remove-draft]");if(!button)return;lookDraftItems.splice(Number(button.dataset.removeDraft),1);renderDraftItems(); });
        els.cancelLookEditButton.addEventListener("click",resetLookEditor);
        els.cancelProductEditButton.addEventListener("click",resetProductEditor);
        els.studioLooksSearch.addEventListener("input",(event)=>{
          const value=event.target.value;
          clearTimeout(studioLibrarySearchTimers.looks);
          studioLibrarySearchTimers.looks=setTimeout(()=>{studioLibraryFilters.looks=value;studioLibraryLimits.looks=100;renderStudioLibraries();},170);
        });
        els.studioProductsSearch.addEventListener("input",(event)=>{
          const value=event.target.value;
          clearTimeout(studioLibrarySearchTimers.products);
          studioLibrarySearchTimers.products=setTimeout(()=>{studioLibraryFilters.products=value;studioLibraryLimits.products=100;renderStudioLibraries();},170);
        });
        els.loadMoreStudioLooks.addEventListener("click",()=>{studioLibraryLimits.looks+=100;renderStudioLibraries();});
        els.loadMoreStudioProducts.addEventListener("click",()=>{studioLibraryLimits.products+=100;renderStudioLibraries();});
        document.getElementById("studioCuratorsList").addEventListener("click",async(event)=>{
          const button=event.target.closest("[data-save-curator-access]");
          if(!button || !cloudEnabled() || !cloudAdmin) return;
          const row=button.closest("[data-curator-admin-row]");
          const userId=String(row?.dataset.curatorAdminId||"").trim();
          const active=Boolean(row?.querySelector("[data-curator-active]")?.checked);
          const trustLevel=String(row?.querySelector("[data-curator-trust]")?.value||"emerging");
          const limit=Number(row?.querySelector("[data-curator-limit]")?.value);
          if(!userId || !Number.isInteger(limit) || limit<0 || limit>1000) {
            showToast("Limit Curator harus berupa angka antara 0 dan 1000.");
            return;
          }
          const originalLabel=button.textContent;
          button.disabled=true;
          button.textContent="Menyimpan…";
          try {
            await cloud.setCuratorAccess({userId,isActive:active,activeLookLimit:limit,trustLevel});
            await refreshCloudState({admin:true});
            showToast(active?"Akses dan limit Curator disimpan.":"Akun Curator dinonaktifkan.");
          } catch(error) {
            showToast(error?.message||"Pengaturan Curator belum dapat disimpan.");
          } finally {
            if(document.body.contains(button)) { button.disabled=false; button.textContent=originalLabel; }
          }
        });
        document.getElementById("studioCuratorApplicationsList").addEventListener("click",async(event)=>{
          const button=event.target.closest("[data-review-curator-application]");
          if(!button || !cloudEnabled() || !cloudAdmin) return;
          const card=button.closest("[data-curator-application-id]");
          const applicationId=String(card?.dataset.curatorApplicationId||"");
          const decision=String(button.dataset.reviewCuratorApplication||"");
          const adminNote=String(card?.querySelector("[data-application-note]")?.value||"").trim();
          const trustLevel=String(card?.querySelector("[data-application-trust]")?.value||"emerging");
          const activeLookLimit=Number(card?.querySelector("[data-application-limit]")?.value||30);
          if(decision==="rejected" && adminNote.length<10) { showToast("Tambahkan alasan penolakan agar pemohon tahu apa yang perlu diperbaiki."); return; }
          button.disabled=true;
          const original=button.textContent;
          button.textContent="Memproses…";
          try {
            await cloud.reviewCuratorApplication({applicationId,decision,adminNote,trustLevel,activeLookLimit});
            const [applications]=await Promise.all([cloud.loadCuratorApplications(),refreshCloudState({admin:true})]);
            curatorApplications=applications||[];
            renderCuratorAdmin();
            showToast(decision==="approved"?"Pengajuan disetujui dan akses Curator aktif.":"Keputusan sudah dikirim ke pemohon.");
          } catch(error) {
            showToast(error?.message||"Pengajuan belum dapat diproses.");
            if(document.body.contains(button)) { button.disabled=false; button.textContent=original; }
          }
        });
        els.journalBlocks.addEventListener("click",(event)=>{ const button=event.target.closest("[data-remove-journal-block]"); if(!button)return; journalDraftBlocks.splice(Number(button.dataset.removeJournalBlock),1); renderJournalBlockEditor(); });
        els.journalBlocks.addEventListener("input",(event)=>{
          const target=event.target; const contentIndex=Number(target.dataset?.journalBlockContent); const altIndex=Number(target.dataset?.journalBlockAlt); const captionIndex=Number(target.dataset?.journalBlockCaption);
          if(Number.isInteger(contentIndex) && journalDraftBlocks[contentIndex]) journalDraftBlocks[contentIndex].content=target.value;
          if(Number.isInteger(altIndex) && journalDraftBlocks[altIndex]) journalDraftBlocks[altIndex].alt=target.value;
          if(Number.isInteger(captionIndex) && journalDraftBlocks[captionIndex]) journalDraftBlocks[captionIndex].caption=target.value;
        });
        els.journalBlocks.addEventListener("comootd:image-ready",(event)=>{
          const target=event.target; const fileIndex=Number(target.dataset?.journalBlockFile);
          if(!Number.isInteger(fileIndex) || !journalDraftBlocks[fileIndex]) return;
          const file=event.detail?.file || null;
          journalDraftBlocks[fileIndex].file=file;
          journalDraftBlocks[fileIndex].fileName=file?.name || "";
          journalDraftBlocks[fileIndex].imageAspect=imageAspect(event.detail?.aspect, "portrait");
          renderJournalBlockEditor();
        });
        els.journalBlocks.addEventListener("change",(event)=>{
          const target=event.target; const levelIndex=Number(target.dataset?.journalBlockLevel); const fileIndex=Number(target.dataset?.journalBlockFile);
          if(Number.isInteger(levelIndex) && journalDraftBlocks[levelIndex]) journalDraftBlocks[levelIndex].level=Number(target.value)===3?3:2;
          if(Number.isInteger(fileIndex) && journalDraftBlocks[fileIndex]) return;
        });
        els.addJournalLookCtaButton.addEventListener("click",()=>addJournalCta("look"));
        els.addJournalProductCtaButton.addEventListener("click",()=>addJournalCta("product"));
        els.journalLookCtas.addEventListener("click",(event)=>{const button=event.target.closest("[data-remove-journal-look-cta]");if(!button)return;journalDraftLookCtas.splice(Number(button.dataset.removeJournalLookCta),1);renderJournalCuration();});
        els.journalProductCtas.addEventListener("click",(event)=>{const button=event.target.closest("[data-remove-journal-product-cta]");if(!button)return;journalDraftProductCtas.splice(Number(button.dataset.removeJournalProductCta),1);renderJournalCuration();});
        els.journalLookCtas.addEventListener("input",(event)=>{const index=Number(event.target.dataset?.journalLookCtaLabel);if(Number.isInteger(index)&&journalDraftLookCtas[index])journalDraftLookCtas[index].label=event.target.value;});
        els.journalProductCtas.addEventListener("input",(event)=>{const index=Number(event.target.dataset?.journalProductCtaLabel);if(Number.isInteger(index)&&journalDraftProductCtas[index])journalDraftProductCtas[index].label=event.target.value;});
        els.studioLooksList.addEventListener("click",async(event)=>{
          const editButton=event.target.closest("[data-edit-look]");
          if(editButton){startLookEdit(getLook(editButton.dataset.editLook));return;}
          const button=event.target.closest("[data-delete-look]"); if(!button)return;
          const entry=state.looks.find((item)=>item.id===button.dataset.deleteLook); if(!entry)return;
          const location=cloudEnabled()?"cloud COMOOTD":"prototype ini";
          const isInNewSeries=getNewSeriesLookIds().includes(entry.id);
          const seriesNote=isInNewSeries?" Look ini juga akan dilepas dari New Series.":"";
          if(!confirm(`Hapus look “${entry.title}” dari ${location}?${seriesNote}`))return;
          try {
            if(cloudEnabled()) { await cloud.deleteLook(entry.id); if(editingLookId===entry.id)resetLookEditor(); await refreshCloudState({admin:true}); showToast(isInNewSeries?"Look dihapus dan dilepas dari New Series.":"Look dihapus dari cloud."); return; }
            if(editingLookId===entry.id)resetLookEditor();
            state.looks=state.looks.filter((item)=>item.id!==entry.id); state.newSeriesLookIds=(state.newSeriesLookIds||[]).filter((id)=>id!==entry.id); state.newSeriesSlots=(state.newSeriesSlots||[]).map((slot)=>({...slot,lookId:slot.lookId===entry.id?"":slot.lookId})); saveState(); renderAll(); showToast("Look dihapus dari prototype.");
          } catch(error) { const message=String(error?.message||""); if(message.includes("new_series_slots_look_id_fkey")){switchStudioTab("series");showToast("Look ini masih tampil di New Series. Kosongkan slotnya lalu simpan carousel.");return;} showToast(error.message||"Look belum dapat dihapus."); }
        });
        els.studioProductsList.addEventListener("click",async(event)=>{
          const editButton=event.target.closest("[data-edit-product]");
          if(editButton){startProductEdit(getProduct(editButton.dataset.editProduct));return;}
          const button=event.target.closest("[data-delete-product]"); if(!button)return;
          const item=getProduct(button.dataset.deleteProduct); if(!item)return;
          const usedIn=getProductUsage(item.id);
          if(cloudEnabled()) {
            if(!confirm(`Hapus produk “${item.name}” dari cloud? Produk yang masih dipakai di look akan ditolak demi menjaga katalog.`))return;
            try { await cloud.deleteProduct(item.id); if(editingProductId===item.id)resetProductEditor(); await refreshCloudState({admin:true}); showToast("Produk dihapus dari cloud."); }
            catch(error) { showToast("Produk ini masih dipakai oleh look, atau belum dapat dihapus."); }
            return;
          }
          const detail=usedIn.length?` Produk ini dipakai di ${usedIn.length} look; item terkait juga akan hilang dari look tersebut.`:"";
          if(confirm(`Hapus produk “${item.name}”?${detail}`)){if(editingProductId===item.id)resetProductEditor();state.products=state.products.filter((productItem)=>productItem.id!==item.id);state.looks=state.looks.map((entry)=>({...entry,items:entry.items.filter((lookItem)=>lookItem.productId!==item.id)})).filter((entry)=>entry.items.length>=2);state.newSeriesLookIds=(state.newSeriesLookIds||[]).filter((id)=>state.looks.some((entry)=>entry.id===id));saveState();renderAll();showToast("Produk dan referensi terkait berhasil dihapus.");}
        });
        els.studioRequestsList.addEventListener("input",(event)=>{
          const form=event.target.closest("[data-admin-request-form]"); if(form) syncRequestDraft(form);
        });
        els.studioRequestsList.addEventListener("change",(event)=>{
          const form=event.target.closest("[data-admin-request-form]"); if(form) syncRequestDraft(form);
        });
        els.studioRequestsList.addEventListener("click",async(event)=>{
          const add=event.target.closest("[data-add-request-rec]");
          if(add) {
            const id=String(add.dataset.addRequestRec||"");
            const type=String(add.dataset.requestRecType||"");
            const form=add.closest("[data-admin-request-form]");
            if(!id || !form || (type!=="look" && type!=="product")) return;
            syncRequestDraft(form);
            const selector=type === "look" ? `[data-request-look-select="${id}"]` : `[data-request-product-select="${id}"]`;
            const select=form.querySelector(selector);
            const targetId=String(select?.value||"").trim();
            const formError=form.querySelector("[data-request-error]");
            if(!targetId) { if(formError) formError.textContent=`Pilih ${type === "look" ? "look" : "produk"} terlebih dahulu.`; return; }
            const draft=getRequestDraft({id});
            if(draft.recommendations.length >= 6) { if(formError) formError.textContent="Maksimal enam rekomendasi per request."; return; }
            if(draft.recommendations.some((item)=>item.type===type && item.targetId===targetId)) { if(formError) formError.textContent="Pilihan ini sudah masuk ke jawaban."; return; }
            draft.recommendations.push({type,targetId,label:type === "look" ? "Lihat look" : "Lihat produk"});
            if(formError) formError.textContent="";
            renderRequestsStudio();
            return;
          }
          const remove=event.target.closest("[data-remove-request-rec]");
          if(remove) {
            const id=String(remove.dataset.removeRequestRec||"");
            const index=Number(remove.dataset.requestRecIndex);
            const form=remove.closest("[data-admin-request-form]");
            if(form) syncRequestDraft(form);
            const draft=getRequestDraft({id});
            if(Number.isInteger(index) && index>=0) draft.recommendations.splice(index,1);
            renderRequestsStudio();
            return;
          }
          const save=event.target.closest("[data-save-request]");
          if(!save) return;
          const id=String(save.dataset.saveRequest||"");
          const form=save.closest("[data-admin-request-form]");
          if(!id || !form) return;
          syncRequestDraft(form);
          const draft=getRequestDraft({id});
          const formError=form.querySelector("[data-request-error]");
          if(formError) formError.textContent="";
          const originalLabel=save.textContent;
          save.disabled=true;
          save.textContent="Menyimpan…";
          try {
            await cloud.updateOutfitRequest({ id, status:draft.status, responseMessage:draft.responseMessage, adminNote:draft.adminNote, recommendations:draft.recommendations });
            requestDrafts.delete(id);
            await refreshCloudState({ admin:true });
            await syncMemberSession({ quiet:true });
            showToast("Jawaban request telah disimpan.");
          } catch(error) {
            if(formError) formError.textContent=error.message||"Jawaban request belum dapat disimpan.";
            save.disabled=false;
            save.textContent=originalLabel;
          }
        });
        els.studioArticlesList.addEventListener("click",async(event)=>{
          const button=event.target.closest("[data-delete-article]");if(!button)return;
          const article=state.articles.find((item)=>item.id===button.dataset.deleteArticle);if(!article)return;
          const location=cloudEnabled()?"cloud COMOOTD":"prototype ini";
          if(!confirm(`Hapus artikel “${article.title}” dari ${location}?`))return;
          try {
            if(cloudEnabled()) { if(typeof cloud?.deleteArticle!=="function") throw new Error("Fitur hapus artikel belum termuat. Muat ulang halaman lalu coba lagi."); const result=await cloud.deleteArticle(article.id); await refreshCloudState({admin:true}); showToast(result?.mediaCleanupWarning ? "Artikel sudah dihapus; satu file media perlu dibersihkan ulang nanti." : "Artikel dihapus dari cloud."); return; }
            state.articles=state.articles.filter((item)=>item.id!==article.id);saveState();renderAll();showToast("Artikel dihapus dari prototype.");
          } catch(error) { showToast(error.message||"Artikel belum dapat dihapus."); }
        });
        els.downloadBulkTemplateButton.addEventListener("click", downloadBulkTemplate);
        els.bulkProductFile.addEventListener("change", () => { void inspectBulkProductFile(); });
        els.bulkImportButton.addEventListener("click", async (event) => {
          if (!cloudEnabled()) { els.bulkImportError.textContent = "Import banyak hanya tersedia setelah Supabase cloud aktif."; return; }
          if (!bulkImportGroups.length || bulkImportErrors.length) return;
          if (typeof cloud?.importProducts !== "function") { els.bulkImportError.textContent = "Fitur import belum termuat. Muat ulang halaman lalu coba lagi."; return; }
          if (!confirm("Import " + bulkImportGroups.length + " produk ke cloud? product_key yang sudah ada akan diperbarui; warna yang tidak ada di file tidak akan dihapus.")) return;
          const button = event.currentTarget;
          button.disabled = true;
          els.bulkImportError.textContent = "";
          try {
            const result = await cloud.importProducts(bulkImportGroups, (progress) => {
              els.bulkImportStatus.textContent = "Mengimpor " + progress.index + " dari " + progress.total + ": " + progress.name + "…";
            });
            await refreshCloudState({ admin: true });
            if (result.failedCount) {
              bulkImportErrors = result.results.filter((item) => !item.ok).map((item) => item.name + ": " + item.error);
              els.bulkImportStatus.textContent = result.createdCount + " produk baru dan " + result.updatedCount + " produk diperbarui. " + result.failedCount + " produk perlu dicek.";
              renderBulkImportPreview();
              showToast("Sebagian import selesai; cek pesan error pada file.");
              return;
            }
            els.bulkProductFile.value = "";
            bulkImportGroups = [];
            bulkImportErrors = [];
            bulkImportWarnings = [];
            els.bulkImportPreview.hidden = true;
            els.bulkImportStatus.textContent = result.createdCount + " produk baru dan " + result.updatedCount + " produk diperbarui di cloud.";
            updateBulkImportButtons();
            showToast("Import produk ke cloud selesai.");
          } catch (error) {
            els.bulkImportError.textContent = error.message || "Import produk belum dapat dijalankan.";
            els.bulkImportStatus.textContent = "Import belum selesai. File tetap tersimpan untuk dicoba ulang.";
          } finally {
            updateBulkImportButtons();
          }
        });
        els.downloadBulkLookTemplateButton.addEventListener("click", downloadBulkLookTemplate);
        els.bulkLookFile.addEventListener("change", () => { void inspectBulkLookFile(); });
        els.bulkLookImportButton.addEventListener("click", async (event) => {
          if (!cloudEnabled()) { els.bulkLookImportError.textContent = "Import banyak hanya tersedia setelah Supabase cloud aktif."; return; }
          if (!bulkLookImportGroups.length || bulkLookImportErrors.length) return;
          if (typeof cloud?.importLooks !== "function") { els.bulkLookImportError.textContent = "Fitur import look belum termuat. Muat ulang halaman lalu coba lagi."; return; }
          if (!confirm("Import " + bulkLookImportGroups.length + " look ke cloud? look_key yang sama akan diperbarui selama belum dipakai di New Series, artikel, atau request outfit.")) return;
          const button = event.currentTarget;
          button.disabled = true;
          els.bulkLookImportError.textContent = "";
          try {
            const result = await cloud.importLooks(bulkLookImportGroups, (progress) => {
              els.bulkLookImportStatus.textContent = "Mengimpor " + progress.index + " dari " + progress.total + ": " + progress.name + "…";
            });
            await refreshCloudState({ admin: true });
            if (result.failedCount) {
              bulkLookImportErrors = result.results.filter((item) => !item.ok).map((item) => item.name + ": " + item.error);
              els.bulkLookImportStatus.textContent = result.createdCount + " look baru dan " + result.updatedCount + " look diperbarui. " + result.failedCount + " look perlu dicek.";
              renderBulkLookImportPreview();
              showToast("Sebagian import look selesai; cek pesan error pada file.");
              return;
            }
            els.bulkLookFile.value = "";
            bulkLookImportGroups = [];
            bulkLookImportErrors = [];
            bulkLookImportWarnings = [];
            els.bulkLookImportPreview.hidden = true;
            els.bulkLookImportStatus.textContent = result.createdCount + " look baru dan " + result.updatedCount + " look diperbarui di cloud.";
            updateBulkImportButtons();
            showToast("Import look ke cloud selesai.");
          } catch (error) {
            els.bulkLookImportError.textContent = error.message || "Import look belum dapat dijalankan.";
            els.bulkLookImportStatus.textContent = "Import belum selesai. File tetap tersimpan untuk dicoba ulang.";
          } finally {
            updateBulkImportButtons();
          }
        });

        els.journalForm.addEventListener("submit",async(event)=>{
          event.preventDefault();
          els.journalFormError.textContent="";
          const journalForm=event.currentTarget;
          const form=new FormData(journalForm);
          const title=String(form.get("title")||"").trim();
          const excerpt=String(form.get("excerpt")||"").trim();
          const category=String(form.get("category")||"editorial").trim();
          const styles=taxonomyValues(journalForm,"journalStyles");
          const journalCoverInput=document.getElementById("journalCoverInput");
          const coverFile=preparedImageFile(journalCoverInput);
          const coverAspect=selectedImageAspect(journalCoverInput,"portrait");
          const coverAlt=String(form.get("coverAlt")||"").trim();
          const submitButton=typeof journalForm.querySelector === "function" ? journalForm.querySelector("[data-journal-submit]") : null;
          const originalLabel=submitButton?.textContent || "Publikasikan artikel";
          try {
            if(!title || title.length>180 || !excerpt || excerpt.length>420) throw new Error("Isi judul dan ringkasan artikel terlebih dahulu.");
            if(!Object.prototype.hasOwnProperty.call(ARTICLE_CATEGORIES,category)) throw new Error("Pilih jenis artikel yang tersedia.");
            if(coverFile && !coverAlt) throw new Error("Tambahkan deskripsi foto cover agar tetap aksesibel.");
            const blocks=validateJournalBlocks();
            const lookCtas=validateJournalCtas("look",journalDraftLookCtas);
            const productCtas=validateJournalCtas("product",journalDraftProductCtas);
            if(submitButton){submitButton.disabled=true;submitButton.textContent="Mempublikasikan…";}
            if(cloudEnabled()) {
              if(typeof cloud?.createArticle!=="function") throw new Error("Fitur Journal belum termuat. Muat ulang halaman lalu coba lagi.");
              await cloud.createArticle({title,excerpt,category,styles,coverFile,coverAspect,coverAlt,blocks,lookCtas,productCtas});
              journalForm.reset();
              setTaxonomyValues(journalForm,"journalStyles",[]);
              resetJournalDraft();
              await refreshCloudState({admin:true});
              switchStudioTab("journal");
              showToast("Artikel Journal dipublikasikan ke cloud.");
              return;
            }
            const coverImage=await readImageFile(coverFile);
            const localBlocks=[];
            for(const block of blocks){
              if(block.type==="image") localBlocks.push({type:block.type,image:await readImageFile(block.file),imageAspect:block.imageAspect,alt:block.alt,caption:block.caption});
              else localBlocks.push({type:block.type,content:block.content,level:block.level});
            }
            const localLookCtas=lookCtas.map((cta,index)=>({id:uid("article-cta"),type:"look",lookId:cta.id,label:cta.label,position:index+1,look:state.looks.find((entry)=>entry.id===cta.id)}));
            const localProductCtas=productCtas.map((cta,index)=>({id:uid("article-cta"),type:"product",productId:cta.id,label:cta.label,position:localLookCtas.length+index+1,product:state.products.find((entry)=>entry.id===cta.id)}));
            const created={id:uid("article"),number:String(state.articles.length+1).padStart(2,"0"),title,excerpt,category,styles,coverImage,coverAspect,coverAlt,body:articlePlainText(localBlocks),blocks:localBlocks,ctas:[...localLookCtas,...localProductCtas],status:"published",publishedAt:new Date().toISOString()};
            state.articles.unshift(created);saveState();journalForm.reset();setTaxonomyValues(journalForm,"journalStyles",[]);resetJournalDraft();renderAll();switchStudioTab("journal");showToast("Artikel Journal tersimpan di browser ini.");
          } catch(error){els.journalFormError.textContent=error.message||"Artikel belum dapat dipublikasikan.";}
          finally {if(submitButton){submitButton.disabled=false;submitButton.textContent=originalLabel;}}
        });
        els.productForm.addEventListener("submit",async(event)=>{
          event.preventDefault();
          els.productFormError.textContent="";
          // `event.currentTarget` is cleared by the browser after an async boundary.
          // Preserve the form before any await so it can safely be reset on success.
          const productForm=event.currentTarget;
          const editId=editingProductId;
          const existingProduct=editId?getProduct(editId):null;
          if(editId&&!existingProduct){els.productFormError.textContent="Produk ini sudah tidak tersedia. Muat ulang Studio lalu coba lagi.";resetProductEditor();return;}
          const form=new FormData(productForm);
          const title=String(form.get("title")||"").trim();
          const price=Number(String(form.get("price")||"").replace(/[^0-9]/g,""));
          const variantSelect=productForm.elements.variants;
          const parsedVariants=parseVariants([...variantSelect.selectedOptions].map((option)=>option.value).join(","));
          const variants=editId?reconcileProductVariantIds(parsedVariants,existingProduct):parsedVariants;
          const secondaryRaw=String(form.get("secondaryLink")||"").trim();
          let link, marketplace, imageUrl, marketplaceLinks;
          try {
            link=affiliateUrl(form.get("link")); marketplace=marketplaceFromUrl(link); imageUrl=normalizeBulkImageUrl(form.get("imageUrl"));
            marketplaceLinks=[{marketplace,affiliateUrl:link,isPrimary:true,label:MARKETPLACES[marketplace]?.label||"Website"}];
            if(secondaryRaw){
              const secondaryLink=affiliateUrl(secondaryRaw); const secondaryMarketplace=marketplaceFromUrl(secondaryLink);
              if(secondaryMarketplace===marketplace) throw new Error("Link kedua harus memakai jenis platform yang berbeda.");
              marketplaceLinks.push({marketplace:secondaryMarketplace,affiliateUrl:secondaryLink,isPrimary:false,label:MARKETPLACES[secondaryMarketplace]?.label||"Website"});
              const preferred=marketplaceLinks.findIndex((destination)=>destination.marketplace!=="website");
              marketplaceLinks=marketplaceLinks.map((destination,index)=>({...destination,isPrimary:index===(preferred>=0?preferred:0)}));
              const primary=marketplaceLinks.find((destination)=>destination.isPrimary);
              link=primary.affiliateUrl; marketplace=primary.marketplace;
            }
          } catch(error) { els.productFormError.textContent=error.message; return; }
          if(!title || !price || variants.length===0){els.productFormError.textContent="Nama, harga, link, dan minimal satu varian warna wajib diisi.";return;}
          try {
            const badge=String(form.get("badge")||"").trim();
            const styles=taxonomyValues(productForm,"productStyles");
            const genderTarget=String(form.get("genderTarget")||"unisex");
            const category=String(form.get("category")||"other");
            const productImageInput=document.getElementById("productImageInput");
            const imageFile=preparedImageFile(productImageInput);
            const imageAspect=selectedImageAspect(productImageInput,"square");
            if(cloudEnabled()) {
              if(editId) await cloud.updateProduct(editId,{ title, price, badge, styles, genderTarget, category, marketplace, link, marketplaceLinks, variants, imageUrl, imageFile, imageAspect });
              else await cloud.createProduct({ title, price, badge, styles, genderTarget, category, marketplace, link, marketplaceLinks, variants, imageUrl, imageFile, imageAspect });
              resetProductEditor();
              await refreshCloudState({admin:true});
              switchStudioTab("products");
              showToast(editId?"Produk berhasil diperbarui di cloud.":"Produk baru tersimpan ke cloud.");
              return;
            }
            if(editId) assertLocalProductVariantSafety(existingProduct,variants);
            const uploadedImage=await readImage(document.getElementById("productImageInput"));
            const image=imageUrl || uploadedImage || existingProduct?.image || "";
            const suppliedImage=Boolean(imageUrl || uploadedImage);
            const localVariants=variants.map((variant)=>{const previous=existingProduct?.variants?.find((candidate)=>candidate.id===variant.id);return {...(previous||{}),id:variant.id||uid("variant"),name:variant.name,hex:variant.hex,image:suppliedImage ? image : previous?.image||image};});
            if(editId) {
              Object.assign(existingProduct,{name:title,price,badge,styles,genderTarget,category,affiliatePlatform:marketplace,affiliateUrl:link,marketplaceLinks,artBg:blendHex(variants[0].hex,"#e7e1da",.62),artInk:variants[0].hex,image,imageAspect:imageFile || imageUrl ? imageAspect : existingProduct.imageAspect,variants:localVariants});
              saveState();resetProductEditor();renderAll();switchStudioTab("products");showToast("Produk berhasil diperbarui di prototype.");
              return;
            }
            const created={id:uid("product"),name:title,price,badge,styles,genderTarget,category,affiliatePlatform:marketplace,affiliateUrl:link,marketplaceLinks,artBg:blendHex(variants[0].hex,"#e7e1da",.62),artInk:variants[0].hex,image,imageAspect,variants:localVariants};
            state.products.push(created);saveState();resetProductEditor();renderAll();switchStudioTab("products");showToast("Produk baru tersimpan di browser ini.");
          } catch(error){els.productFormError.textContent=error.message||"Produk belum dapat disimpan.";}
        });
        els.lookForm.addEventListener("submit",async(event)=>{
          event.preventDefault();els.lookFormError.textContent="";const lookForm=event.currentTarget;const form=new FormData(lookForm);const title=String(form.get("title")||"").trim();const excerpt=String(form.get("excerpt")||"").trim().slice(0,240);const styles=taxonomyValues(lookForm,"lookStyles");
          const editId=editingLookId;const existingLook=editId?getLook(editId):null;
          if(editId&&!existingLook){els.lookFormError.textContent="Look ini sudah tidak tersedia. Muat ulang Studio lalu coba lagi.";resetLookEditor();return;}
          if(lookDraftItems.length<2||lookDraftItems.length>5){els.lookFormError.textContent="Satu look harus berisi 2–5 item.";return;} if(!title||!styles.length){els.lookFormError.textContent="Nama look dan minimal satu style wajib diisi.";return;}
          try {
            const lookImageInputs=getLookImageInputs();
            const priorMedia=Array.isArray(existingLook?.media) ? existingLook.media : existingLook?.coverImage ? [{path:existingLook.coverImage,image:existingLook.coverImage,alt:existingLook.coverAlt||"",aspect:existingLook.coverAspect||"portrait"}] : [];
            const gallery=lookGallerySlotOrder.map((slot)=>{
              if(lookGalleryRemovedSlots.has(slot))return null;
              const input=lookImageInputs[slot]; const file=preparedImageFile(input); const previous=priorMedia[slot]||{};
              if(!file&&!previous?.path&&!previous?.image)return null;
              return {file,aspect:file?selectedImageAspect(input,"portrait"):imageAspect(previous.aspect||previous.path||previous.image,"portrait"),currentPath:previous.path||previous.image||"",path:previous.path||"",alt:previous.alt||""};
            }).filter(Boolean).map((entry,index)=>({...entry,sortOrder:index+1}));
            const explicitGallery=gallery.length?gallery:(editId&&lookGalleryRemovedSlots.size?[{sortOrder:1,currentPath:"",path:"",alt:""}]:[]);
            const galleryFiles=gallery.map((entry)=>entry.file||null);
            const coverFile=gallery[0]?.file||null;
            const coverAspect=gallery[0]?.aspect||"portrait";
            if(cloudEnabled()) {
              if(editId) await cloud.updateLook({id:editId,title,excerpt,gender:String(form.get("gender")),styles,tone:"carbon",items:clone(lookDraftItems),coverFile,coverAspect,galleryFiles,gallery:explicitGallery});
              else await cloud.createLook({title,excerpt,gender:String(form.get("gender")),styles,tone:"carbon",items:clone(lookDraftItems),coverFile,coverAspect,galleryFiles,gallery:explicitGallery});
              resetLookEditor();
              await refreshCloudState({admin:true});
              switchStudioTab("looks");
              showToast(editId?"Look berhasil diperbarui di cloud.":"Look baru dipublikasikan ke cloud.");
              return;
            }
            const localMedia=await Promise.all(lookGallerySlotOrder.map(async(slot)=>{if(lookGalleryRemovedSlots.has(slot))return null;const input=lookImageInputs[slot];const image=await readImage(input);const previous=priorMedia[slot]||{};return image ? {image,path:image,alt:"",aspect:selectedImageAspect(input,"portrait")} : previous?.image ? previous : null;}));
            const media=localMedia.filter(Boolean).slice(0,3);
            const coverImage=media[0]?.image||existingLook?.coverImage||"";
            if(editId) {
              Object.assign(existingLook,{title,excerpt,gender:String(form.get("gender")),styles,tone:"carbon",coverImage,coverAspect:media[0]?.aspect || existingLook.coverAspect,media,items:clone(lookDraftItems)});
              saveState();resetLookEditor();renderAll();switchStudioTab("looks");showToast("Look berhasil diperbarui di prototype.");
              return;
            }
            const created={id:uid("look"),title,excerpt,gender:String(form.get("gender")),styles,tone:"carbon",popularity:0,createdOrder:Math.max(0,...state.looks.map((item)=>Number(item.createdOrder)||0))+1,coverImage,coverAspect:media[0]?.aspect || coverAspect,media,items:clone(lookDraftItems)};
            state.looks.push(created);saveState();resetLookEditor();renderAll();switchStudioTab("looks");showToast("Look baru dipublikasikan di prototype.");
          } catch(error){els.lookFormError.textContent=error.message||"Look belum dapat disimpan.";}
        });
        els.requestForm.addEventListener("submit",async(event)=>{
          event.preventDefault();
          els.requestStatus.textContent="";
          if(!cloudEnabled()) { els.requestStatus.textContent="Request outfit aktif setelah katalog cloud COMOOTD terhubung."; return; }
          if(!memberIsSignedIn()) {
            els.requestStatus.textContent="Masuk atau buat akun COMOOTD terlebih dahulu untuk mengirim brief.";
            openMemberAccount();
            return;
          }
          const form=event.currentTarget;
          const data=new FormData(form);
          const budgetMin=memberIdr(data.get("budgetMin"));
          const budgetMax=memberIdr(data.get("budgetMax"));
          if(budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
            els.requestStatus.textContent="Budget maksimum tidak boleh lebih kecil dari budget minimum.";
            return;
          }
          const button=els.requestSubmitButton;
          const originalLabel=button.textContent;
          button.disabled=true;
          button.textContent="Mengirim…";
          try {
            await cloud.createOutfitRequest({
              occasion:String(data.get("occasion")||"").trim(),
              genderTarget:String(data.get("genderTarget")||"").trim(),
              styleTags:memberTags(data.get("styleTags")),
              preferredColors:memberTags(data.get("preferredColors")),
              budgetMin,
              budgetMax,
              message:String(data.get("message")||"").trim()
            });
            form.reset();
            prefillRequestForm();
            memberRequests=await cloud.loadMyOutfitRequests();
            updateMemberUi();
            els.requestStatus.textContent="Brief sudah masuk ke COMOOTD Studio. Kamu bisa melihat status dan jawabannya dari profil.";
            showToast("Request outfit sudah dikirim ke COMOOTD Studio.");
          } catch(error) {
            els.requestStatus.textContent=error.message||"Request belum dapat dikirim. Coba lagi sesaat lagi.";
          } finally {
            button.disabled=false;
            button.innerHTML=originalLabel;
          }
        });

        async function copyContentUrl(url) {
          if (navigator.clipboard?.writeText && window.isSecureContext) { await navigator.clipboard.writeText(url); return true; }
          const input=document.createElement("textarea");
          input.value=url; input.setAttribute("readonly",""); input.style.cssText="position:fixed;opacity:0;pointer-events:none;";
          document.body.append(input); input.select();
          const copied=typeof document.execCommand === "function" && document.execCommand("copy");
          input.remove();
          return Boolean(copied);
        }
        async function shareEntity(type, id, { variantId = "" } = {}) {
          const source=type === "look" ? state.looks : type === "product" ? state.products : state.articles;
          const entry=source.find((item)=>item.id===id); if(!entry) return;
          const url=contentRouteUrl(type,entry,variantId).href;
          const name=entry.title || entry.name || "Kurasi";
          const text=type === "look" ? `${name} — temukan potongannya di COMOOTD.` : type === "product" ? `${name} — pilihan kurasi COMOOTD.` : `${name} — catatan style dari COMOOTD.`;
          const label=type === "look" ? "look" : type === "product" ? "produk" : "artikel";
          try {
            if(navigator.share){ await navigator.share({title:name,text,url}); showToast(`${label[0].toUpperCase()+label.slice(1)} siap dibagikan.`); return; }
            if(await copyContentUrl(url)){ showToast(`Link ${label} disalin.`); return; }
            window.prompt("Salin link ini:",url);
          } catch(error) {
            if(error?.name!=="AbortError") showToast("Link belum dapat disalin. Coba lagi dari browser ini.");
          }
        }
        let directoryFilterTimer=0;
        document.addEventListener("input",(event)=>{
          const input=event.target.closest('[data-directory-filter="q"]');
          if(!input)return;
          directoryPage.setFilter("q",input.value);
          clearTimeout(directoryFilterTimer);
          directoryFilterTimer=setTimeout(renderDirectoryRoute,180);
        });
        document.addEventListener("change",(event)=>{
          const input=event.target.closest("[data-directory-filter]");
          if(!input||input.dataset.directoryFilter==="q")return;
          directoryPage.setFilter(input.dataset.directoryFilter,input.value);
          renderDirectoryRoute();
        });
      })();
