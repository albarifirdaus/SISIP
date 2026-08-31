import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

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
for (const asset of [
  "/assets/pages/home.css",
  "/assets/pages/home.js",
  "/assets/components/image-cropper.js",
  "/assets/features/curator-studio.js",
  "/assets/features/platform-insights.js",
  "/assets/services/supabase.js",
  "/assets/styles/architectural-redesign.css"
]) check(index.includes(asset), `Referensi aset baru belum terpasang: ${asset}`);
check(index.includes('href="/privacy"') && index.includes('href="/terms"'), "Footer belum menautkan halaman legal");
check(about.includes("comootd@gmail.com") && about.includes("instagram.com/comootd.id"), "Kontak resmi belum lengkap");
check(worker.includes("Strict-Transport-Security"), "Header HSTS belum aktif");
check(worker.includes("Permissions-Policy"), "Permissions-Policy belum aktif");
check(worker.includes("APP_ENV") && worker.includes("Disallow: /"), "Proteksi indexing staging belum aktif");
for (const path of ["/about", "/privacy", "/terms", "/curator-policy", "/community-guidelines", "/affiliate-info"]) {
  check(worker.includes(`"${path}"`), `${path} belum masuk sitemap`);
}

for (const file of ["_worker.js", "assets/pages/home.js", "assets/services/supabase.js", "assets/features/curator-studio.js", "assets/features/platform-insights.js", "assets/public-content-pages.js"]) {
  if (!existsSync(resolve(root, file))) continue;
  const result = spawnSync(process.execPath, ["--check", resolve(root, file)], { encoding: "utf8" });
  check(result.status === 0, `${file} gagal syntax check: ${(result.stderr || result.stdout).trim()}`);
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

for (const file of ["index.html", "_worker.js", "config.js", "assets/pages/home.js", "assets/services/supabase.js", "assets/features/curator-studio.js"]) {
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
