# Roadmap Produk COMOOTD

Dokumen ini adalah acuan tunggal untuk roadmap **8 fase** dan **6 milestone**.
Pekerjaan bergerak fase demi fase; milestone hanya menjadi checkpoint hasil.

## Aturan eksekusi

1. Satu fase aktif pada satu waktu.
2. Fase berikutnya tidak dimulai sebelum scope fase aktif diuji dan disetujui.
3. Pekerjaan yang memerlukan layanan berbayar, upgrade paket, API berbayar,
   atau potensi tagihan baru harus berhenti sebelum aktivasi dan meminta
   persetujuan pemilik COMOOTD.
4. Staging Supabase terpisah ditunda sampai pemilik menyetujui biayanya.
5. Selama website belum diluncurkan resmi, rilis dapat masuk langsung ke
   production hanya melalui checklist sementara di
   [PRODUCTION_RELEASE_CHECKLIST.md](PRODUCTION_RELEASE_CHECKLIST.md).

## Delapan fase

| Fase | Fokus | Status |
| --- | --- | --- |
| 1 | Pemisahan staging dan production | **Aktif sebagian** — production safety tanpa biaya dikerjakan; Supabase staging ditunda |
| 2 | Restrukturisasi kode menjadi pages, components, features, admin, dan services | **Selesai penuh** — Batch A–C terpisah, diuji, dan dapat di-rollback per deployment |
| 3 | Homepage editorial storefront dan navigasi responsif | **Selesai** — storefront editorial, urutan homepage, dan navigasi responsif sudah terverifikasi |
| 4 | Analytics, attribution, dashboard curator dan admin | **Selesai** — event production, attribution sesi, UTM builder, tren, dashboard role-scoped, dan leaderboard internal terverifikasi |
| 5 | Retention dan personalisasi: save, collection, follow, recently viewed, feed | **Selesai** — state privat, RLS, koleksi member, follow Curator, riwayat, dan ranking feed terverifikasi |
| 6 | Moderasi dan pengajuan curator | **Selesai** — pengajuan terkontrol, approval admin, trust level, suspensi, dan notifikasi privat terverifikasi |
| 7 | Link health dan multi-marketplace | Sebagian fondasi sudah tersedia; audit formal menunggu fase sebelumnya |
| 8 | Privacy Center, Terms, consent, penghapusan akun, dan keamanan data | Halaman dasar tersedia; fitur privacy center belum dimulai |

Status "sebagian tersedia" tidak berarti fase tersebut selesai. Implementasi
lama akan diaudit ketika urutan fase sampai ke sana agar tidak ada pekerjaan
yang diduplikasi atau terlewat.

## Enam milestone

| Milestone | Hasil yang menjadi checkpoint |
| --- | --- |
| 1 — Platform Safety | Environment, refactor dasar, rollback, QA otomatis, Privacy dan Terms dasar |
| 2 — Measurement | Analytics events, UTM link generator, dashboard curator/admin, leaderboard internal |
| 3 — Engagement | Save, collections, follow, personal feed, notification center |
| 4 — Content Trust | Pengajuan curator, trust level, reporting, link-health, dan moderasi admin |
| 5 — Commerce Expansion | Multi-destination product, platform tambahan, replacement product, sponsored collection |
| 6 — Public Beta | Curator dan konten terpilih, monitoring SEO/analytics, pengujian retention dan CTR |

## Fase 1 — status kerja

### Fase 1A: tanpa biaya — aktif

- Production tetap berasal dari branch `main`.
- Cloudflare production dan Supabase production tetap menjadi resource aktif.
- Quality gate otomatis dan checklist rilis wajib dijalankan.
- Cloudflare deployment sebelumnya menjadi jalur rollback frontend.
- Perubahan database harus forward-only, terarsip sebagai migration, dan
  diverifikasi dengan query setelah penerapan.
- Preview UI tidak boleh menulis ke database production.

### Fase 1B: memerlukan resource staging — ditunda

- Branch integrasi `develop`.
- Cloudflare staging dengan `APP_ENV=staging` dan `noindex`.
- Proyek Supabase staging terpisah berisi akun serta data uji.
- Pengujian migration sebelum promosi ke production.

Fase 1 baru dapat ditandai selesai penuh setelah Fase 1B disetujui dan aktif.

## Fase 2 — selesai

- CSS dan JavaScript aplikasi tidak lagi tertanam di `index.html`.
- Aset dipisahkan berdasarkan tanggung jawab ke `pages`, `core`, `components`,
  `features`, `admin`, `services`, `styles`, dan `vendor`.
- Supabase menjadi satu pintu akses data; komponen visual tidak menjalankan
  query database langsung.
- Parser serta validator bulk import admin dan renderer media katalog memiliki
  pemeriksaan modul terisolasi.
- Quality gate memverifikasi urutan dependency, referensi aset, syntax,
  keamanan, route Worker, dan fitur lama.
- Production sudah diuji tanpa overflow pada ponsel dan dengan empat kolom Look
  pada desktop.
- Tidak ada framework, API, dependency, atau resource berbayar baru.

`home.js` tetap menjadi orkestrator halaman selama migrasi bertahap. Ekstraksi
panel lain boleh dilanjutkan sebagai maintenance internal setelah kontrak state
dan event stabil, tanpa menahan dimulainya Fase 3.

## Fase 5 — selesai

- Member dapat menyimpan Look dan produk ke koleksi utama **Disimpan**.
- Member dapat membuat koleksi tambahan, menambahkan item ke koleksi pilihan,
  menghapus item, dan menghapus koleksi non-default dari profil.
- Profil Curator memiliki aksi follow; daftar Curator yang diikuti hanya dapat
  dibaca oleh akun pemilik.
- Look, produk, dan Curator yang dibuka masuk ke riwayat privat, dibatasi pada
  40 item terakhir.
- Feed personal menggabungkan preferensi profil, item tersimpan, Curator yang
  diikuti, dan pola style dari riwayat. Data aktivitas tidak pernah dipublikasikan.
- Empat tabel retention memakai RLS owner-only dan privilege eksplisit.
  Operasi RPC berjalan sebagai invoker; tes transaksi role `authenticated`
  untuk save, follow, dan history lulus tanpa meninggalkan data uji.
- UI lolos pemeriksaan desktop 1440 px dan ponsel 390 px tanpa overflow.
- Tidak ada layanan, API, dependency, atau resource berbayar baru.

Notification center pada Milestone 3 diselesaikan bersama Fase 6 agar sumber
event moderasi dan hak akses privatnya menggunakan satu sistem yang sama.

## Fase 6 — selesai

- Akun member tidak dapat lagi mengaktifkan role Curator secara mandiri.
- Pengajuan Curator memuat identitas publik, tag profil, kontak, tautan sosial,
  portofolio, dan alasan pengajuan; statusnya hanya dapat dibaca pemohon atau admin.
- Admin dapat menyetujui atau menolak pengajuan, memberikan catatan, menentukan
  kuota, dan menetapkan trust level `emerging`, `verified`, atau `editorial`.
- Approval membuat role serta profil Curator secara atomik; penolakan tidak
  memberikan akses publik dan dapat diajukan ulang setelah diperbaiki.
- Moderasi Curator aktif mencakup perubahan trust level, kuota, serta suspensi.
- Notification center privat memberi tahu hasil pengajuan dan perubahan akses.
- Tabel baru memakai RLS, privilege eksplisit, indeks foreign key, dan satu
  policy read gabungan. Implementasi berprivilege berada di schema privat;
  RPC publik berjalan sebagai invoker dan tidak dapat dipanggil akun anonim.
- Tes transaksi member → admin → member untuk submit, approval, aktivasi,
  notifikasi, mark-as-read, withdraw, serta rollback berhasil.
- Tidak ada layanan, API, dependency, atau resource berbayar baru.
