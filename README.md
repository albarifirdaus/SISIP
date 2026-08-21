# SISIP — curated fashion affiliate catalogue

SISIP adalah katalog fashion all-gender untuk Indonesia: satu look berisi 2–5 produk, setiap produk memiliki satu link affiliate Shopee, dan warna/varian dapat dipakai ulang di look yang berbeda.

## Yang sudah siap

- Katalog responsive: pencarian, filter style/gender, urutan, detail look, link Shopee, dan Journal.
- **SISIP Studio**: login admin, tambah produk + varian warna, tambah look, unggah gambar hingga 5 MB ke Supabase Storage, serta hapus data yang tidak dipakai look lain.
- Data cloud Supabase dengan Row Level Security: publik hanya dapat membaca konten published; hanya `albarifirdaus209@gmail.com` yang dapat mengelola data.
- Tombol untuk mengimpor 12 look/produk sample ke cloud. Data sample ini dapat dihapus lagi dari Studio.
- Prototype lokal tetap tersedia bila konfigurasi cloud dihapus/dikosongkan.

## Menjalankan lokal

`index.html` dapat dibuka langsung untuk melihat prototype. Untuk menguji login/cloud dengan lebih konsisten, jalankan lewat static server lokal atau hosting statis karena aplikasi memuat Supabase dari CDN.

`config.js` sengaja dilacak di Git: isinya hanya URL proyek dan **publishable key** Supabase, yang memang aman tampil di browser saat RLS aktif. Jangan pernah menaruh `service_role`, password database, atau credential Shopee di file ini.

## Satu langkah admin yang masih perlu dilakukan

Database dan konfigurasi aplikasi sudah terhubung, tetapi akun Auth untuk email admin belum ada. Di Supabase Dashboard:

1. Buka **Authentication → Users → Add user**.
2. Buat user `albarifirdaus209@gmail.com` dengan password yang hanya kamu tahu.
3. Untuk pengujian cepat, konfirmasi emailnya dari dashboard; untuk live, gunakan alur verifikasi email biasa.
4. Pastikan provider Email aktif dan nonaktifkan public sign-ups bila hanya satu admin yang diperlukan.
5. Buka website, klik ikon Studio kanan atas, lalu masuk dengan akun tersebut.

Profil admin dibuat otomatis oleh trigger saat user dibuat. Password tidak pernah tersimpan di file proyek atau GitHub.

## Struktur data

```text
products (1 affiliate link Shopee)
  └─ product_variants (warna / foto warna)
       └─ look_items
            └─ looks (2–5 item)
```

Harga adalah harga referensi yang dapat diedit saat kurasi. Mengambil harga/nama otomatis dari halaman Shopee tidak diaktifkan karena harus memakai API/feed affiliate resmi, bukan scraping browser.

## Request outfit publik

Form request sengaja masih menyimpan draft lokal. Sebelum dibuat live, form perlu Edge Function + CAPTCHA/rate limiting agar tidak menjadi jalur spam. Email tujuan dapat memakai `albarifirdaus209@gmail.com` pada tahap itu.

## Deploy

Lihat [DEPLOY.md](DEPLOY.md) untuk langkah GitHub dan hosting. Untuk katalog affiliate live, gunakan host yang mengizinkan penggunaan komersial/affiliate; proyek ini siap untuk hosting static seperti Cloudflare Pages.

## Supabase

Dokumentasi migration dan keamanan ada di [supabase/README.md](supabase/README.md). Proyek Supabase yang terhubung sudah memiliki migration awal, hardening, dan izin function.

