# Fase 7 — Link Health dan Multi-marketplace

## Output

Fase ini mengubah satu link affiliate menjadi kumpulan tujuan marketplace pada
satu entitas produk. Produk dan item Curator tetap hanya muncul satu kali di
katalog, sementara pengunjung dapat memilih Shopee atau TikTok Shop pada detail.

## Alur pengguna

1. Admin atau Curator memasukkan link utama dan, bila ada, link marketplace kedua.
2. Website menyimpan tepat satu tujuan utama dan maksimal satu tujuan tambahan.
3. Pengunjung membuka tujuan yang diinginkan atau memilih **Laporkan link**.
4. Laporan memberi status perlu diperiksa dan membuat notifikasi privat.
5. Pemilik/admin mengganti link, menonaktifkannya, menyelesaikan, atau mengabaikan.
6. Perubahan penting disimpan dalam riwayat privat untuk audit.

## Batasan yang disengaja

- Marketplace awal hanya Shopee dan TikTok Shop.
- Harga, foto, varian, dan stok tetap data manual; tidak ada scraping atau AI API.
- Maksimal dua tujuan mencegah form terlalu rumit dan duplikasi link.
- Link berstatus nonaktif tidak ditampilkan kepada pengunjung.
- Riwayat hanya terlihat oleh pemilik terkait atau admin.

## Database

Migration: `20260901100000_comootd_phase7_link_health.sql`

- `product_marketplace_links`: tujuan produk katalog.
- `curator_item_marketplace_links`: tujuan produk di Look Curator.
- `comootd_marketplace_link_history`: audit privat tindakan link.
- `set_comootd_marketplace_links`: menyimpan dan memvalidasi tujuan.
- `report_comootd_link`: membuat laporan dan notifikasi.
- `resolve_comootd_link_report`: shortcut update/disable/resolve/dismiss.

Kolom `affiliate_url`, `affiliate_platform`, dan `link_status` yang lama tetap
disinkronkan dengan tujuan utama supaya fitur lama tetap kompatibel.

## Gate sebelum selesai

- Terapkan migration ke project production setelah persetujuan pemilik.
- Uji transaksi member, Curator, dan admin lalu rollback data uji.
- Jalankan database security/performance advisors.
- Rilis frontend hanya setelah schema baru berhasil diverifikasi.
- Uji detail produk/Look dan dashboard pada desktop serta ponsel.

Implementasi ini tidak mengaktifkan layanan berbayar baru.
