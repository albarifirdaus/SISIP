# Rollback dan Pemulihan

## Gangguan frontend

1. Hentikan rilis lanjutan.
2. Di Cloudflare Pages, pilih deployment production terakhir yang terverifikasi sehat lalu lakukan rollback.
3. Uji home, direktori, detail Look, login, dan Studio.
4. Dokumentasikan penyebab dan perbaiki di staging; jangan menambal production secara langsung.

## Gangguan database

1. Jangan menjalankan migrasi balik yang menghapus data secara spontan.
2. Nonaktifkan fitur yang menulis ke tabel terdampak bila diperlukan.
3. Identifikasi migration dan tabel yang berubah.
4. Pulihkan dari backup yang sudah diverifikasi atau buat migration perbaikan yang forward-only.
5. Validasi RLS setelah pemulihan dengan akun publik, user, curator, dan admin.

## Sebelum perubahan berisiko

- Simpan schema/migration yang sedang aktif.
- Ekspor data penting yang akan disentuh.
- Pastikan salinan backup dapat dibaca.
- Tentukan deployment Cloudflare tujuan rollback.
- Tetapkan siapa yang mengambil keputusan pemulihan.

Jangan menyimpan backup berisi data pribadi di repository Git.
