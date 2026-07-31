/**
 * F-08/F-11 — Kalkulasi Capaian (PRD 5.5).
 *
 * Aturan Agregasi Capaian Tahunan:
 * - Kumulatif  → dijumlahkan dari seluruh periode dalam tahun berjalan.
 * - Non-kumulatif/snapshot → nilai pada periode TERAKHIR yang dilaporkan.
 *
 * Formula Polaritas Negatif (indikator "makin rendah makin baik"):
 *   capaian% = (2 × target − realisasi) / target × 100
 * (dikonfirmasi di PRD v10.1 Section 5.5 dengan contoh Angka Kemiskinan)
 *
 * Formula Polaritas Positif (baku):
 *   capaian% = realisasi / target × 100
 *
 * Capping 120% berlaku HANYA jika allowOverachievement = true.
 *
 * KETERBATASAN YANG SENGAJA DIDOKUMENTASIKAN (bukan diam-diam disederhanakan):
 * RPJMD sering memuat target berupa RENTANG (mis. "5,80-6,00", bukan angka
 * tunggal) — lihat data riil Tabel III.3. Untuk rentang, fungsi ini memakai
 * BATAS BAWAH sebagai target pembanding (paling konservatif: capaian
 * dianggap 100% hanya jika realisasi menyentuh batas bawah rentang, bukan
 * ujung atas yang lebih mudah dicapai). Ini pilihan sadar, bukan keharusan —
 * kalau Bapperida punya konvensi berbeda (mis. titik tengah rentang), ganti
 * `parseNumeric()` di bawah.
 */

export type Polarity = "positive" | "negative";

export function parseNumeric(raw: string): number | null {
  // Ambil angka pertama dari string, mendukung format Indonesia (koma
  // desimal) dan rentang ("5,80-6,00" → 5.80, batas bawah — lihat catatan di atas).
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

export type CapaianResult = {
  capaianPercent: number;
  status: "tercapai" | "proses" | "belum_tercapai";
};

export function calculateCapaian(
  reportedValue: string,
  targetValue: string,
  polarity: Polarity,
  allowOverachievement: boolean
): CapaianResult | null {
  const realisasi = parseNumeric(reportedValue);
  const target = parseNumeric(targetValue);
  if (realisasi === null || target === null || target === 0) return null;

  let capaianPercent =
    polarity === "negative" ? ((2 * target - realisasi) / target) * 100 : (realisasi / target) * 100;

  if (allowOverachievement) {
    capaianPercent = Math.min(capaianPercent, 120);
  } else {
    capaianPercent = Math.min(capaianPercent, 100);
  }

  const status: CapaianResult["status"] =
    capaianPercent >= 100 ? "tercapai" : capaianPercent >= 75 ? "proses" : "belum_tercapai";

  return { capaianPercent: Math.round(capaianPercent * 100) / 100, status };
}

/**
 * Menentukan nilai target tahun berjalan dari daftar target per tahun milik
 * Indicator. Kalau tahun berjalan tidak ada di daftar (mis. baru masuk tahun
 * kondisi akhir), pakai target tahun terakhir yang tersedia sebagai fallback.
 */
export function resolveTargetForYear(
  targets: { year: number; value: string }[],
  year: number
): string | null {
  const exact = targets.find((t) => t.year === year);
  if (exact) return exact.value;
  const sorted = [...targets].sort((a, b) => b.year - a.year);
  return sorted[0]?.value ?? null;
}
