# SIMONEV Boyolali

Sistem Pemantauan Kinerja Indikator RPJMD Kabupaten Boyolali. Monorepo ini adalah implementasi kode dari:

1. **PRD v10.4** (naik dari v10.2) — requirement bisnis final, 12 modul F-01–F-12 plus perluasan level-Variabel, tagging berbasis rekening, dan referensi Urusan/Bidang Urusan.
2. **Dokumen Desain Teknis (DDT) v2.0** (naik dari v1.0) — keputusan arsitektur & teknologi, termasuk pergeseran ke level Variabel.
3. **Mockup UI** (`simonev-boyolali-mockup-v10.2-data-riil.jsx`) — referensi visual & data riil dari RPJMD Kabupaten Boyolali 2025–2029 (masih relevan untuk token warna/tipografi; struktur data sudah berkembang lewat DDT v2.0).

Kode di repo ini mengikuti ketiganya secara konsisten — token warna Tailwind sama dengan mockup, struktur data mengikuti skema di DDT v2.0 Section 2, dan aturan bisnis (validasi hierarki, alasan override ≥ 500 karakter, dst.) mengikuti PRD.

**Status: seluruh 12 modul F-01–F-12 sudah diimplementasikan ulang mengikuti DDT v2.0** (lihat tabel Section "Status Implementasi" di bawah). Perubahan intinya: **indikator tidak lagi diisi/disetujui langsung** — nilainya dihitung dari formula atas satu/lebih **Variable** (master data bersama, realisasinya global per periode), lihat `apps/ops/src/lib/capaian.ts` (`computeIndicatorValue`).

---

## Struktur Monorepo

```
monev/
├── apps/
│   ├── ops/          # SIMONEV Ops — F-01 s.d. F-12 (operasional, full RBAC)
│   └── eksekutif/     # SIMONEV Eksekutif — dashboard pimpinan (read-only)
├── packages/
│   ├── db/            # Model Mongoose + koneksi MongoDB, dipakai kedua app
│   └── schemas/       # Skema Zod (validasi bersama client & server)
├── deploy/
│   └── nginx.conf     # Reverse proxy dua subdomain
├── docker-compose.yml
└── .env.example
```

Kenapa dua aplikasi terpisah, bukan satu — lihat DDT Section 1.3.

---

## Menjalankan di Lokal (Development)

### Prasyarat
- Node.js ≥ 20
- MongoDB berjalan sebagai **replica set** (wajib untuk multi-document transaction di F-08 — lihat DDT Section 5.3). Cara tercepat lokal:
  ```bash
  docker run -d --name simonev-mongo -p 27017:27017 mongo:7 --replSet rs0
  docker exec -it simonev-mongo mongosh --eval "rs.initiate()"
  ```

### Langkah
```bash
npm install                     # instal seluruh workspace sekaligus
cp .env.example apps/ops/.env.local
cp .env.example apps/eksekutif/.env.local
cp .env.example .env.local      # dipakai oleh seed script di root

# isi AUTH_SECRET (hasil dari: npx auth secret) di ketiga file .env.local

npm run seed                    # isi data awal — lihat kredensial (username) yang dicetak di terminal
npm run dev:ops                 # → http://localhost:3000
npm run dev:eksekutif           # → http://localhost:3001 (terminal terpisah)
npm run dev:worker              # → proses Agenda.js (terminal terpisah — WAJIB untuk F-04/F-08/F-12 berfungsi)
```

Setelah `npm run seed`, login ke SIMONEV Ops dengan username `bapperida` (lihat kata sandi di output terminal — login sekarang berbasis **username**, bukan email, DDT v2.0 Section 2.10) untuk melihat cabang Pohon Kinerja nyata dari RPJMD.

### Menjalankan lewat Docker (mendekati produksi)
```bash
cp .env.example .env
# isi AUTH_SECRET, dst.
docker compose up --build
```

---

## Status Implementasi — Seluruh 12 Modul PRD (per DDT v2.0)

| Kode | Modul | Status | Lokasi | Catatan/Batasan |
|---|---|---|---|---|
| F-01 | Master Indikator, Pohon Kinerja & Formula | ✅ | `apps/ops/.../pohon-kinerja` + `.../variabel` | Formula builder (8 `calculationMethod`), `linkedProgramId` wajib untuk SASARAN_PROGRAM, kategori untuk metode kategorikal; validasi hierarki tetap ditegakkan di server |
| F-02 | Tagging Anggaran Tematik (granularitas Rekening) | ✅ | `apps/ops/.../tagging` | Cascade dihitung saat baca; `Tagging.budgetStructureId` mengacu Subkegiatan; `partialAllocations` (nominal Rupiah per rekening) menggantikan persentase tunggal v1.0; impor Laporan Realisasi mengisi `pagu`+`realisasi` sekaligus, kolom Fungsi/Sub Fungsi diabaikan, Sub-SKPD dipetakan ke PD induk |
| F-03 | Penjadwalan & Penguncian | ✅ | `apps/ops/.../jadwal` | Scope `pelaporan_indikator`/`penentuan_target`/`penutupan_tahun` (`entri_split_tagging` v1.0 dihapus, digantikan notifikasi langsung dari impor tagging) |
| F-04 | Input, Validasi Bukti & Ekstraksi Dokumen | ✅ | `apps/ops/.../input-data` | Realisasi per Variable (bukan per Indicator); validasi link/format lalu **ekstraksi konten dokumen** (pdf-parse + Tesseract.js OCR, job `validate-extraction`) membandingkan angka dalam dokumen vs nilai dilaporkan |
| F-05 | Target Silang Sektor (Cross-Cutting) | ✅ | `pohon-kinerja` (konfigurasi `crossCutting`) + `rekonsiliasi` (agregasi) | Tipe **Berbagi** (jumlah lintas OPD) dan **Terpisah** (per-variabel: `dijumlahkan` atau `ditunjuk` ke satu OPD); karena `VariableFinalValue` global per variabel+periode (bukan per-OPD seperti v1.0), approve pada mode `dijumlahkan` memicu agregasi ulang dari seluruh realisasi disetujui OPD kontributor |
| F-06 | Manajemen Eskalasi Cerdas | ✅ | Job `escalate-stale-reviews` | Beroperasi di level `VariableRealization`; realisasi menunggu >5 hari (termasuk yang `ditandai_gagal_ekstrak`) dieskalasi ke seluruh akun Admin Perencana (role teknis `bapperida`) |
| F-07 | Simulasi & What-If Analysis | ✅ | `apps/ops/.../simulasi` | Tidak berubah dari v1.0 — murni baca `targets`/`polarity`, tidak menyentuh Variable/formula |
| F-08 | Rekonsiliasi & Mediasi Data (+ Override) | ✅ | `apps/ops/.../rekonsiliasi` | Approve/override sekarang menulis `VariableFinalValue` (global, bukan per-indikator/OPD) + `AuditLog` dalam transaksi MongoDB; alasan override ≥500 karakter tetap ditegakkan di server |
| F-09 | Master Data Nomenklatur SIPD | ✅ | Terintegrasi di `.../tagging` | Tidak berubah secara konsep dari v1.0, kini juga mendeteksi perubahan pada baris level Rekening |
| F-10 | Perangkat Daerah, Bidang Urusan & PD Eksternal | ✅ | `apps/ops/.../org-unit` | `bidangUrusanIds` (maks. 3, referensi ke master data `Urusan`/`BidangUrusan` baru) menggantikan `urusan` teks bebas v1.0; flag `isExternal` (PD Eksternal, mis. BPS) memakai role `pd_opd` yang sama persis, tanpa RBAC khusus |
| F-11 | Tabel Data Dinamis & Ekspor Laporan | ✅ | `.../laporan` + `apps/eksekutif` | Baris laporan kini per-indikator, nilainya dihitung on-the-fly lewat `computeIndicatorValue()` — bukan query langsung ke tabel nilai final; ekspor CSV tetap, belum XLSX |
| F-12 | Notifikasi & Smart Reminder | ✅ | `_components/NotificationBell.tsx` | Tidak berubah dari v1.0; ditambah notifikasi baru: realisasi butuh konfirmasi ulang PD (ekstraksi tidak cocok), realisasi rekening ter-tag yang realisasinya berubah |
| — | Master Data Variable (baru) | ✅ | `apps/ops/.../variabel` | CRUD sederhana; Variable dipakai lintas Indicator lewat `formula[]` |
| — | Tahun Aktif & Sumber Data Otomatis (baru) | ✅ (Tahun Aktif) / 🟡 (Satu Data/API) | `.../pengaturan` + `lib/data-sources/` + job `pull-external-sources` | Tahun Aktif berfungsi penuh (cache + invalidation); konektor Satu Data Boyolali masih **stub** (endpoint/kredensial belum tersedia) — struktur `DataSourceConnector` sudah siap, tinggal isi `fetchValue()` |
| — | Dashboard Pimpinan (jalur baca) | ✅ | `apps/eksekutif` | Tidak berubah dari v1.0 — tetap hanya membaca `ReadmodelSnapshot` |
| — | Sinkronisasi read-model (DDT 6.3) | ✅ | `apps/ops/src/worker/jobs/syncReadmodel.job.ts` | Dirombak total: `statusDistribution` dihitung dari `computeIndicatorValue()` per indikator SASARAN_PROGRAM (bukan baca `FinalValue` langsung); `paguTerTag` per tema dijumlah dari `partialAllocations` nominal Rupiah langsung |

**Legenda:** ✅ = ada implementasi kerja lengkap. 🟡 = struktur/interface sudah ada, implementasi konkret masih stub karena keterbatasan lingkungan (lihat "Keterbatasan yang Diketahui").

---

## Verifikasi yang Sudah (dan Belum) Dilakukan

**PENTING — beda dari v1.0:** implementasi DDT v2.0 ini **belum sempat dijalankan lewat `npm run typecheck`/`npm run build`**, karena Node.js tidak terpasang di lingkungan tempat kode ini ditulis. Berbeda dari klaim "lolos tsc + next build" pada riwayat commit v1.0 (yang memang benar-benar dijalankan), baris-baris ✅ pada tabel di atas untuk perubahan DDT v2.0 merepresentasikan implementasi yang **konsisten secara desain dan sudah diperiksa manual** (kecocokan import/export antar `@simonev/db`, `@simonev/schemas`, dan setiap modul — lihat riwayat commit "Implement DDT v2.0"), **bukan** hasil kompilasi TypeScript yang terverifikasi. **Wajib** menjalankan `npm install && npm run typecheck && npm run build` di keempat workspace sebelum merge/deploy.

Verifikasi v1.0 (masih berlaku untuk bagian kode yang tidak tersentuh DDT v2.0):
```bash
npm run typecheck   # tsc --noEmit di keempat workspace
npm run build       # next build sungguhan di apps/ops dan apps/eksekutif
```
Isu produksi yang pernah ditemukan & diperbaiki di v1.0 (masih relevan):
1. **Konflik Edge Runtime** di `middleware.ts` (argon2 & mongoose tidak jalan di Edge) — diperbaiki dengan pola `auth.config.ts` (Edge-safe) terpisah dari `auth.ts` (Node runtime penuh).
2. **Format PostCSS config** — harus CommonJS (`module.exports`), bukan ESM.

---

## Keterbatasan yang Diketahui (Jujur, Bukan Disembunyikan)

Supaya tim yang melanjutkan tidak kaget:

1. **Belum di-typecheck/build** (lihat Section "Verifikasi" di atas) — prioritas #1 sebelum kerja lanjutan apa pun.
2. **Konektor Satu Data Boyolali masih stub** (`lib/data-sources/satuDataConnector.ts`) — mengembalikan `null` selalu, karena endpoint/kredensial sungguhan belum tersedia.
3. **Job `pull-external-sources` belum mengikuti jendela Jadwal Pengisian Realisasi per indikator** — berjalan cron harian tetap sebagai penyederhanaan (lihat komentar di file job-nya), belum window-aware.
4. **`computeIndicatorValue` metode `selisih`** memakai heuristik "jumlah komponen non-`pengurang` dikurangi jumlah `pengurang`" — DDT v2.0 tidak merinci lebih jauh; cek ulang kalau ada kasus formula selisih yang lebih kompleks dari A−B.
5. **Formula capaian untuk target berbentuk rentang** (mis. "5,80-6,00") masih memakai batas bawah sebagai pembanding — sama seperti v1.0, keputusan desain eksplisit di `apps/ops/src/lib/capaian.ts`.
6. **Tidak ada automated test** sama sekali — sama seperti v1.0. Rekomendasi: mulai dari Vitest untuk `computeIndicatorValue`, `calculateCapaian`, dan `document-extraction.ts` (fungsi murni).
7. **Belum pernah dites terhadap MongoDB sungguhan** — sama seperti v1.0, plus alur baru (ekstraksi dokumen, cross-cutting split, konektor eksternal) belum pernah dicoba end-to-end sama sekali.
8. **Tidak ada UI manajemen pengguna** — sama seperti v1.0.
9. **Data referensi Urusan/Bidang Urusan di `seed.ts` bersifat ilustratif** — 9 Urusan & bidang turunannya disusun berdasarkan kategori umum UU 23/2014, BUKAN hasil verifikasi terhadap daftar resmi yang benar-benar dipakai Pemkab Boyolali. Ganti sebelum produksi.
10. **F-11 baru CSV**, belum XLSX.
11. **CI/CD belum ada file konkret.**
12. **Rate limiting** belum diimplementasikan.

---

## Pola Kode untuk Melanjutkan

- **Formula & kalkulasi nilai indikator dari Variable** → `apps/ops/src/lib/capaian.ts` (`computeIndicatorValue`), dipakai `syncReadmodel.job.ts` dan `laporan/actions.ts`
- **CRUD master data sederhana** → F-10 (`org-unit/`) atau Variable (`variabel/`)
- **Transaksi MongoDB multi-dokumen** → F-08 (`rekonsiliasi/actions.ts`, fungsi `reviewVariableRealization`/`overrideVariableFinalValue`)
- **Job berantai (job memicu job lain lewat `agenda.now`)** → F-04 (`validateEvidence.job.ts` → `validateExtraction.job.ts`) dan F-08 (`recomputeIndicatorValue.job.ts`)
- **Cascade/read-time-computation + copy-advice antar tahun** → F-02 (`tagging/actions.ts`, `Tagging.ts`)
- **Pola connector-per-sumber untuk integrasi eksternal** → `lib/data-sources/registry.ts`
- **Notifikasi in-app+email best-effort** → F-12 (`lib/notify.ts`)
- **Penjadwalan lintas-modul** (satu model dipakai banyak scope) → F-03 (`Schedule.ts`, `jadwal/actions.ts`)
- **Route Handler streaming file** → F-11 (`api/export/final-values/route.ts`)
