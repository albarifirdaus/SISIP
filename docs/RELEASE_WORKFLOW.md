# Alur Rilis COMOOTD

> Alur normal di bawah adalah target setelah staging diaktifkan. Selama staging
> masih ditunda, gunakan [PRODUCTION_RELEASE_CHECKLIST.md](PRODUCTION_RELEASE_CHECKLIST.md).

## Jalur normal

1. Buat branch fitur dari `develop`.
2. Jalankan `npm test` dan review tampilan desktop serta ponsel.
3. Buka preview deployment; gunakan akun dan data staging.
4. Gabungkan ke `develop` setelah quality gate lulus.
5. Uji alur kritis di staging: login, katalog publik, upload/crop, publish Look, link produk, like, dan halaman detail.
6. Catat deployment Cloudflare production terakhir yang sehat dan buat backup database sebelum migrasi berisiko.
7. Gabungkan `develop` ke `main` melalui pull request.
8. Verifikasi production dan pantau error setelah rilis.

Perubahan langsung melalui editor GitHub pada `main` tidak dipakai lagi untuk rilis rutin.

## Checklist persetujuan production

- Quality gate hijau.
- Tidak ada credential rahasia dalam perubahan.
- Staging menggunakan proyek Supabase staging.
- Migrasi bersifat additive atau mempunyai rencana pemulihan.
- Desktop 1440 px, tablet 768 px, serta ponsel 390/430 px telah diuji.
- Login Google/email dan redirect kembali ke domain yang benar.
- Konten publik dapat dibaca saat logout.
- Halaman Privacy, Terms, About, dan kebijakan dapat dibuka.
- Owner rilis dan waktu rilis dicatat.
