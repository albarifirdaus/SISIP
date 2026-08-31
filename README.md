# COMOOTD — platform kurasi fashion Indonesia

COMOOTD adalah platform kurasi fashion all-gender untuk Indonesia: satu Look berisi 2–5 produk, dapat dibuat oleh COMOOTD atau curator, dibagikan melalui URL khusus, dan dihubungkan ke marketplace.

## Yang sudah siap

- Katalog responsive: pencarian, filter style/gender/marketplace, urutan, detail look, link Shopee atau TikTok Shop, dan Journal.
- **SISIP Studio**: login admin, tambah produk + varian warna, tambah look, unggah gambar hingga 5 MB ke Supabase Storage, serta hapus data yang tidak dipakai look lain.
- **New Series**: carousel beranda hingga lima look, lengkap dengan urutan yang dapat dipilih dari tab **New Series** di SISIP Studio.
- **Akun member**: masuk dengan Google atau daftar/masuk dengan email, lalu pilih hingga 10 tag style, gender preferensi, serta budget. Preferensi hanya dapat dibaca oleh pemilik akun dan admin.
- **Untuk Kamu**: look dan produk published diurutkan dari kecocokan tag style, gender preferensi, dan budget—tanpa AI atau data pihak ketiga.
- **Request Outfit**: member yang sudah masuk dapat mengirim brief langsung ke antrean **SISIP Studio → Requests**. Admin dapat membalas, menyimpan catatan internal, dan memilih hingga enam Look/produk published sebagai jawaban.
- Data cloud Supabase dengan Row Level Security: publik hanya dapat membaca konten published; hanya `albarifirdaus209@gmail.com` yang dapat mengelola data.
- Tombol untuk mengimpor 12 look/produk sample ke cloud. Data sample ini dapat dihapus lagi dari Studio.
- Prototype lokal tetap tersedia bila konfigurasi cloud dihapus/dikosongkan.

## Menjalankan lokal

`index.html` dapat dibuka langsung untuk melihat prototype. Untuk menguji login/cloud dengan lebih konsisten, jalankan lewat static server lokal atau hosting statis karena aplikasi memuat Supabase dari CDN.

`config.js` sengaja dilacak di Git: isinya hanya URL proyek dan **publishable key** Supabase, yang memang aman tampil di browser saat RLS aktif. Jangan pernah menaruh `service_role`, password database, atau credential Shopee di file ini.

## Pengaturan Auth sebelum live

Di Supabase Dashboard:

1. Buka **Authentication → Users → Add user**.
2. Buat user `albarifirdaus209@gmail.com` dengan password yang hanya kamu tahu.
3. Pastikan provider **Email** aktif dan **Allow new users to sign up** diaktifkan, karena pengunjung akan membuat akun SISIP sendiri.
4. Untuk live, aktifkan konfirmasi email. Di **Authentication → URL Configuration**, set Site URL ke `https://sisip-fashion.pages.dev` dan izinkan `https://sisip-fashion.pages.dev/**` pada Redirect URLs.
5. Untuk mengubah nama yang terlihat di subject/isi email, buka **Authentication → Email Templates → Confirm signup** dan gunakan, misalnya, `Konfirmasi akun SISIP`. Nama pengirim branded `SISIP` memerlukan Custom SMTP serta domain email yang diverifikasi.
6. Buka website, klik ikon Studio kanan atas, lalu masuk dengan akun admin tersebut.

Untuk Google Login, aktifkan provider **Google** di Supabase dan gunakan callback `https://rbvrlfmsvmwjkisbwuim.supabase.co/auth/v1/callback`. Client Secret hanya disimpan di Google Cloud dan Supabase Dashboard; jangan menaruhnya di repository.

Profil dan baris preferensi dibuat otomatis oleh trigger saat akun Auth dibuat. Password tidak pernah tersimpan di file proyek atau GitHub.

## Struktur data

```text
products (1 affiliate link Shopee atau TikTok Shop)
  └─ product_variants (warna / foto warna)
       └─ look_items
            └─ looks (2–5 item)
```

Harga adalah harga referensi yang dapat diedit saat kurasi. Mengambil harga/nama otomatis dari halaman marketplace tidak diaktifkan karena harus memakai API/feed affiliate resmi, bukan scraping browser.

## Mengatur New Series

1. Pastikan sedikitnya lima look sudah berstatus published dan terlihat di katalog.
2. Masuk ke **SISIP Studio → New Series**.
3. Pilih lima look yang berbeda untuk slot 01–05, lalu pilih **Simpan 5 look**.

Pengaturan tersimpan di Supabase dan langsung mengubah carousel beranda. Jika belum ada lima look published, beranda tetap menampilkan look yang tersedia; tombol simpan akan aktif setelah lima look siap.

## Request outfit dan rekomendasi personal

Form request tidak menyimpan draft lokal lagi. Pengunjung harus masuk terlebih dahulu, lalu database mengikat request ke sesi Auth mereka—ID, nama, email, status, serta data respons tidak dapat ditentukan dari form browser. Ini membuat form tetap sederhana dan menghindari antrean anonim.

Di Studio, buka tab **Requests** untuk mengubah status, menulis jawaban yang terlihat member, menambahkan catatan internal, dan memilih Look/produk yang sudah published. Saat status menjadi **Rekomendasi siap** atau **Selesai**, jawabannya muncul di profil member.

Rekomendasi pada bagian **Untuk Kamu** dihitung di browser dari data katalog published. Artinya kamu cukup menjaga tag style, gender, dan harga katalog tetap rapi; tidak ada biaya API AI tambahan.

## Deploy

Lihat [DEPLOY.md](DEPLOY.md) untuk langkah GitHub dan hosting. Untuk katalog affiliate live, gunakan host yang mengizinkan penggunaan komersial/affiliate; proyek ini siap untuk hosting static seperti Cloudflare Pages.

Roadmap dan dokumen operasional:

- [Roadmap 8 fase dan 6 milestone](docs/ROADMAP.md)
- [Checklist rilis production sementara](docs/PRODUCTION_RELEASE_CHECKLIST.md)
- [Environment staging dan production](docs/ENVIRONMENTS.md)
- [Alur rilis](docs/RELEASE_WORKFLOW.md)
- [Rollback dan pemulihan](docs/ROLLBACK.md)
- [Tata kelola data](docs/DATA_GOVERNANCE.md)
- [Milestone 2: analytics dan link health](docs/MILESTONE_2.md)
- [Milestone 3: discovery, marketplace, dan SEO](docs/MILESTONE_3.md)

Jalankan `npm run release:check` sebelum setiap rilis. Quality gate yang sama
dijalankan otomatis untuk branch `develop`, `main`, dan pull request.

## Supabase

Dokumentasi migration dan keamanan ada di [supabase/README.md](supabase/README.md). Proyek Supabase yang terhubung sudah memiliki migration awal, hardening, dan izin function.


