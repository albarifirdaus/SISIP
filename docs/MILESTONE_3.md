# Milestone 3 — Discovery, marketplace, dan SEO

Milestone ini dikerjakan di branch `milestone-3-discovery-seo`. Production tidak berubah sampai migration dan build branch ini dipromosikan melalui alur staging.

## Hasil

- Produk admin dan item kurasi curator mendukung **Shopee** serta **TikTok Shop**.
- Marketplace diturunkan dan divalidasi ulang dari hostname URL di database; label dari browser tidak dipercaya begitu saja.
- Direktori produk memiliki filter marketplace dan CTA menampilkan marketplace tujuan.
- Explore by Mood menautkan landing page style seperti `/styles/clean`.
- Landing page style memiliki title, description, canonical, breadcrumb JSON-LD, dan masuk sitemap dinamis.
- Schema Organization menyertakan akun Instagram resmi COMOOTD.
- Staging tetap mengirim `noindex, nofollow, noarchive`.

## Urutan rilis ke staging

1. Jalankan migration `20260831090000_comootd_multi_marketplace.sql` pada proyek Supabase staging.
2. Deploy branch ini ke Cloudflare Pages staging dengan `APP_ENV=staging`.
3. Uji buat/edit produk Shopee dan TikTok Shop, buat look curator, filter marketplace, laporan link, serta `/styles/<nama-style>`.
4. Jalankan `npm test` dan pastikan staging masih noindex.
5. Promosikan ke production hanya setelah checklist rilis disetujui.

Frontend bergantung pada kolom dan RPC baru dalam migration tersebut. Karena itu migration harus diterapkan sebelum build frontend.
