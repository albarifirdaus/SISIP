# Deploy SISIP

## 1. GitHub

Repository tujuan: `albarifirdaus/SISIP`.

Jika koneksi GitHub di Codex menampilkan `Resource not accessible by integration`, sambungkan ulang GitHub dengan izin **Contents: Read and write** untuk repository ini, lalu publish folder proyek ini ke branch `main`.

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
6. Setelah deploy, buka URL tersebut lalu login ke SISIP Studio untuk mengimpor sample atau mulai mengisi katalog asli.

Tidak ada environment variable rahasia yang dibutuhkan pada frontend ini. Supabase RLS yang membatasi akses tulis, bukan penyembunyian key browser.

## 3. Supabase Auth untuk member dan admin

Di Supabase Dashboard, buka **Authentication → URL Configuration**:

- Isi Site URL dengan URL `pages.dev` yang sudah jadi.
- Tambahkan URL tersebut pada Redirect URLs.
- Tambahkan domain custom nanti jika sudah punya.
- Di **Authentication → Providers → Email**, aktifkan email sign-up. Untuk website live, aktifkan juga konfirmasi email.

Member dapat membuat akun sendiri untuk menyimpan preferensi dan request outfit. Akun admin tetap ditentukan oleh email `albarifirdaus209@gmail.com` dan diperiksa ulang oleh RLS di database.

## 4. Cek sebelum live

- Admin Auth untuk `albarifirdaus209@gmail.com` sudah dibuat dan berhasil login.
- Ganti sample link dengan affiliate link Shopee asli.
- Cek harga referensi dan tanggal kurasi.
- Isi minimal satu artikel jika Journal ingin tampil di cloud.
- Coba satu akun member: simpan preferensi, kirim Request Outfit, lalu balas lewat **SISIP Studio → Requests**.
- Aktifkan leaked-password protection di Supabase Auth bila tersedia di paketmu.
