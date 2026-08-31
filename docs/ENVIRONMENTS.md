# Environment COMOOTD

## Tujuan

Arsitektur target COMOOTD memakai dua lingkungan yang benar-benar terpisah.
Untuk sementara hanya production yang aktif; Supabase staging ditunda sampai
biayanya disetujui pemilik COMOOTD.

| Lingkungan | Git branch | Cloudflare | Supabase | Indexing |
| --- | --- | --- | --- | --- |
| Production | `main` | `sisip-fashion.pages.dev` dan domain utama | proyek production | aktif |
| Staging | `develop` | project/preview URL staging | proyek staging terpisah | **ditunda** |

## Variabel Cloudflare

Pasang variabel berikut di setiap environment Cloudflare Pages:

- `APP_ENV`: `production` atau `staging`
- `SITE_ORIGIN`: URL publik environment tanpa path
- `SUPABASE_URL`: URL proyek Supabase environment tersebut
- `SUPABASE_PUBLISHABLE_KEY`: publishable/anon key environment tersebut
- `ADMIN_EMAIL`: email admin COMOOTD

Worker menghasilkan `/config.js` dari variabel ini sehingga frontend dan rendering SEO selalu memakai environment yang sama. Publishable key boleh berada di browser; `service_role`, password database, OAuth Client Secret, dan SMTP credential tidak boleh berada di repository atau frontend.

## Aturan pemisahan

1. Jangan menyalin data pribadi production ke staging.
2. Gunakan akun uji dan media uji di staging.
3. Staging memakai `APP_ENV=staging`; worker otomatis mengirim `noindex` dan `robots.txt` yang memblokir crawler.
4. Hanya `main` yang boleh menjadi sumber production deployment.
5. Migrasi diuji di staging sebelum diterapkan ke production.

## Status setup

Fondasi konfigurasi environment, `noindex`, rollback, dan QA sudah tersedia.
Branch `develop`, Cloudflare staging, dan Supabase staging belum diaktifkan.
Selama penundaan ini, gunakan
[PRODUCTION_RELEASE_CHECKLIST.md](PRODUCTION_RELEASE_CHECKLIST.md). Aktivasi
resource yang menimbulkan biaya wajib memperoleh persetujuan terlebih dahulu.
