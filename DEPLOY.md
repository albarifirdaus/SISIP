# Deploy COMOOTD

> Supabase staging terpisah sedang ditunda sampai biaya disetujui pemilik
> COMOOTD. Selama website belum diluncurkan resmi, rilis production mengikuti
> [checklist sementara](docs/PRODUCTION_RELEASE_CHECKLIST.md). Alur staging penuh
> tetap didokumentasikan di [docs/RELEASE_WORKFLOW.md](docs/RELEASE_WORKFLOW.md).

## 1. GitHub

Repository tujuan: `albarifirdaus/SISIP`.

Perubahan rutin dibuat pada branch kerja. Branch `main` hanya menerima commit
yang sudah lolos `npm run release:check`, review diff, serta verifikasi database
bila ada migration. Push harus non-force.

Isi website berada di root repository:

```text
index.html
assets/supabase-adapter.js
config.js
supabase/migrations/
```

`config.js` hanya menyimpan publishable key Supabase. Key ini harus tetap tersedia pada hasil deploy static; jangan menggantinya dengan service role atau password.

## 2. Cloudflare Pages (disarankan untuk katalog affiliate)

1. Login ke Cloudflare lalu buka **Workers & Pages → Create → Pages → Connect to Git**.
2. Pilih repository `albarifirdaus/SISIP` dan branch `main`.
3. Pilih framework **None**.
4. Kosongkan build command dan set build output directory ke `.` (root repository).
5. Deploy. Cloudflare akan memberi URL gratis `*.pages.dev`.
6. Isi environment variables sesuai [docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md). Untuk staging, wajib gunakan Supabase staging dan `APP_ENV=staging`.
7. Setelah deploy, buka URL tersebut lalu login ke COMOOTD Studio untuk menguji alur kritis.

Tidak ada environment variable rahasia yang dibutuhkan pada frontend ini. Supabase RLS yang membatasi akses tulis, bukan penyembunyian key browser.

## 3. Supabase Auth untuk member dan admin

Di Supabase Dashboard, buka **Authentication → URL Configuration**:

- Isi **Site URL** dengan `https://sisip-fashion.pages.dev`.
- Tambahkan `https://sisip-fashion.pages.dev/**` pada **Redirect URLs**. Gunakan URL exact jika tidak membutuhkan path tambahan.
- Tambahkan domain custom nanti jika sudah punya.
- Di **Authentication → Providers → Email**, aktifkan email sign-up. Untuk website live, aktifkan juga konfirmasi email.
- Di **Authentication → Providers → Google**, aktifkan provider dan simpan Client ID serta Client Secret dari Google Cloud. Authorized redirect URI Google harus persis `https://rbvrlfmsvmwjkisbwuim.supabase.co/auth/v1/callback`.

Di **Authentication → Email Templates → Confirm signup**, subject dan isi email dapat memakai nama SISIP, misalnya subject `Konfirmasi akun SISIP`. Nama pengirim `SISIP` dengan alamat email branded memerlukan Custom SMTP dan domain email milikmu yang sudah diverifikasi.

Untuk akun user publik, aktifkan **Authentication → Emails → SMTP Settings → Custom SMTP**. SMTP bawaan paket Free hanya cocok untuk pengujian internal dan tidak menjadi jalur pengiriman email konfirmasi ke user umum.

Member dapat membuat akun sendiri untuk menyimpan preferensi dan request outfit. Akun admin tetap ditentukan oleh email `albarifirdaus209@gmail.com` dan diperiksa ulang oleh RLS di database.

## 4. Cek sebelum live

- Admin Auth untuk `albarifirdaus209@gmail.com` sudah dibuat dan berhasil login.
- Ganti sample link dengan affiliate link Shopee asli.
- Cek harga referensi dan tanggal kurasi.
- Isi minimal satu artikel jika Journal ingin tampil di cloud.
- Coba satu akun member: simpan preferensi, kirim Request Outfit, lalu balas lewat **SISIP Studio → Requests**.
- Aktifkan leaked-password protection di Supabase Auth bila tersedia di paketmu.


