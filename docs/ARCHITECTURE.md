# Arsitektur Frontend COMOOTD

Dokumen ini menetapkan batas struktur untuk Fase 2. Migrasi dilakukan bertahap
tanpa mengganti framework, tanpa layanan baru, dan tanpa mengubah perilaku
publik hanya demi merapikan kode.

## Struktur saat ini

```text
index.html                         shell dan markup halaman utama
assets/
  pages/
    home.css                       presentasi khusus halaman utama
    home.js                        orkestrasi state dan tampilan halaman utama
  components/
    image-cropper.js               komponen crop gambar yang dapat dipakai ulang
  features/
    curator-studio.js              workflow dashboard curator
    curator-studio.css
    platform-insights.js           analytics, attribution, dan link health
    platform-insights.css
  services/
    supabase.js                    satu pintu komunikasi data Supabase
  styles/
    architectural-redesign.css     sistem visual lintas halaman
  vendor/                          library pihak ketiga yang disimpan lokal
```

Halaman publik lain tetap mempunyai folder rute sendiri. `_worker.js` hanya
bertanggung jawab atas routing, metadata SEO, header keamanan, sitemap, dan
penyajian aset; logika antarmuka tidak boleh dipindahkan ke Worker.

## Aturan batas modul

- **Pages** menyusun tampilan dan menghubungkan feature yang diperlukan satu
  halaman. Pages tidak boleh menjalankan query database langsung.
- **Components** menangani satu pola UI yang dapat dipakai ulang. Components
  menerima data atau callback dari page/feature dan tidak mengetahui sesi user.
- **Features** memiliki satu alur bisnis, misalnya Curator Studio atau Insights.
  Feature boleh memakai service, tetapi tidak menyalin akses Supabase sendiri.
- **Services** menjadi pintu integrasi data atau pihak luar. Detail tabel, RPC,
  storage, dan autentikasi tidak boleh tersebar ke component baru.
- **Admin** akan dipisahkan dari orkestrator `home.js` per panel setelah kontrak
  state dan event-nya stabil. Selama transisi, fitur lama tetap kompatibel lewat
  namespace `window.SISIP*` yang sudah digunakan aplikasi.

## Urutan migrasi aman

1. Pisahkan aset halaman yang tertanam dan perbaiki seluruh jalur file.
2. Kelompokkan komponen, feature, service, style, dan vendor yang sudah mandiri.
3. Tambahkan pemeriksaan syntax, referensi aset, keamanan, dan route Worker.
4. Ekstrak panel admin satu per satu hanya setelah regression test tersedia.
5. Ekstrak kartu, filter, modal, gallery, dan notification ketika kontrak input
   serta event masing-masing sudah terdokumentasi.
6. Evaluasi framework komponen setelah batas domain stabil; migrasi framework
   bukan syarat Fase 2 dan tidak boleh menjadi rewrite besar.

## Quality gate Fase 2

- `index.html` tidak memuat CSS atau JavaScript aplikasi secara inline.
- Semua aset baru berada pada kelompok yang sesuai dan tersedia saat deploy.
- File JavaScript utama lolos syntax check.
- Pemeriksaan fitur lama, keamanan, sitemap, analytics, marketplace, dan Worker
  tetap lulus.
- Halaman utama diuji pada viewport ponsel dan desktop sebelum rilis.
- Tidak ada dependency, API, atau resource berbayar yang ditambahkan.
