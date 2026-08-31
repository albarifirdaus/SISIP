# Fase 6 — Moderasi dan Pengajuan Curator

Fase 6 mengganti aktivasi Curator instan dengan alur yang dapat diaudit:

1. Member mengirim pengajuan dari halaman Curator.
2. Pengajuan masuk ke antrean privat COMOOTD Studio.
3. Admin meninjau point of view, referensi, dan autentisitas pemohon.
4. Approval mengaktifkan profil, kuota, serta trust level; penolakan menyimpan
   catatan yang dapat digunakan pemohon untuk memperbaiki pengajuan.
5. Keputusan muncul pada notification center pemilik akun.

## Keamanan

- Self-activation Curator dicabut pada level database.
- Data pengajuan dan notifikasi dilindungi RLS owner/admin.
- Fungsi berprivilege berada di schema `private` dan memeriksa `auth.uid()` serta
  role admin pada setiap operasi sensitif.
- Endpoint RPC publik hanya wrapper `security invoker`, tanpa akses anonim.
- Semua pengujian operasi production memakai transaction rollback.

## Biaya

Fase ini memakai resource Supabase yang sudah aktif. Tidak ada produk berbayar,
API eksternal, atau upgrade paket baru.
