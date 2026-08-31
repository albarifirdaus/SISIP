# Fase 3 — Editorial Storefront

Fase ini mengubah homepage dari rangkaian katalog panjang menjadi pintu masuk
editorial. Seluruh data katalog, personalisasi, Studio, dan directory tetap
memakai sistem yang sudah ada; yang diubah adalah urutan informasi dan cara
pengunjung memilih jalur eksplorasi.

## Arsitektur informasi homepage

1. Hero dan New Series memperkenalkan identitas serta pilihan terbaru.
2. Explore the Wardrobe System memberi empat pintu utama: Looks, Products,
   Curators, dan Journal.
3. Match Your Vibe membantu eksplorasi berdasarkan style.
4. Trending Looks, High-Rotation Products, Curators, dan Journal menjadi
   highlight isi masing-masing directory.
5. Tailored for You ditempatkan setelah pengunjung memahami katalog, lalu
   memakai profil member untuk rekomendasi personal.
6. Request dan About menjadi jalur layanan serta informasi brand.

## Navigasi responsif

- Desktop mempertahankan navigasi ringkas dengan state hover/focus yang jelas.
- Ponsel memakai empat kartu utama untuk directory dan kelompok tautan sekunder
  untuk Styles, Request, dan About.
- Skip link tersedia untuk pengguna keyboard dan pembaca layar.
- Layout storefront memakai dua kolom pada tablet dan satu kolom pada ponsel
  sempit agar tidak menimbulkan horizontal overflow.

## Batas fase

Fase 3 tidak menambah vendor, API, database, atau layanan berbayar. Perubahan
berada di presentation layer dan tidak mengubah data produksi.
