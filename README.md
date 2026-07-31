# SIMONEV Boyolali

Sistem Pemantauan Kinerja Indikator RPJMD Kabupaten Boyolali. Monorepo ini adalah implementasi kode dari:

1. **PRD v10.2** — requirement bisnis final (12 modul F-01–F-12).
2. **Dokumen Desain Teknis (DDT) v1.0** — keputusan arsitektur & teknologi.
3. **Mockup UI** (`simonev-boyolali-mockup-v10.2-data-riil.jsx`) — referensi visual & data riil dari RPJMD Kabupaten Boyolali 2025–2029.

Kode di repo ini mengikuti ketiganya secara konsisten — token warna Tailwind sama dengan mockup, struktur data mengikuti skema di DDT Section 5, dan aturan bisnis (validasi hierarki, alasan override ≥ 500 karakter, dst.) mengikuti PRD.

**Status: seluruh 12 modul F-01–F-12 di PRD sudah punya implementasi kerja** (lihat tabel Section "Status Implementasi" di bawah untuk rincian dan batasan tiap modul — beberapa masih menyederhanakan sebagian kasus tepi, didokumentasikan eksplisit, bukan disembunyikan).

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

npm run seed                    # isi data awal — lihat kredensial yang dicetak di terminal
npm run dev:ops                 # → http://localhost:3000
npm run dev:eksekutif           # → http://localhost:3001 (terminal terpisah)
npm run dev:worker              # → proses Agenda.js (terminal terpisah — WAJIB untuk F-04/F-08/F-12 berfungsi)
```

Setelah `npm run seed`, login ke SIMONEV Ops dengan `bapperida@boyolalikab.go.id` (lihat kata sandi di output terminal) untuk melihat cabang Pohon Kinerja nyata dari RPJMD.

### Menjalankan lewat Docker (mendekati produksi)
```bash
cp .env.example .env
# isi AUTH_SECRET, dst.
docker compose up --build
```

---

## Status Implementasi — Seluruh 12 Modul PRD

| Kode | Modul | Status | Lokasi | Catatan/Batasan |
|---|---|---|---|---|
| F-01 | Master Indikator & Pohon Kinerja | ✅ | `apps/ops/.../pohon-kinerja` | Validasi hierarki (anak harus 1 tingkat di bawah induk) ditegakkan di server, bukan cuma UI |
| F-02 | Tagging Anggaran Tematik | ✅ | `apps/ops/.../tagging` | Cascade dihitung saat baca (bukan duplikasi fisik — lihat `Tagging.ts`); overlap antar tema diperbolehkan; split oleh PD; copy-advice antar tahun; impor Excel sungguhan (ExcelJS) DAN baris terstruktur (JSON); format kolom Excel yang diharapkan tetap (lihat komentar di `importBudgetStructureFromExcel`), belum ada pemetaan kolom fleksibel |
| F-03 | Penjadwalan & Penguncian | ✅ | `apps/ops/.../jadwal` | Satu model `Schedule` generik dipakai 2 scope (pelaporan indikator F-04, split tagging F-02); job penguncian tiap jam; job reminder H-3/H-1 (F-12) |
| F-04 | Input & Validasi Bukti | ✅ | `apps/ops/.../input-data` | Validasi link/format otomatis async (job Agenda), submission ditolak otomatis kalau periode terkunci (F-03) |
| F-05 | Target Silang Sektor (Cross-Cutting) | ✅ | `apps/ops/.../pohon-kinerja` (konfigurasi) + `.../rekonsiliasi` (tampilan) | `Indicator.crossCuttingWorkUnitIds`; Bapperida melihat submission OPD lain untuk indikator sama saat review; `getCrossCuttingRollup` untuk penjumlahan lintas OPD. **Keputusan desain**: setiap OPD tetap punya `FinalValue` sendiri (tidak dipaksa jadi satu nilai tunggal yang diperebutkan) |
| F-06 | Manajemen Eskalasi Cerdas | ✅ | Job `escalate-stale-reviews` | Submission menunggu >5 hari dieskalasi ke SELURUH akun Bapperida (bukan hierarki berjenjang — konsisten dengan keputusan PRD v10.2 soal override single-tier); badge "ESKALASI" di UI antrean rekonsiliasi |
| F-07 | Simulasi & What-If Analysis | ✅ | `apps/ops/.../simulasi` | Murni baca — tidak pernah menulis ke `simonev_core`, aman dicoba berkali-kali |
| F-08 | Rekonsiliasi & Mediasi Data (+ Override) | ✅ | `apps/ops/.../rekonsiliasi` | `overrideFinalValue` pakai **MongoDB multi-document transaction** sungguhan; alasan override ≥500 karakter ditegakkan di server |
| F-09 | Master Data Nomenklatur SIPD | ✅ | Terintegrasi di `apps/ops/.../tagging` (bagian bawah halaman) | `SipdNomenclatureChange` — perubahan nama/level/kode induk untuk kode SIPD yang sama antar tahun terdeteksi & tercatat OTOMATIS saat impor, tidak perlu proses manual terpisah |
| F-10 | Pengaturan Urusan Pemerintahan per Unit Kerja | ✅ | `apps/ops/.../org-unit` | CRUD dasar (create + list); belum ada edit/nonaktifkan dari UI (harus lewat database) |
| F-11 | Tabel Data Dinamis & Ekspor Laporan | ✅ | `apps/ops/.../laporan` (operasional) + `apps/eksekutif` (ringkasan pimpinan) | Ekspor CSV (Route Handler streaming); PD/OPD dipaksa di server hanya bisa lihat/ekspor data OPD-nya sendiri; belum ada ekspor XLSX (CSV dulu, upgrade tinggal ganti bagian response di `route.ts`) |
| F-12 | Notifikasi & Smart Reminder | ✅ | Bell icon di header (`_components/NotificationBell.tsx`) | In-app selalu tersimpan; email best-effort via Nodemailer (gagal kirim TIDAK menggagalkan alur bisnis pemanggil); terpasang di 5 titik nyata: submission ditolak sistem, ditolak Bapperida, disetujui, reminder jadwal H-3/H-1, eskalasi F-06 |
| — | Dashboard Pimpinan (jalur baca) | ✅ | `apps/eksekutif` | ISR 15 menit, membaca `ReadmodelSnapshot`, tidak ada endpoint tulis sama sekali (ditegakkan di middleware + arsitektur) |
| — | Sinkronisasi read-model (DDT 6.3) | ✅ | `apps/ops/src/worker/jobs/syncReadmodel.job.ts` | `statusDistribution` dari capaian% nyata (PRD 5.5, lihat catatan formula di bawah), `totals`, `belumLaporPeriodeIni`, `temaSummary` — semua dari data riil, dipicu langsung tiap ada approve/override/tagging/split-entry |

**Legenda:** ✅ = ada implementasi kerja, lolos `tsc --noEmit` + `next build`. Tidak ada modul berstatus ⬜ (belum dikerjakan) lagi — tapi lihat "Keterbatasan yang Diketahui" di bawah untuk kejujuran soal apa yang masih disederhanakan.

---

## Verifikasi yang Sudah Dilakukan

Setiap baris ✅ di atas sudah melewati:
```bash
npm run typecheck   # tsc --noEmit di keempat workspace
npm run build       # next build sungguhan di apps/ops dan apps/eksekutif
```
Bukan cuma "kelihatan benar" — build sempat gagal beberapa kali selama pengembangan karena isu produksi nyata yang kemudian diperbaiki:
1. **Konflik Edge Runtime** di `middleware.ts` (argon2 & mongoose tidak jalan di Edge) — diperbaiki dengan pola `auth.config.ts` (Edge-safe) terpisah dari `auth.ts` (Node runtime penuh), sesuai rekomendasi resmi Auth.js.
2. **Format PostCSS config** — harus CommonJS (`module.exports`), bukan ESM (`export default`), karena `package.json` tidak mendeklarasikan `"type": "module"`.

**Catatan:** build `apps/ops` menampilkan satu *warning* (bukan error) soal modul opsional `supports-color` dari dependensi transitif `agenda` → `date.js` → `debug`. Kosmetik — tidak memengaruhi fungsi.

---

## Keterbatasan yang Diketahui (Jujur, Bukan Disembunyikan)

Supaya tim yang melanjutkan tidak kaget, berikut yang **belum** ada meski semua modul F-xx sudah berstatus ✅:

1. **Formula capaian untuk target berbentuk rentang** (`apps/ops/src/lib/capaian.ts`) — RPJMD sering memuat target seperti "5,80-6,00"; fungsi ini memakai **batas bawah** sebagai pembanding (paling konservatif). Ini pilihan desain eksplisit, bukan satu-satunya kemungkinan — ganti kalau Bapperida punya konvensi lain (mis. titik tengah).
2. **Tidak ada automated test** (unit/integration) sama sekali. Seluruh verifikasi sejauh ini adalah `tsc --noEmit` (kebenaran tipe) + `next build` (build sungguhan berhasil) — keduanya penting tapi TIDAK sama dengan pengujian perilaku/logika bisnis end-to-end. Rekomendasi: mulai dari Vitest untuk `apps/ops/src/lib/capaian.ts` dan `evidence-validation.ts` (fungsi murni, paling mudah ditest tanpa mock database).
3. **Belum pernah dites terhadap MongoDB sungguhan** — seluruh kode ditulis & di-typecheck/build dengan benar, tapi lingkungan pengembangan ini tidak punya akses ke instance MongoDB nyata untuk uji end-to-end (submit → validasi → approve → dashboard ter-update). Sangat disarankan uji manual penuh sebelum go-live, terutama alur multi-document transaction F-08.
4. **Tidak ada UI manajemen pengguna** — akun hanya bisa dibuat lewat `npm run seed` atau langsung ke database; F-10 (Perangkat Daerah) sudah ada UI tapi tidak untuk `User`.
5. **Excel import (F-02) mengharapkan urutan kolom tetap** (Level, Kode SIPD, Kode Induk, Nama, Pagu, Kode SIPD OPD) — belum ada pemetaan kolom fleksibel atau validasi baris yang lebih toleran terhadap variasi format SIPD sungguhan.
6. **F-11 baru CSV**, belum XLSX (meski ExcelJS sudah jadi dependency untuk F-02, belum dipakai untuk sisi ekspor).
7. **CI/CD belum ada file konkret** — DDT Section 9 merekomendasikan GitHub Actions atau Gitea+Woodpecker, tapi belum ada file workflow sungguhan di repo ini.
8. **Rate limiting** yang disebut di DDT Section 7 belum diimplementasikan.

---

## Pola Kode untuk Melanjutkan

Setiap gaya modul di atas punya contoh lengkap untuk ditiru:
- **CRUD + hierarki sederhana** → F-01 (`pohon-kinerja/`)
- **Transaksi MongoDB multi-dokumen** → F-08 (`rekonsiliasi/actions.ts`, fungsi `overrideFinalValue`)
- **Job asinkron Agenda.js dipicu dari Server Action** → F-04 (`validateEvidence.job.ts` + `input-data/actions.ts`)
- **Cascade/read-time-computation + copy-advice antar tahun** → F-02 (`tagging/actions.ts`, `Tagging.ts`)
- **Notifikasi in-app+email best-effort** → F-12 (`lib/notify.ts`)
- **Penjadwalan lintas-modul** (satu model dipakai 2 scope berbeda) → F-03 (`Schedule.ts`, `jadwal/actions.ts`)
- **Komputasi murni tanpa efek samping ke DB** → F-07 (`simulasi/actions.ts`)
- **Route Handler streaming file** → F-11 (`api/export/final-values/route.ts`)
