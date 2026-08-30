# Milestone 2 — Measurement dan Link Health

## Tujuan

Memberi COMOOTD dan curator sinyal pertumbuhan yang berguna tanpa membangun sistem pelacakan invasif, sekaligus membuat laporan link produk dapat ditangani oleh pemilik konten.

## Event yang dihitung

- Page view platform
- View Look
- View profil curator
- Klik keluar menuju produk
- Share Look dan produk

Event tidak menyimpan IP, user-agent, atau URL referrer lengkap. Browser memakai UUID sesi sementara di `sessionStorage`; database menyimpan domain sumber serta UTM bila tersedia.

## Hak dashboard

- Curator: hanya agregat event yang memiliki `owner_id` miliknya.
- Admin: agregat platform dan daftar curator dengan traffic tertinggi.
- User biasa dan publik: tidak mempunyai akses baca ke tabel event.

Dashboard menyediakan rentang 7, 30, dan 90 hari, KPI utama, konten teratas, sumber traffic, serta laporan link terbuka.

## Link health

User yang login dapat melaporkan link rusak, produk berbeda, stok habis, selisih harga, link tidak aman, atau masalah lain. Laporan diarahkan ke curator pemilik item; laporan produk COMOOTD masuk ke admin.

Pemilik dapat:

- memperbarui URL;
- menonaktifkan link/produk;
- menandai laporan selesai;
- mengabaikan laporan yang tidak valid.

## Urutan deployment

1. Terapkan migration `20260830193000_comootd_analytics_and_link_health.sql` pada Supabase staging.
2. Jalankan advisor keamanan dan performa.
3. Deploy branch ke Cloudflare staging.
4. Uji sebagai publik, member, curator, dan admin.
5. Setelah lolos, migration diterapkan ke production sebelum frontend Milestone 2 dirilis.

Jangan deploy frontend ini lebih dulu ke production karena query katalog sudah mengenali kolom `link_status` baru.
