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
const appSource = `${index}\n${homeScript}`;
const worker = read("_worker.js");
const about = read("about/index.html");

check(!/COMOOTD\s*\/\s*Prototype/i.test(index), "Label Prototype masih tampil pada footer publik");
check(!/<style[\s>]/i.test(index), "CSS halaman utama masih tertanam di index.html");
check(!/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(index), "JavaScript aplikasi masih tertanam di index.html");
check(homeScript.indexOf("const { slugify") < homeScript.indexOf("const SEED_PRODUCTS"), "Core utils harus diinisialisasi sebelum seed catalogue");
for (const asset of [
  "/assets/pages/home.css",
  "/assets/pages/home-storefront.css",
  "/assets/pages/home.js",
  "/assets/core/utils.js",
  "/assets/admin/bulk-import.js",
  "/assets/components/image-cropper.js",
  "/assets/components/catalog-media.js",
  "/assets/features/curator-studio.js",
  "/assets/features/platform-insights.js",
  "/assets/services/supabase.js",
  "/assets/styles/architectural-redesign.css"
]) check(index.includes(asset), `Referensi aset baru belum terpasang: ${asset}`);
check(index.includes('class="skip-link"') && index.includes('href="#siteMain"'), "Homepage belum memiliki skip link ke konten utama");
check(index.includes('class="storefront-grid"'), "Editorial storefront Fase 3 belum tersedia");
for (const path of ["/looks", "/products", "/curators", "/journal"]) {
  check(index.includes(`class="storefront-card`) && index.includes(`href="${path}"`), `Editorial storefront belum menautkan ${path}`);
}
check(index.includes('class="mobile-nav-primary"') && index.includes('class="mobile-nav-secondary"'), "Navigasi mobile belum memakai hierarki Fase 3");
check(index.indexOf('id="lookbook"') < index.indexOf('id="popularTitle"'), "Highlight Looks harus muncul sebelum highlight Products");
check(index.indexOf('id="journal"') < index.indexOf('id="forYou"'), "Rekomendasi personal harus muncul setelah editorial Journal");
check(index.includes('href="/privacy"') && index.includes('href="/terms"'), "Footer belum menautkan halaman legal");
check(about.includes("comootd@gmail.com") && about.includes("instagram.com/comootd.id"), "Kontak resmi belum lengkap");
check(worker.includes("Strict-Transport-Security"), "Header HSTS belum aktif");
check(worker.includes("Permissions-Policy"), "Permissions-Policy belum aktif");
check(worker.includes("APP_ENV") && worker.includes("Disallow: /"), "Proteksi indexing staging belum aktif");
for (const path of ["/about", "/privacy", "/terms", "/curator-policy", "/community-guidelines", "/affiliate-info"]) {
  check(worker.includes(`"${path}"`), `${path} belum masuk sitemap`);
}

for (const file of ["_worker.js", "assets/pages/home.js", "assets/core/utils.js", "assets/admin/bulk-import.js", "assets/components/catalog-media.js", "assets/services/supabase.js", "assets/features/curator-studio.js", "assets/features/platform-insights.js", "assets/public-content-pages.js"]) {
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

const insights = read("assets/features/platform-insights.js");
const analyticsMigration = read("supabase/migrations/20260830193000_comootd_analytics_and_link_health.sql");
check(!/userAgent|user_agent|ip_address|inet\s/i.test(analyticsMigration), "Migration analytics tidak boleh menyimpan IP atau user-agent");
check(analyticsMigration.includes("enable row level security"), "Tabel Milestone 2 belum mengaktifkan RLS");
check(analyticsMigration.includes("revoke all on table public.comootd_analytics_events"), "Akses langsung ke event analytics belum ditutup");
check(insights.includes("sessionStorage") && !insights.includes("localStorage"), "Analytics harus memakai sesi sementara, bukan identifier persisten");
check(appSource.includes('data-studio-tab="insights"'), "Tab Insights admin belum tersedia");

const marketplaceMigration = read("supabase/migrations/20260831090000_comootd_multi_marketplace.sql");
check(marketplaceMigration.includes("private.comootd_marketplace_for_url"), "Validasi marketplace di database belum tersedia");
check(marketplaceMigration.includes("tiktok_shop") && marketplaceMigration.includes("shopee"), "Marketplace Shopee dan TikTok Shop belum sama-sama didukung");
check(marketplaceMigration.includes("products_affiliate_url_marketplace_check") && marketplaceMigration.includes("look_curation_items_affiliate_url_marketplace_check"), "Konsistensi URL marketplace belum dikunci constraint");
check(marketplaceMigration.includes("save_contributor_look_v2") && marketplaceMigration.includes("update_comootd_product"), "RPC kompatibilitas multi-marketplace belum tersedia");
check(read("assets/services/supabase.js").includes('rpc("save_contributor_look_v2"') && read("assets/services/supabase.js").includes('rpc("update_comootd_product"'), "Adapter belum memakai RPC multi-marketplace");
check(appSource.includes('href="/styles/${esc(slugify(activeTag.name))}"'), "Explore style belum menautkan SEO landing page");
check(homeStyle.includes("background:var(--clay)") && !homeStyle.includes("background:var(--signal)"), "Tombol landing style belum memiliki warna kontras yang valid");
check(appSource.includes('candidatePool(state.looks, "look")') && appSource.includes('gender === preference.genderTarget || gender === "unisex"'), "Feed personal belum menyaring kandidat berdasarkan profil member");
check(worker.includes('type:"style-directory"') && worker.includes("comootd_style_tags") && worker.includes("sitemap-(looks|products|journal|curators|styles)"), "Style landing page atau sitemap style belum lengkap");
check(appSource.includes('value="tiktok_shop"') && appSource.includes('data-directory-filter="marketplace"'), "Input dan filter TikTok Shop belum tersedia");
const styleNormalizationMigration = read("supabase/migrations/20260831103000_fix_style_taxonomy_whitespace_normalization.sql");
check(styleNormalizationMigration.includes("'[[:space:]]+'"), "Normalisasi style harus memakai kelas whitespace POSIX");
check(!styleNormalizationMigration.includes("E'\\s+'"), "Migration style masih berisiko menghapus huruf s");
check(styleNormalizationMigration.includes("('Ca ual', 'Casual')") && styleNormalizationMigration.includes("('Japane e', 'Japanese')"), "Data style yang telanjur rusak belum dipulihkan");
const curatorExperience = read("assets/features/curator-studio.js");
check(curatorExperience.includes('dataset.archiveConfirmed') && curatorExperience.includes('textContent = "Mengarsipkan…"'), "Arsip curator belum memakai konfirmasi dan status proses yang terlihat");

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
