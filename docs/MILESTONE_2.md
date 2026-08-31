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

Dashboard menyediakan rentang 7, 30, dan 90 hari, KPI utama, tren harian,
konten teratas, sumber traffic, medium, campaign, serta laporan link terbuka.
Curator dan admin juga memiliki pembuat link UTM internal untuk menandai traffic
dari Instagram, TikTok, WhatsApp, newsletter, dan campaign lain.

Attribution awal disimpan hanya selama tab/sesi browser aktif. Klik produk yang
berasal dari detail Look dikreditkan ke Look dan curator tersebut, sementara
klik dari katalog produk tetap dihitung sebagai traffic produk platform.

## Link health

User yang login dapat melaporkan link rusak, produk berbeda, stok habis, selisih harga, link tidak aman, atau masalah lain. Laporan diarahkan ke curator pemilik item; laporan produk COMOOTD masuk ke admin.

Pemilik dapat:

- memperbarui URL;
- menonaktifkan link/produk;
- menandai laporan selesai;
- mengabaikan laporan yang tidak valid.

## Status deployment

Fondasi measurement, hardening kontrak event, agregasi attribution, dan indeks
maintenance sudah diterapkan ke Supabase production. Frontend dirilis langsung
ke production melalui checklist sementara karena staging berbayar masih ditunda.

Peringatan advisor tentang tabel event tanpa policy adalah kondisi yang sengaja:
RLS aktif dan semua grant langsung dicabut sehingga event tidak dapat dibaca
publik. RPC `record_comootd_analytics_event` sengaja dapat dipanggil pengunjung,
tetapi memvalidasi pasangan event/target, target published, duplikasi cepat, dan
batas event per sesi. RPC dashboard tetap memeriksa role curator/admin di dalam
fungsi.
