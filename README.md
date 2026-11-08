# SIPATIR — Prototipe PWA Pemantauan & Pelaporan Irigasi

**SIPATIR** (Sistem Informasi Pemantauan & Pelaporan Irigasi) adalah prototipe **PWA (Progressive Web App)** berbasis **vanilla HTML/CSS/JavaScript** — tanpa framework, tanpa build tools — untuk digitalisasi inspeksi irigasi di lingkungan Ditjen Sumber Daya Air, Kementerian Pekerjaan Umum dan Penataan Ruang. Seluruh data adalah **simulasi lokal** (localStorage + IndexedDB) sehingga aman dicoba tanpa server.

---

## Fitur Utama

### Umum (semua peran)
- **Login pilih peran**: Staf Pengamat, Penjaga & Pengoperasi Pintu Air (PPA), Pekarya Teknis Irigasi.
- **Tema Terang & Gelap** (+ opsi "ikuti sistem"), 3 pilihan warna aksen, ukuran huruf, kepadatan tampilan — diatur di **Profil → Setelan Tampilan**.
- **Desain**: sidebar rounded melayang yang proporsional (desktop), **hero section dengan avatar popout tanpa bingkai** (foto png/webp melayang keluar kartu, hanya bayangan), dan **bottom floating pill menu** (mobile) — responsif HP & desktop (kalender + riwayat menjadi 1 kolom di layar sempit).
- **Kehadiran & Izin di Beranda**: kartu status hari ini + rekap H/DL/I/S/C/A bulan berjalan + daftar pengajuan (dapat dibatalkan selagi menunggu).
- **Kamera lapangan**: watermark otomatis (tanggal-jam WIB, koordinat GPS ±akurasi, alamat, arah kompas, identitas petugas, lokasi & tahap), **kamera depan/belakang**, **countdown 3/5/10 detik**, adaptif potret/lanskap, fallback **unggah foto** bila kamera tidak tersedia.
- **Kehadiran & pengajuan Izin/Sakit/Cuti/DL** (baru v1.2): ajukan ketidakhadiran + nomor surat (dokter/CUTI-1/SPPD), diverifikasi Staf Pengamat, otomatis memperbarui kalender & rekap rapor (lihat bawah).
- **Rantai progres foto 0% → 50% → 100%** per lokasi.
- **Antrian offline**: foto masuk IndexedDB, otomatis "tersinkron" saat kembali daring.
- **Peta Leaflet** dengan layer sesuai peran (lihat di bawah) + mode pratinjau peran untuk pengamat.
- **Kalender bulanan** + detail riwayat/tugas/rekap kerja per tanggal.
- **Dapat dipasang** (PWA): manifest + service worker, jalan luring setelah kunjungan pertama.

### Peran Staf Pengamat
- **Persetujuan**: menerima laporan PPA/Pekarya (foto + tahap + catatan), lalu **Setujui / Minta Revisi / Tolak** dengan alasan — status mengalir balik ke aplikasi petugas.
- **Tab Kehadiran** di halaman Persetujuan (baru v1.2): setujui/menolak pengajuan Izin, Sakit, Cuti & Dinas Luar PPA/Pekarya. Yang disetujui langsung menggantikan status tanggal tersebut (termasuk memperbaiki status "Tanpa Keterangan") pada kalender & rekap rapor pegawai.
- **Buat Tugas**: menugaskan PPA/Pekarya (jenis tugas, lokasi dari peta, tenggat, prioritas, catatan) + tombol ingatkan.
- **Menu kamera yang sama** dengan PPA/Pekarya (mode *dokumentasi pengawasan* — tersimpan otomatis terverifikasi).
- Peta: poligon **D.I.**, semua pintu air, saluran, dan posisi tim.
- Raport + **ringkasan kinerja tim**.

### Peran PPA & Pekarya
- Menerima & mengerjakan tugas, melaporkan via kamera, melihat status verifikasi.
- Peta: PPA melihat **pintu air**; Pekarya melihat **ruas saluran** berwarna kondisi (Baik / Rusak Ringan / Rusak Berat) dengan aksi "laporkan via kamera".

### Rapor Kinerja (halaman Rapor)
- Pilihan periode **1 Bulan / 3 Bulan / 6 Bulan / 1 Tahun**.
- Kerangka **pengelolaan kinerja ASN**: Nilai Hasil Kerja (bobot 70%) + Perilaku Kerja **BerAKHLAK** (30%) — mengacu **Perpres No. 95/2021** & **PermenPANRB No. 6/2022**.
- **Predikat & ambang** mengacu **Peraturan BKN No. 3/2023**: Sangat Baik ≥ 91,00 · Baik 76,00–90,99 · Butuh Perbaikan 61,00–75,99 · Kurang 51,00–60,99 · Sangat Kurang ≤ 50,99.
- Grafik tren skor, donut komposisi kehadiran (**H/DL/S/I/C/A**), tabel hasil kerja (skor kegiatan utama), **rincian ketidakhadiran (Izin/Sakit/Cuti + nomor surat + status persetujuan)**, rincian aktivitas.
- **Cetak / Simpan PDF**: lembar resmi berkop (Kementerian → Ditjen SDA → BWS → SPSDA) lengkap dengan rekap kehadiran, rincian ketidakhadiran disetujui, dan blok tanda tangan Pegawai yang Dinilai & Pejabat Penilai.

### Alur Kehadiran (Izin / Sakit / Cuti / Dinas Luar) — baru v1.2
1. PPA/Pekarya membuka **Beranda → kartu "Kehadiran & Pengajuan Izin"** (atau tile **Absensi**) → pilih jenis (I/S/C/DL), tanggal, alasan, nomor surat (label menyesuaikan jenis) → **Kirim Pengajuan**.
2. Staf Pengamat memverifikasi di **Persetujuan → tab Kehadiran**: **Setujui** atau **Tolak** dengan alasan. Pengamat juga dapat mencatat Dinas Luar/Izin miliknya sendiri langsung dari kartu yang sama.
3. Pengajuan berstatus **Disetujui otomatis menimpa** data absensi sistem pada tanggal itu (`attFor()`): muncul di kalender (titik merah S/I/C/A), detail hari, donut rapor, dan **rincian ketidakhadiran** pada rapor & lembar cetak. Pengajuan *menunggu* tidak mengubah status resmi; pengajuan ganda pada tanggal yang sama ditolak sistem.

> Semua identitas pegawai, nomor (NIP, karpeg, NPWP), koordinat, dan nilai adalah **fiktif/simulasi**. Penilaian resmi tetap melalui e-Kinerja BKN.

---

## Struktur Folder

```
pupr-irigasi-pwa/
├── index.html          ← satu-satunya halaman (SPA)
├── manifest.json       ← metadata PWA
├── sw.js               ← service worker (cache-first, luring)
├── css/style.css       ← design system (terang/gelap, responsif, print)
├── js/
│   ├── data.js         ← util, data pegawai & objek irigasi (simulasi), IndexedDB
│   ├── camera.js       ← kamera + watermark + rantai progres
│   ├── map.js          ← peta Leaflet per peran
│   ├── rapor.js        ← mesin rapor + grafik + lembar cetak
│   └── app.js          ← cangkang, router, beranda, tugas, persetujuan, profil
└── assets/
    ├── icons/          ← ikon PWA (192/512/maskable/apple)
    └── avatars/        ← avatar hero (popout) & foto resmi pegawai (png)
```

## Cara Menjalankan

**Cepat**: klik dua kali `index.html` — aplikasi langsung jalan di browser (kamera & PWA butuh HTTPS/localhost, lihat catatan).

**Dengan server lokal (disarankan)**:
```bash
cd pupr-irigasi-pwa
python3 -m http.server 8080
# buka http://localhost:8080
```

## Upload ke GitHub Pages

1. Buat repositori baru di GitHub (mis. `sipatir`), **Public**.
2. Unggah **seluruh isi folder ini** ke root repo (drag & drop di web GitHub, atau `git push`).
3. Buka **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main` / `(root)` → **Save**.
4. Tunggu 1–2 menit, lalu akses `https://<username>.github.io/sipatir/`.
5. Di HP: buka alamat tersebut → menu browser → **"Tambahkan ke layar utama"** untuk memasang sebagai aplikasi.

### Catatan penting
- **Kamera** (`getUserMedia`) dan **service worker** hanya aktif pada **HTTPS** atau `localhost`. Di GitHub Pages (HTTPS) keduanya otomatis aman. Bila kamera tidak tersedia, tombol **Unggah Foto** tetap menghasilkan laporan ber-watermark.
- Jika repo diletakkan pada subfolder, semua path sudah relatif (`./assets/...`) sehingga aman.
- Peta memuat tile OpenStreetMap & Leaflet dari CDN — saat luring peta menampilkan fallback daftar objek.
- Offline penuh (shell aplikasi) aktif setelah kunjungan kedua karena service worker.

## Kustomisasi

| Yang diubah | File | Bagian |
|---|---|---|
| Identitas pegawai (nama, NIP, pangkat, jabatan) | `js/data.js` | konstanta `USERS` |
| Objek irigasi (D.I., pintu air, saluran, koordinat) | `js/data.js` | konstanta `GEO` |
| Data awal tugas, laporan & pengajuan kehadiran | `js/data.js` | `seedTasks()`, `seedReports()`, `seedAbsensi()` |
| Warna merek & tema | `css/style.css` | blok `:root` / `[data-theme]` |
| Kepanjangan cache PWA | `sw.js` | konstanta `CACHE` (naikkan versi saat mengubah file) |

## Troubleshooting

- **Peta kosong** → cek koneksi internet (tile dari CDN); saat daring akan normal kembali.
- **Foto tidak muncul setelah hapus riwayat browser** → IndexedDB ikut terhapus; ini normal pada demo.
- **Skor rapor "Butuh Perbaikan"** → wajar bila laporan masih menunggu persetujuan; setujui sebagai Staf Pengamat lalu lihat ulang rapor.
