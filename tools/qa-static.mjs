import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const root = resolve(import.meta.dirname, "..");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = (path) => readFileSync(resolve(root, path), "utf8");

const requiredPages = [
  "about/index.html",
  "privacy/index.html",
  "terms/index.html",
  "curator-policy/index.html",
  "community-guidelines/index.html",
  "affiliate-info/index.html"
];

for (const document of ["docs/ROADMAP.md", "docs/PRODUCTION_RELEASE_CHECKLIST.md", "docs/ARCHITECTURE.md"]) {
  check(existsSync(resolve(root, document)), `${document} tidak ditemukan`);
}

if (existsSync(resolve(root, "docs/ROADMAP.md"))) {
  const roadmap = read("docs/ROADMAP.md");
  check((roadmap.match(/\| [1-8] \|/g) || []).length === 8, "Roadmap belum memuat delapan fase");
  check((roadmap.match(/\| [1-6] —/g) || []).length === 6, "Roadmap belum memuat enam milestone");
  check(/persetujuan pemilik COMOOTD/i.test(roadmap), "Roadmap belum memiliki gerbang persetujuan biaya");
}

for (const page of requiredPages) {
  check(existsSync(resolve(root, page)), `${page} tidak ditemukan`);
  if (!existsSync(resolve(root, page))) continue;
  const html = read(page);
  check(/<meta name="viewport"/i.test(html), `${page} tidak memiliki viewport`);
  check(/<title>[^<]+<\/title>/i.test(html), `${page} tidak memiliki title`);
  check(/rel="canonical"/i.test(html), `${page} tidak memiliki canonical URL`);
}

const index = read("index.html");
const homeScript = read("assets/pages/home.js");
const homeStyle = read("assets/pages/home.css");
const catalogueDirectoryScript = read("assets/pages/catalogue-directory.js");
const appSource = `${index}\n${homeScript}\n${catalogueDirectoryScript}`;
const worker = read("_worker.js");
const about = read("about/index.html");

check(!/COMOOTD\s*\/\s*Prototype/i.test(index), "Label Prototype masih tampil pada footer publik");
check(!/<style[\s>]/i.test(index), "CSS halaman utama masih tertanam di index.html");
check(!/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(index), "JavaScript aplikasi masih tertanam di index.html");
check(homeScript.indexOf("const { slugify") < homeScript.indexOf("const SEED_PRODUCTS"), "Core utils harus diinisialisasi sebelum seed catalogue");
for (const asset of [
  "/assets/pages/home.css",
  "/assets/pages/home-storefront.css",
  "/assets/pages/catalogue-directory.js",
  "/assets/pages/home.js",
  "/assets/core/utils.js",
  "/assets/admin/bulk-import.js",
  "/assets/components/image-cropper.js",
  "/assets/components/catalog-media.js",
  "/assets/components/notification.js",
  "/assets/components/navigation.js",
  "/assets/components/filters.js",
  "/assets/features/curator-studio.js",
  "/assets/features/authentication.js",
  "/assets/features/look-likes.js",
  "/assets/features/platform-insights.js",
  "/assets/features/member-retention.js",
  "/assets/features/member-retention.css",
  "/assets/services/supabase.js",
  "/assets/styles/architectural-redesign.css"
]) check(index.includes(asset), `Referensi aset baru belum terpasang: ${asset}`);
check(index.includes('class="skip-link"') && index.includes('href="#siteMain"'), "Homepage belum memiliki skip link ke konten utama");
check(index.includes('class="storefront-grid"'), "Editorial storefront Fase 3 belum tersedia");
check(index.includes('storefront-card--dark storefront-card--wide') && read("assets/pages/home-storefront.css").includes(".storefront-card--wide { grid-column:1 / -1;"), "Kartu Journal desktop belum menutup ruang kosong storefront");
const storefrontVisualMigration = read("supabase/migrations/20260901210000_storefront_visual_controls.sql");
const storefrontUploadMigration = read("supabase/migrations/20260902070000_storefront_custom_uploads.sql");
check(["looks","products","curators","journal"].every((key) => index.includes(`data-storefront-visual="${key}"`)), "Empat kartu storefront belum mendukung visual terkelola");
check(storefrontVisualMigration.includes("enable row level security") && storefrontVisualMigration.includes('Public reads COMOOTD storefront visuals') && storefrontVisualMigration.includes('COMOOTD admin updates storefront visuals'), "Pengaturan visual storefront belum dilindungi RLS");
check(storefrontVisualMigration.includes("revoke all on table public.comootd_storefront_visuals") && storefrontVisualMigration.includes("grant update (look_id, product_id, curator_id, article_id, focal_position)"), "Privilege visual storefront belum least-privilege");
check(appSource.includes("renderStorefrontVisuals") && appSource.includes("saveStorefrontVisuals") && read("assets/services/supabase.js").includes('from("comootd_storefront_visuals")'), "Visual storefront belum terhubung dari katalog ke Studio admin");
check(storefrontUploadMigration.includes("custom_image_path") && storefrontUploadMigration.includes("COMOOTD admin uploads storefront media") && storefrontUploadMigration.includes("private.is_sisip_admin"), "Upload desain storefront belum memiliki kolom dan policy Storage admin");
check(storefrontUploadMigration.includes("grant update (look_id, product_id, curator_id, article_id, custom_image_path, focal_position)"), "Privilege desain storefront belum membatasi kolom update");
check(homeScript.includes('data-storefront-file=') && homeScript.includes('value="__custom__"') && homeScript.includes("maks. 2 MB"), "Studio belum menyediakan upload desain sendiri yang dibatasi");
check(read("assets/services/supabase.js").includes("storefront/${entry.cardKey}/") && read("assets/services/supabase.js").includes("2 * 1024 * 1024") && read("assets/services/supabase.js").includes('cacheControl:"31536000"') && read("assets/services/supabase.js").includes("obsoletePaths"), "Upload, cache, batas ukuran, atau pembersihan desain storefront belum lengkap");
for (const path of ["/looks", "/products", "/curators", "/journal"]) {
  check(index.includes(`class="storefront-card`) && index.includes(`href="${path}"`), `Editorial storefront belum menautkan ${path}`);
}
check(index.includes('class="mobile-nav-primary"') && index.includes('class="mobile-nav-secondary"'), "Navigasi mobile belum memakai hierarki Fase 3");
check(index.indexOf('id="lookbook"') < index.indexOf('id="popularTitle"'), "Highlight Looks harus muncul sebelum highlight Products");
check(index.indexOf('id="journal"') < index.indexOf('id="forYou"'), "Rekomendasi personal harus muncul setelah editorial Journal");
check(index.includes('href="/privacy"') && index.includes('href="/terms"'), "Footer belum menautkan halaman legal");
check(index.includes('id="requestRouteLayer"') && index.includes('href="/request"'), "Halaman Request Outfit belum dipisahkan dari beranda");
check(worker.includes('request: "request-page"') && worker.includes('canonicalUrl(env, "/request")'), "Route dan sitemap Request Outfit belum tersedia");
check(index.includes('class="member-profile-disclosure"'), "Profil member belum memakai bagian buka/tutup yang ringkas");
check(about.includes("comootd@gmail.com") && about.includes("instagram.com/comootd.id"), "Kontak resmi belum lengkap");
check(worker.includes("Strict-Transport-Security"), "Header HSTS belum aktif");
check(worker.includes("Permissions-Policy"), "Permissions-Policy belum aktif");
check(worker.includes("APP_ENV") && worker.includes("Disallow: /"), "Proteksi indexing staging belum aktif");
for (const path of ["/request", "/about", "/privacy", "/terms", "/curator-policy", "/community-guidelines", "/affiliate-info"]) {
  check(worker.includes(`"${path}"`), `${path} belum masuk sitemap`);
}

for (const file of ["_worker.js", "assets/pages/home.js", "assets/pages/catalogue-directory.js", "assets/core/utils.js", "assets/admin/bulk-import.js", "assets/components/catalog-media.js", "assets/components/notification.js", "assets/components/navigation.js", "assets/components/filters.js", "assets/services/supabase.js", "assets/features/authentication.js", "assets/features/look-likes.js", "assets/features/curator-studio.js", "assets/features/platform-insights.js", "assets/features/member-retention.js", "assets/public-content-pages.js"]) {
  if (!existsSync(resolve(root, file))) continue;
  const result = spawnSync(process.execPath, ["--check", resolve(root, file)], { encoding: "utf8" });
  check(result.status === 0, `${file} gagal syntax check: ${(result.stderr || result.stdout).trim()}`);
}

try {
  const moduleContext = { window:{}, Intl, URL, Object, String, Number, Array, Map, Set, JSON, Date, Math, Error };
  runInNewContext(read("assets/core/utils.js"), moduleContext, { filename:"assets/core/utils.js" });
  const core = moduleContext.window.COMOOTDCore;
  check(core.slugify("Korean Style") === "korean-style", "Core slugify tidak menghasilkan slug yang stabil");
  check(core.imageAspect("look-square.webp") === "square", "Core image aspect gagal mengenali gambar square");
  check(core.esc('<b class="x">') === "&lt;b class=&quot;x&quot;&gt;", "Core HTML escaping tidak aman");

  runInNewContext(read("assets/admin/bulk-import.js"), moduleContext, { filename:"assets/admin/bulk-import.js" });
  const bulk = moduleContext.window.COMOOTDBulkImport.create({
    STYLE_ORDER:["Clean"], PRODUCT_BADGE_OPTIONS:["", "COMOOTD Pick"],
    MARKETPLACES:{ shopee:{ label:"Shopee" } }, PRODUCT_CATEGORIES:{ top:"Atasan" },
    BULK_IMPORT_MAX_ROWS:10, BULK_IMPORT_MAX_PRODUCTS:10,
    BULK_LOOK_IMPORT_MAX_ROWS:10, BULK_LOOK_IMPORT_MAX_LOOKS:10,
    marketplaceFromUrl:()=>"shopee", affiliateUrl:(value)=>String(value)
  });
  const matrix = bulk.parseCsvMatrix("product_key,name,affiliate_url,price_idr,color_name,style_tag_1,category\nTOP-1,Top,https://shope.ee/example,120000,Putih,Clean,top");
  const result = bulk.validateBulkRows(bulk.matrixToBulkRows(matrix));
  check(result.errors.length === 0 && result.groups.length === 1, "Modul bulk import gagal memvalidasi template produk yang sah");

  runInNewContext(read("assets/components/catalog-media.js"), moduleContext, { filename:"assets/components/catalog-media.js" });
  const media = moduleContext.window.COMOOTDCatalogMedia.create({
    safeImage:core.safeImage, esc:core.esc,
    tones:{ carbon:{ bg:"#000", accent:"#111", garment:"#222", bottom:"#333", figure:"#444", skin:"#555", skinDark:"#666", hair:"#777", label:"#fff", light:false } },
    lookAttribution:()=>"BY COMOOTD"
  });
  check(media.productArt({ name:"Tas", category:"bag", image:"https://example.com/tas.jpg" }, null).includes("image-frame--square"), "Catalog media gagal merender produk square");
  check(media.lookMediaEntries({ media:[{ image:"https://example.com/look.jpg" }, { image:"https://example.com/look.jpg" }] }).length === 1, "Catalog media gagal menghapus foto look duplikat");
} catch (error) {
  failures.push(`Uji modul frontend gagal: ${error?.message || error}`);
}

try {
  const uiContext = { window:{}, Object, String, Boolean, Array, Error };
  runInNewContext(read("assets/components/notification.js"), uiContext, { filename:"assets/components/notification.js" });
  runInNewContext(read("assets/components/navigation.js"), uiContext, { filename:"assets/components/navigation.js" });
  runInNewContext(read("assets/components/filters.js"), uiContext, { filename:"assets/components/filters.js" });

  const classList = () => {
    const values = new Set();
    return {
      add:(value) => values.add(value), remove:(value) => values.delete(value), contains:(value) => values.has(value),
      toggle:(value, force) => { const enabled = force === undefined ? !values.has(value) : Boolean(force); if (enabled) values.add(value); else values.delete(value); return enabled; }
    };
  };
  const toast = { textContent:"", classList:classList() };
  let scheduled = null;
  const notification = uiContext.window.COMOOTDNotification.create({ element:toast, scheduler:{ setTimeout:(callback) => { scheduled = callback; return 1; }, clearTimeout:() => {} } });
  notification.show("Tersimpan");
  check(toast.textContent === "Tersimpan" && toast.classList.contains("show"), "Komponen notification gagal menampilkan pesan");
  scheduled?.();
  check(!toast.classList.contains("show"), "Komponen notification gagal membersihkan pesan");

  const listeners = {};
  const attributes = {};
  const menuButton = { addEventListener:(name, callback) => { listeners[`menu:${name}`] = callback; }, removeEventListener:() => {}, setAttribute:(name, value) => { attributes[name] = value; } };
  const mobileNav = { classList:classList(), addEventListener:(name, callback) => { listeners[`nav:${name}`] = callback; }, removeEventListener:() => {} };
  const navigation = uiContext.window.COMOOTDNavigation.create({ menuButton, mobileNav });
  navigation.toggle();
  check(mobileNav.classList.contains("is-open") && attributes["aria-expanded"] === "true", "Komponen navigation gagal membuka menu");
  navigation.close();
  check(!mobileNav.classList.contains("is-open") && attributes["aria-label"] === "Buka menu", "Komponen navigation gagal menutup menu");

  const select = { value:"Casual", innerHTML:"" };
  const chips = { innerHTML:"" };
  uiContext.window.COMOOTDFilters.renderStyleControls({ styles:["Clean", "Casual"], select, chips, activeStyle:"Casual", escapeHtml:(value) => String(value) });
  check(select.value === "Casual" && chips.innerHTML.includes('data-style="Casual"') && chips.innerHTML.includes("is-active"), "Komponen filters gagal mempertahankan style aktif");

  runInNewContext(read("assets/pages/catalogue-directory.js"), uiContext, { filename:"assets/pages/catalogue-directory.js" });
  const directoryState = { products:[{ id:"p1", name:"Oxford", price:120000, category:"top", genderTarget:"unisex", styles:["Clean"], variants:[] }], looks:[], articles:[], styleTags:[{ name:"Clean" }] };
  const directory = uiContext.window.COMOOTDCatalogueDirectory.create({
    getState:() => directoryState, esc:(value) => String(value), slugify:(value) => String(value).toLowerCase(), money:(value) => String(value), safeImage:(value) => String(value),
    marketplaces:{ shopee:{ label:"Shopee" } }, productCategories:{ top:"Atasan" }, marketplaceOf:() => "shopee", marketplaceLabel:() => "Shopee",
    lookVisual:() => "", productArt:() => "", lookAttribution:() => "BY COMOOTD", curatorMetricsMarkup:() => "", lookLikeButton:() => "", articleCategoryLabel:() => "Journal",
    window:{ location:{ pathname:"/products", href:"https://comootd.test/products" } }, document:{}
  });
  check(directory.readRoute()?.key === "products", "Page directory gagal mengenali route Products");
  directory.setFilter("category", "top");
  check(directory.filteredEntries(directory.readRoute()).length === 1, "Page directory gagal menyaring kategori produk");

  runInNewContext(read("assets/features/authentication.js"), uiContext, { filename:"assets/features/authentication.js" });
  const authElements = {
    title:{ textContent:"" }, copy:{ textContent:"" }, displayNameField:{ hidden:true }, submit:{ innerHTML:"" }, switchButton:{ textContent:"" },
    displayNameInput:{ required:false }, passwordInput:{ setAttribute:(name,value) => { authElements.passwordInput[name] = value; } }, error:{ textContent:"lama" }
  };
  const authentication = uiContext.window.COMOOTDAuthentication.create({ elements:authElements });
  authentication.setMode("signup");
  check(authentication.mode === "signup" && authElements.displayNameInput.required && authElements.passwordInput.autocomplete === "new-password", "Feature authentication gagal mengatur mode signup");
  authentication.setPendingEmail("member@example.com");
  check(authentication.pendingEmail === "member@example.com", "Feature authentication gagal menyimpan email konfirmasi sementara");

  runInNewContext(read("assets/features/look-likes.js"), uiContext, { filename:"assets/features/look-likes.js" });
  const likedEntry = { id:"look-1", title:"Clean Look", popularity:2 };
  let likeUpdated = false;
  const likes = uiContext.window.COMOOTDLookLikes.create({
    escapeHtml:(value) => String(value), getLook:() => likedEntry, getCloud:() => ({ toggleLookLike:async() => ({ liked:true }) }),
    isCloudEnabled:() => true, isSignedIn:() => true, notify:() => {}, requireSignIn:() => {}, onUpdated:() => { likeUpdated = true; }
  });
  await likes.toggle("look-1");
  check(likes.has("look-1") && likedEntry.popularity === 3 && likeUpdated, "Feature look likes gagal menyinkronkan state dan popularity");

  uiContext.document = { addEventListener:() => {}, querySelectorAll:() => [] };
  uiContext.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  uiContext.window.dispatchEvent = () => {};
  runInNewContext(read("assets/features/member-retention.js"), uiContext, { filename:"assets/features/member-retention.js" });
  const retentionProducts = Array.from({ length:10 }, (_, index) => ({ id:`product-${index + 1}`, name:`Produk ${index + 1}`, image:`https://example.com/product-${index + 1}.jpg` }));
  const retentionFeature = uiContext.window.COMOOTDMemberRetention.create({
    getState:() => ({ products:retentionProducts, looks:[], curators:[] }),
    getCloud:() => ({ loadMemberRetentionState:async() => ({
      collections:[{ id:"default", name:"Disimpan", isDefault:true }],
      savedItems:retentionProducts.map((item) => ({ collectionId:"default", targetType:"product", targetId:item.id })),
      followedCuratorIds:[], recentlyViewed:[]
    }) }),
    isSignedIn:() => true, escapeHtml:(value) => String(value), safeImage:(value) => String(value || "")
  });
  await retentionFeature.hydrate();
  const retentionRoot = { innerHTML:"" };
  retentionFeature.renderPanel(retentionRoot);
  check(retentionRoot.innerHTML.includes('<details class="retention-collection" open>') && (retentionRoot.innerHTML.match(/class="retention-item"/g) || []).length === 8, "Koleksi ringkas belum terbuka dengan batas delapan item awal");
  check(retentionRoot.innerHTML.includes("Lihat 2 lainnya") && retentionRoot.innerHTML.includes('class="retention-item-media"') && retentionRoot.innerHTML.includes('class="retention-icon-button is-danger"'), "Koleksi scalable belum memiliki thumbnail, aksi ikon, atau kontrol lihat lainnya");
} catch (error) {
  failures.push(`Uji komponen UI gagal: ${error?.message || error}`);
}

const insights = read("assets/features/platform-insights.js");
const analyticsMigration = read("supabase/migrations/20260830193000_comootd_analytics_and_link_health.sql");
const analyticsHardening = read("supabase/migrations/20260831170000_comootd_phase4_analytics_hardening.sql");
const linkInventoryMigration = read("supabase/migrations/20260901180000_paginate_link_inventory.sql");
check(!/userAgent|user_agent|ip_address|inet\s/i.test(analyticsMigration), "Migration analytics tidak boleh menyimpan IP atau user-agent");
check(analyticsMigration.includes("enable row level security"), "Tabel Milestone 2 belum mengaktifkan RLS");
check(analyticsMigration.includes("revoke all on table public.comootd_analytics_events"), "Akses langsung ke event analytics belum ditutup");
check(insights.includes("sessionStorage") && !insights.includes("localStorage"), "Analytics harus memakai sesi sementara, bukan identifier persisten");
check(appSource.includes('data-studio-tab="insights"'), "Tab Insights admin belum tersedia");
check(analyticsHardening.includes("p_event_type='product_click'") && analyticsHardening.includes("'campaigns'") && analyticsHardening.includes("'mediums'"), "Kontrak event dan agregasi attribution Fase 4 belum lengkap");
check(insights.includes("ATTRIBUTION_KEY") && insights.includes("data-campaign-builder") && insights.includes("trendMarkup"), "Attribution sesi, UTM builder, atau tren dashboard Fase 4 belum tersedia");
check(appSource.includes('data-insight-context-look="${esc(contextLook)}"') && appSource.includes("contextLook:entry.id"), "Klik produk dari detail Look belum diatribusikan ke Look dan curator");
check(linkInventoryMigration.includes("get_comootd_link_inventory") && linkInventoryMigration.includes("security invoker") && linkInventoryMigration.includes("set search_path = ''"), "RPC inventaris link belum memakai kontrak keamanan yang benar");
check(linkInventoryMigration.includes("grant execute on function public.get_comootd_link_inventory") && linkInventoryMigration.includes("l.creator_id = (select auth.uid())"), "Inventaris link belum dibatasi untuk admin dan Curator pemilik");
check(read("assets/services/supabase.js").includes('rpc("get_comootd_link_inventory"') && !read("assets/services/supabase.js").includes("requireUser()") && insights.includes("data-link-inventory-query") && insights.includes("data-link-page"), "Inventaris link belum memakai pencarian dan pagination server-side dengan pemeriksaan akun yang valid");

const marketplaceMigration = read("supabase/migrations/20260831090000_comootd_multi_marketplace.sql");
const generalWebsiteMigration = read("supabase/migrations/20260901190000_support_general_website_links.sql");
check(marketplaceMigration.includes("private.comootd_marketplace_for_url"), "Validasi marketplace di database belum tersedia");
check(marketplaceMigration.includes("tiktok_shop") && marketplaceMigration.includes("shopee"), "Marketplace Shopee dan TikTok Shop belum sama-sama didukung");
check(marketplaceMigration.includes("products_affiliate_url_marketplace_check") && marketplaceMigration.includes("look_curation_items_affiliate_url_marketplace_check"), "Konsistensi URL marketplace belum dikunci constraint");
check(marketplaceMigration.includes("save_contributor_look_v2") && marketplaceMigration.includes("update_comootd_product"), "RPC kompatibilitas multi-marketplace belum tersedia");
check(read("assets/services/supabase.js").includes('rpc("save_contributor_look_v2"') && read("assets/services/supabase.js").includes('rpc("update_comootd_product"'), "Adapter belum memakai RPC multi-marketplace");
check(generalWebsiteMigration.includes("'website'") && generalWebsiteMigration.includes("security invoker"), "Dukungan website umum atau kontrak keamanan Tahap 4 belum lengkap");
check(generalWebsiteMigration.includes("p_marketplace in ('shopee', 'tiktok_shop', 'website')") && generalWebsiteMigration.includes("products_affiliate_url_marketplace_check"), "Filter inventaris atau constraint link website umum belum tersedia");
check(!generalWebsiteMigration.includes("grant execute on function private.comootd_marketplace_for_url"), "Helper deteksi link internal tidak boleh diekspos langsung ke pengguna");
check(appSource.includes("website: { label:\"Website\"") && appSource.includes("dikenali otomatis") && !index.includes('id="productMarketplaceInput"'), "Form produk belum mendeteksi Shopee, TikTok Shop, dan website umum secara otomatis");
check(read("assets/features/curator-studio.js").includes('website: { label:\"Website\"') && !read("assets/features/curator-studio.js").includes('name="referenceMarketplace"'), "Editor Curator belum mendukung link website umum otomatis");
check(insights.includes('<option value="website"') && insights.includes("Semua platform"), "Inventaris link belum dapat difilter untuk website umum");
check(appSource.includes('href="/styles/${esc(slugify(activeTag.name))}"'), "Explore style belum menautkan SEO landing page");
check(homeStyle.includes("background:var(--clay)") && !homeStyle.includes("background:var(--signal)"), "Tombol landing style belum memiliki warna kontras yang valid");
check(appSource.includes('candidatePool(state.looks, "look")') && appSource.includes('gender === preference.genderTarget || gender === "unisex"'), "Feed personal belum menyaring kandidat berdasarkan profil member");
check(worker.includes('type:"style-directory"') && worker.includes("comootd_style_tags") && worker.includes("sitemap-(looks|products|journal|curators|styles)"), "Style landing page atau sitemap style belum lengkap");
check(appSource.includes('data-directory-filter="marketplace"') && insights.includes('<option value="tiktok_shop"'), "Filter TikTok Shop belum tersedia");
const styleNormalizationMigration = read("supabase/migrations/20260831103000_fix_style_taxonomy_whitespace_normalization.sql");
check(styleNormalizationMigration.includes("'[[:space:]]+'"), "Normalisasi style harus memakai kelas whitespace POSIX");
check(!styleNormalizationMigration.includes("E'\\s+'"), "Migration style masih berisiko menghapus huruf s");
check(styleNormalizationMigration.includes("('Ca ual', 'Casual')") && styleNormalizationMigration.includes("('Japane e', 'Japanese')"), "Data style yang telanjur rusak belum dipulihkan");
const curatorExperience = read("assets/features/curator-studio.js");
const curatorStyle = read("assets/features/curator-studio.css");
check(curatorExperience.includes('dataset.archiveConfirmed') && curatorExperience.includes('textContent = "Mengarsipkan…"'), "Arsip curator belum memakai konfirmasi dan status proses yang terlihat");
const curatorFollowerMigration = read("supabase/migrations/20260901200000_curator_public_follower_counts.sql");
check(curatorFollowerMigration.includes("follower_count integer not null default 0") && curatorFollowerMigration.includes("comootd_curator_follows_sync_count"), "Penghitung follower publik Curator belum tersedia");
check(curatorFollowerMigration.includes("security definer") && curatorFollowerMigration.includes("set search_path = ''") && curatorFollowerMigration.includes("revoke all on function private.sync_comootd_curator_follower_count()"), "Sinkronisasi follower Curator belum diisolasi dengan aman");
check(curatorExperience.includes("curator-card-stats") && curatorExperience.includes("curator-profile-intro") && curatorExperience.includes("curator-icon-button") && curatorExperience.includes("followedCuratorIds"), "Penyegaran kartu, profil, dan follower Curator Tahap 5 belum lengkap");
check(index.includes('data-discovery-carousel="products"') && index.includes('data-discovery-carousel="journal"') && curatorExperience.includes('data-discovery-carousel="curators"'), "Rail eksplorasi Products, Curators, dan Journal belum lengkap");
check(homeScript.includes("syncDiscoveryRails") && homeScript.includes("moveDiscoveryRail") && /event\.key\s*===\s*"ArrowLeft"/.test(homeScript) && /event\.key\s*!==\s*"ArrowRight"/.test(homeScript), "Rail eksplorasi belum mendukung sinkronisasi tombol dan keyboard");
const uiPolish = read("assets/styles/ui-polish.css");
check(/scroll-snap-type:\s*x mandatory/.test(uiPolish), "Rail eksplorasi belum memiliki scroll snap");
check(uiPolish.includes(".look-card-footer .catalogue-card-actions") && uiPolish.includes("grid-template-columns: 56px 44px") && uiPolish.includes("grid-template-columns: 50px 40px"), "Posisi aksi like dan simpan pada kartu look belum konsisten");
check(homeScript.includes("Minimalist\", \"Techwear\", \"Whimsy\", \"Workwear\", \"Clean\", \"Casual") && /\.slice\(0,\s*6\)/.test(homeScript), "Explore style belum mengisi enam pilihan");
check(/\.slice\(0,\s*12\)/.test(homeScript) && /\.slice\(0,\s*12\)/.test(curatorExperience), "Konten rail belum dibatasi untuk menjaga performa beranda");
check(curatorStyle.includes("grid-template-columns:repeat(5,minmax(0,1fr))") && curatorStyle.includes("grid-template-columns:repeat(2,minmax(0,1fr)); gap:.5rem"), "Grid look Curator belum memakai lima kolom desktop dan dua kolom ponsel");
check(curatorStyle.includes(".curator-look-card .curator-profile-metrics { display:none; }") && curatorStyle.includes(".curator-look-card-actions .curator-look-open span"), "Kartu look ponsel belum memiliki informasi dan aksi yang ringkas");
check(read("assets/services/supabase.js").includes("follower_count, created_at") && read("assets/services/supabase.js").includes("followerCount: Math.max"), "Jumlah follower belum dimuat dari katalog Curator");
const retention = read("assets/features/member-retention.js");
const retentionMigration = read("supabase/migrations/20260831190000_comootd_phase5_member_retention.sql");
const retentionHardening = read("supabase/migrations/20260831191500_phase5_saved_items_security_invoker.sql");
check(retention.includes("toggleSavedItem") && retention.includes("toggleCuratorFollow") && retention.includes("recordView"), "Fase 5 belum memuat save, follow, dan recently viewed");
check(retention.includes('class="retention-save-button is-compact') && !retention.includes('<span>${saved ? "Tersimpan" : "Simpan"}</span>'), "Tombol simpan belum konsisten memakai ikon saja");
check(retention.includes('button.setAttribute("title", label)') && read("assets/features/look-likes.js").includes('title="${accessibleLabel}"'), "Aksi sosial belum memiliki tooltip yang dapat diakses");
check(homeScript.includes('els.newSeriesDots.innerHTML = entries.map') && !homeScript.includes('join("")}${lookLikeButton(entry,true)}'), "Highlight New Series masih menampilkan tombol like");
check(homeStyle.includes(".personal-look > .catalogue-card-actions") && homeStyle.includes(".personal-look > .catalogue-card-actions .look-like-button span { display:none; }"), "Aksi Tailored for You belum memakai dock ikon ringkas");
check(retention.includes("createMemberCollection") && appSource.includes('id="memberRetentionPanel"'), "Koleksi member belum terhubung ke profil");
check(retention.includes("data-retention-open") && appSource.includes("comootd:open-retention-item"), "Item koleksi belum memiliki tombol langsung ke detail");
check(retentionMigration.includes("enable row level security") && retentionHardening.includes("security invoker") && retentionMigration.includes("set search_path = ''"), "Data retention belum memiliki RLS dan RPC terisolasi");
check(appSource.includes("memberRetention.score(entry, type)") && appSource.includes("memberRetention.hasSignals()"), "Feed personal belum memakai sinyal aktivitas Fase 5");

for (const file of ["index.html", "_worker.js", "config.js", "assets/pages/home.js", "assets/core/utils.js", "assets/admin/bulk-import.js", "assets/components/catalog-media.js", "assets/services/supabase.js", "assets/features/curator-studio.js"]) {
  if (!existsSync(resolve(root, file))) continue;
  const content = read(file);
  check(!/(service_role\s*[:=]\s*["'][A-Za-z0-9._-]{20,})/i.test(content), `${file} tampak memuat service role key`);
  check(!/(localhost:\d+\/#[^\s"']*access_token)/i.test(content), `${file} memuat redirect token ke localhost`);
}

try {
  const workerModule = await import(`${new URL("../_worker.js", import.meta.url).href}?qa=${Date.now()}`);
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input?.url || input || "");
    if (url.includes("/rest/v1/comootd_style_tags")) return new Response(JSON.stringify([{ name:"Clean", updated_at:"2026-08-31T00:00:00Z" }]), { status:200, headers:{ "content-type":"application/json" } });
    return new Response("[]", { status:200, headers:{ "content-type":"application/json", "content-range":"0-0/0" } });
  };
  try {
    const response = await workerModule.default.fetch(new Request("https://preview.comootd.test/styles/clean"), {
      SUPABASE_URL:"https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY:"public-test-key",
      SITE_ORIGIN:"https://preview.comootd.test",
      APP_ENV:"staging",
      ASSETS:{ fetch:async () => new Response(index, { headers:{ "content-type":"text/html" } }) }
    });
    const html = await response.text();
    check(response.status === 200 && html.includes("Clean Style — Outfit &amp; Produk Kurasi Indonesia | COMOOTD"), "Worker gagal merender metadata landing page style");
    check(String(response.headers.get("x-robots-tag") || "").startsWith("noindex, nofollow"), "Landing page staging tidak dilindungi noindex");
  } finally { globalThis.fetch = previousFetch; }
} catch (error) {
  failures.push(`Worker route test gagal: ${error?.message || error}`);
}

if (failures.length) {
  console.error(`QA gagal (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`QA lulus: ${requiredPages.length} halaman informasi, keamanan environment, sitemap, dan syntax terverifikasi.`);
