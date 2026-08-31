# Fase 4 — Analytics dan Attribution

## Output

- Event production untuk page view, view Look, view profil curator, klik produk,
  dan share.
- Attribution first-touch selama satu sesi browser: source, referrer domain,
  `utm_source`, `utm_medium`, dan `utm_campaign`.
- Klik produk dari detail Look dikreditkan ke Look dan curator pemiliknya.
- Dashboard curator hanya membaca agregat miliknya.
- Dashboard admin menampilkan agregat platform dan curator dengan traffic
  tertinggi.
- Rentang 7/30/90 hari, KPI, tren harian, sumber, medium, campaign, dan pembuat
  link UTM tersedia pada desktop maupun ponsel.

## Privacy boundary

Tidak ada IP, user-agent, URL referrer lengkap, fingerprint, atau identifier
lintas sesi. Tabel event memakai RLS, tidak mempunyai grant baca langsung, dan
hanya dapat ditulis melalui RPC tervalidasi. UUID sesi disimpan di
`sessionStorage` dan berakhir bersama sesi tab browser.

## Verifikasi production

- Migration analytics terdaftar di Supabase production.
- RLS aktif dan grant langsung untuk `anon`/`authenticated` kosong.
- Jumlah event tetap utuh setelah hardening.
- Security dan performance advisor dijalankan setelah DDL.
- Release check frontend wajib lulus sebelum deploy.

## Batasan yang diterima

Analytics publik tidak dimaksudkan sebagai sistem anti-fraud absolut. Rate
limit per sesi dan validasi target mencegah loop/traffic salah yang umum, tetapi
bot yang sengaja mengganti session UUID tetap memerlukan proteksi edge di masa
depan. Aktivasi layanan berbayar untuk proteksi tersebut wajib meminta
persetujuan pemilik COMOOTD terlebih dahulu.
