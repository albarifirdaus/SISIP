# Checklist Rilis Production Sementara

Checklist ini dipakai selama COMOOTD belum diluncurkan resmi dan Supabase
staging terpisah masih ditunda. Alur ini tidak menggantikan staging permanen.

## Gerbang biaya

- [ ] Tidak ada layanan, API, domain, add-on, atau upgrade berbayar baru.
- [ ] Jika ada potensi biaya, pekerjaan berhenti sebelum aktivasi dan sudah
      memperoleh persetujuan pemilik COMOOTD.

## Sebelum perubahan

- [ ] Scope hanya mencakup fase yang sedang aktif.
- [ ] Target rollback frontend adalah deployment Cloudflare terakhir yang sehat.
- [ ] Migration database bersifat forward-only dan tidak menghapus data.
- [ ] Data pada tabel yang terdampak perubahan berisiko sudah diekspor secara
      manual ke lokasi privat, bukan repository.

## Quality gate

- [ ] Jalankan `npm run release:check`.
- [ ] Tidak ada credential rahasia di frontend atau commit.
- [ ] Uji ukuran 360, 390, 430, 768, 1024, dan 1440 px bila UI berubah.
- [ ] Uji login, halaman publik, Look, produk, dan Studio bila alurnya terdampak.
- [ ] Perubahan database sudah diverifikasi dengan query hasil dan advisor.

## Urutan rilis

1. Commit pada branch kerja.
2. Jalankan quality gate lokal.
3. Review diff dan migration.
4. Terapkan migration production hanya jika diperlukan.
5. Verifikasi migration dengan query read-only.
6. Push non-force ke `main`.
7. Tunggu Cloudflare Pages berstatus `success`.
8. Verifikasi production pada desktop dan ponsel.

## Setelah rilis

- [ ] Catat commit dan deployment production.
- [ ] Pastikan tidak ada error baru pada alur yang berubah.
- [ ] Jika gagal, hentikan perubahan lanjutan dan ikuti [ROLLBACK.md](ROLLBACK.md).

