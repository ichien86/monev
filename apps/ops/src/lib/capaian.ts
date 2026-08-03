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

/**
 * Nilai representatif satu Variable untuk tahun tertentu — DDT v2.0 tidak
 * mendefinisikan aturan agregasi sub-tahunan secara eksplisit di level
 * Variable (beda dari `calculationMethod` v1.0 yang punya opsi "sum"
 * eksplisit). Penyederhanaan yang didokumentasikan eksplisit: dipakai flag
 * `Indicator.rpjmdCumulative` (DDT v2.0 Section 2.2, field yang memang
 * dimaksudkan untuk ini) — kumulatif → dijumlahkan dari seluruh
 * VariableFinalValue tahun berjalan; non-kumulatif → nilai periode
 * TERAKHIR yang di-approve tahun itu. Dipakai bersama oleh
 * syncReadmodel.job.ts dan laporan/actions.ts supaya kedua tempat konsisten.
 */
export function representativeValueForYear(
  values: { periodLabel: string; value: string; approvedAt: Date }[],
  cumulative: boolean
): string | null {
  if (values.length === 0) return null;
  if (cumulative) {
    return values.reduce((sum, v) => sum + (parseNumeric(v.value) ?? 0), 0).toString();
  }
  const sorted = [...values].sort((a, b) => a.approvedAt.getTime() - b.approvedAt.getTime());
  return sorted[sorted.length - 1].value;
}

/**
 * DDT v2.0 Section 3.2 — Perhitungan Nilai Indikator dari formula (level
 * Variabel). Menggantikan pembacaan langsung `FinalValue.value` (v1.0):
 * nilai indikator sekarang SELALU turunan dari VariableFinalValue milik
 * setiap Variable di `indicator.formula`, tidak pernah disimpan langsung.
 *
 * Fungsi murni — tidak menyentuh database. Caller (mis. syncReadmodel.job.ts)
 * yang bertanggung jawab mengambil `finalValuesByVariableId` dari
 * VariableFinalValue untuk periode yang relevan.
 */
export type FormulaEntry = {
  variableId: string;
  role: "tunggal" | "pembilang" | "penyebut" | "komponen" | "pengurang";
  weight: number | null;
};

export type IndicatorForComputation = {
  calculationMethod:
    | "variabel_tunggal"
    | "persentase"
    | "penjumlahan"
    | "rata_rata"
    | "penjumlahan_berbobot"
    | "selisih"
    | "rasio"
    | "kategorikal";
  formula: FormulaEntry[];
  categories: { label: string; capaianPercent: number }[];
};

export type IndicatorComputationResult =
  | { status: "belum_lengkap"; completedCount: number; totalCount: number }
  | { status: "lengkap"; kind: "numeric"; value: string }
  | { status: "lengkap"; kind: "kategorikal"; categoryLabel: string; capaianPercent: number };

function sumByRole(
  formula: FormulaEntry[],
  finalValuesByVariableId: Map<string, string>,
  roles: FormulaEntry["role"][]
): number {
  return formula
    .filter((f) => roles.includes(f.role))
    .reduce((sum, f) => sum + (parseNumeric(finalValuesByVariableId.get(f.variableId) ?? "") ?? 0), 0);
}

export function computeIndicatorValue(
  indicator: IndicatorForComputation,
  finalValuesByVariableId: Map<string, string>
): IndicatorComputationResult | null {
  const totalCount = indicator.formula.length;
  if (totalCount === 0) return null;

  const completedCount = indicator.formula.filter((f) => finalValuesByVariableId.has(f.variableId)).length;
  if (completedCount < totalCount) {
    return { status: "belum_lengkap", completedCount, totalCount };
  }

  const numericValues = indicator.formula.map(
    (f) => parseNumeric(finalValuesByVariableId.get(f.variableId) ?? "") ?? 0
  );

  switch (indicator.calculationMethod) {
    case "variabel_tunggal":
    case "kategorikal": {
      const raw = finalValuesByVariableId.get(indicator.formula[0].variableId) ?? "";
      if (indicator.calculationMethod === "variabel_tunggal") {
        return { status: "lengkap", kind: "numeric", value: raw };
      }
      // Nilai VariableFinalValue untuk variabel kategorikal menyimpan LABEL
      // kategori (bukan angka) — capaian%-nya di-lookup dari indicator.categories.
      const match = indicator.categories.find((c) => c.label === raw);
      return {
        status: "lengkap",
        kind: "kategorikal",
        categoryLabel: raw,
        capaianPercent: match?.capaianPercent ?? 0,
      };
    }

    case "penjumlahan": {
      const total = numericValues.reduce((sum, v) => sum + v, 0);
      return { status: "lengkap", kind: "numeric", value: String(total) };
    }

    case "rata_rata": {
      const total = numericValues.reduce((sum, v) => sum + v, 0);
      return { status: "lengkap", kind: "numeric", value: String(total / numericValues.length) };
    }

    case "penjumlahan_berbobot": {
      // Bobot tiap entri berupa persentase (0-100), total sudah divalidasi
      // = 100 saat konfigurasi formula (Zod, bukan di sini) — dibagi 100
      // supaya hasilnya rata-rata tertimbang, bukan angka yang membengkak
      // 100x lipat.
      const total = indicator.formula.reduce((sum, f) => {
        const value = parseNumeric(finalValuesByVariableId.get(f.variableId) ?? "") ?? 0;
        return sum + value * ((f.weight ?? 0) / 100);
      }, 0);
      return { status: "lengkap", kind: "numeric", value: String(total) };
    }

    case "persentase": {
      const pembilang = sumByRole(indicator.formula, finalValuesByVariableId, ["pembilang"]);
      const penyebut = sumByRole(indicator.formula, finalValuesByVariableId, ["penyebut"]);
      if (penyebut === 0) return { status: "lengkap", kind: "numeric", value: "0" };
      return { status: "lengkap", kind: "numeric", value: String((pembilang / penyebut) * 100) };
    }

    case "rasio": {
      const pembilang = sumByRole(indicator.formula, finalValuesByVariableId, ["pembilang"]);
      const penyebut = sumByRole(indicator.formula, finalValuesByVariableId, ["penyebut"]);
      if (penyebut === 0) return { status: "lengkap", kind: "numeric", value: "0" };
      return { status: "lengkap", kind: "numeric", value: String(pembilang / penyebut) };
    }

    case "selisih": {
      // "pengurang" eksplisit dikurangkan; sisanya (peran apa pun selain
      // "pengurang", biasanya "komponen") dijumlahkan sebagai pengurang-an
      // (mis. dua "komponen" → komponen pertama minus komponen kedua kalau
      // yang kedua ditandai "pengurang"; atau beberapa "komponen" dijumlah
      // dikurangi satu/lebih "pengurang").
      const minuend = sumByRole(indicator.formula, finalValuesByVariableId, ["komponen", "tunggal"]);
      const subtrahend = sumByRole(indicator.formula, finalValuesByVariableId, ["pengurang"]);
      return { status: "lengkap", kind: "numeric", value: String(minuend - subtrahend) };
    }

    default:
      return null;
  }
}
