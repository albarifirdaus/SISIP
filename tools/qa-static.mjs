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

for (const page of requiredPages) {
  check(existsSync(resolve(root, page)), `${page} tidak ditemukan`);
  if (!existsSync(resolve(root, page))) continue;
  const html = read(page);
  check(/<meta name="viewport"/i.test(html), `${page} tidak memiliki viewport`);
  check(/<title>[^<]+<\/title>/i.test(html), `${page} tidak memiliki title`);
  check(/rel="canonical"/i.test(html), `${page} tidak memiliki canonical URL`);
}

const index = read("index.html");
const worker = read("_worker.js");
const about = read("about/index.html");

check(!/COMOOTD\s*\/\s*Prototype/i.test(index), "Label Prototype masih tampil pada footer publik");
check(index.includes('href="/privacy"') && index.includes('href="/terms"'), "Footer belum menautkan halaman legal");
check(about.includes("comootd@gmail.com") && about.includes("instagram.com/comootd.id"), "Kontak resmi belum lengkap");
check(worker.includes("Strict-Transport-Security"), "Header HSTS belum aktif");
check(worker.includes("Permissions-Policy"), "Permissions-Policy belum aktif");
check(worker.includes("APP_ENV") && worker.includes("Disallow: /"), "Proteksi indexing staging belum aktif");
for (const path of ["/about", "/privacy", "/terms", "/curator-policy", "/community-guidelines", "/affiliate-info"]) {
  check(worker.includes(`"${path}"`), `${path} belum masuk sitemap`);
}

for (const file of ["_worker.js", "assets/supabase-adapter.js", "assets/curator-experience.js", "assets/public-content-pages.js"]) {
  if (!existsSync(resolve(root, file))) continue;
  const result = spawnSync(process.execPath, ["--check", resolve(root, file)], { encoding: "utf8" });
  check(result.status === 0, `${file} gagal syntax check: ${(result.stderr || result.stdout).trim()}`);
}

for (const file of ["index.html", "_worker.js", "config.js", "assets/supabase-adapter.js", "assets/curator-experience.js"]) {
  if (!existsSync(resolve(root, file))) continue;
  const content = read(file);
  check(!/(service_role\s*[:=]\s*["'][A-Za-z0-9._-]{20,})/i.test(content), `${file} tampak memuat service role key`);
  check(!/(localhost:\d+\/#[^\s"']*access_token)/i.test(content), `${file} memuat redirect token ke localhost`);
}

if (failures.length) {
  console.error(`QA gagal (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`QA lulus: ${requiredPages.length} halaman informasi, keamanan environment, sitemap, dan syntax terverifikasi.`);
