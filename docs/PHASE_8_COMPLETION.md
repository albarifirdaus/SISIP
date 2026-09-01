# Fase 8 — Privacy Center dan Keamanan Data

## Output

Fase 8 memberi pengguna kontrol nyata atas pemrosesan data opsional tanpa
menghambat fungsi dasar katalog dan akun COMOOTD.

## Pilihan privasi

- Analytics minim data: nonaktif sampai pengunjung memberi izin.
- Riwayat aktivitas untuk rekomendasi: nonaktif sampai pengguna memberi izin.
- Preferensi style yang sengaja disimpan tetap digunakan sebagai fungsi akun
  yang diminta pengguna, terpisah dari tracking perilaku.
- Pilihan pengunjung disimpan pada browser; pilihan member dapat disinkronkan ke
  akun untuk digunakan lintas perangkat.

## Hak pengguna

- Mengubah pilihan di Privacy Center.
- Mengunduh data akun sebagai JSON.
- Menghapus akun member secara permanen dengan mengetik `HAPUS AKUN`.
- Menghubungi `comootd@gmail.com` untuk penanganan akun Curator/Admin yang
  memiliki konten publik atau tanggung jawab operasional.

## Keamanan

- `comootd_privacy_preferences` memakai RLS owner-only dan privilege eksplisit.
- `export_my_comootd_data()` berjalan sebagai `security invoker` dan hanya
  diberikan kepada role `authenticated`.
- Edge Function `delete-account` memerlukan JWT, memverifikasi pengguna ke Auth,
  melindungi akun Admin/Curator, dan baru memakai Admin API pada server.
- Service-role key tidak pernah berada di frontend.
- Penghapusan nyata tidak dijalankan saat QA; validasi dilakukan pada guard,
  deployment status, RLS, privilege, dan transaksi rollback.

## Verifikasi

- Pemilik dapat membaca/menulis preferensi miliknya.
- Baris akun lain tidak terlihat oleh pemilik.
- Role anonim tidak dapat membaca tabel atau menjalankan ekspor.
- Ekspor mengembalikan ID profil pemanggil.
- Seluruh data uji ter-rollback.
- Quality gate aplikasi dan pemeriksaan syntax lulus.

Tidak ada layanan atau paket berbayar baru yang diaktifkan.
