# Tata Kelola Data COMOOTD

## Peran dan akses

- Publik: hanya membaca konten berstatus published dan profil curator publik.
- User: mengelola profil serta preferensi miliknya, like, dan request miliknya.
- Curator: mengelola profil serta Look yang dimilikinya sesuai kuota.
- Admin: moderasi, taxonomy, katalog COMOOTD, akun curator, dan operasional platform.

Semua batas akses harus dipaksakan oleh Row Level Security; menyembunyikan tombol di UI bukan mekanisme keamanan.

## Klasifikasi

- Publik: Look published, profil curator publik, artikel, katalog produk.
- Internal: status moderasi, laporan tautan, metrik dashboard, catatan operasional.
- Pribadi: email, provider login, preferensi user, request outfit.
- Rahasia: service role, password database, OAuth Client Secret, SMTP credential.

## Prinsip

1. Ambil data sesedikit yang dibutuhkan.
2. Minta consent terpisah sebelum memakai email untuk marketing.
3. Beri jalan untuk koreksi dan penghapusan data melalui `comootd@gmail.com`.
4. Jangan menyalin data production ke staging.
5. Audit policy database ketika tabel atau role berubah.
6. Tautan dan konten milik curator tetap dapat dimoderasi untuk keamanan platform.
