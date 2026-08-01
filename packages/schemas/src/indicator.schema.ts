import { z } from "zod";

export const INDICATOR_TIER_VALUES = [
  "VISI",
  "MISI",
  "TUJUAN_DAERAH",
  "SASARAN_STRATEGIS_DAERAH",
  "TUJUAN_PD",
  "SASARAN_STRATEGIS_PD",
  "SASARAN_PROGRAM",
] as const;

/**
 * Urutan tier yang sah — dipakai untuk menegakkan PRD 5.1:
 * "Hierarki pohon kinerja harus memiliki integritas (tidak boleh ada
 * mission tanpa vision, dll)". Anak hanya boleh satu tingkat di bawah induknya.
 */
export const TIER_ORDER: Record<(typeof INDICATOR_TIER_VALUES)[number], number> = {
  VISI: 0,
  MISI: 1,
  TUJUAN_DAERAH: 2,
  SASARAN_STRATEGIS_DAERAH: 3,
  TUJUAN_PD: 4,
  SASARAN_STRATEGIS_PD: 5,
  SASARAN_PROGRAM: 6,
};

export const targetEntrySchema = z.object({
  year: z.number().int().min(2020).max(2100),
  value: z.string().trim().min(1, "Nilai target wajib diisi"),
});

export const createIndicatorSchema = z.object({
  tier: z.enum(INDICATOR_TIER_VALUES),
  parentId: z.string().nullable(),
  label: z.string().trim().min(5, "Label minimal 5 karakter").max(500),
  ownerWorkUnitId: z.string().nullable().optional(),
  // F-05 — daftar OPD tambahan yang juga berhak melapor untuk indikator ini.
  crossCuttingWorkUnitIds: z.array(z.string()).default([]),
  calculationMethod: z
    .enum(["sum", "average", "weighted_sum", "last_period", "categorical"])
    .default("last_period"),
  polarity: z.enum(["positive", "negative"]).default("positive"),
  allowOverachievement: z.boolean().default(false),
  periodicity: z.enum(["bulanan", "triwulanan", "semesteran", "tahunan"]).default("tahunan"),
  unit: z.string().trim().nullable().optional(),
  baseline: z
    .object({
      year: z.number().int().nullable(),
      value: z.string().nullable(),
    })
    .optional(),
  targets: z.array(targetEntrySchema).default([]),
  classificationTags: z.array(z.enum(["IKU", "IKK", "IKD"])).default([]),
  // Hanya relevan saat calculationMethod === "weighted_sum" -- validasi total
  // bobot = 100% dilakukan terpisah lewat weightedSumVariablesSchema di Server
  // Action (bukan di sini, supaya updateIndicatorSchema.partial() tetap valid).
  variables: z
    .array(z.object({ variableId: z.string(), weight: z.number().min(0).max(100) }))
    .default([]),
});

export type CreateIndicatorInput = z.infer<typeof createIndicatorSchema>;

export const updateIndicatorSchema = createIndicatorSchema.partial().extend({
  id: z.string(),
});
export type UpdateIndicatorInput = z.infer<typeof updateIndicatorSchema>;

/**
 * Weighted-sum validation (PRD 5.1 — "total bobot = 100%"). Divalidasi terpisah
 * dari skema indikator utama karena bobot melekat pada relasi Indicator↔Variable
 * (dokumen berbeda), bukan pada field tunggal di Indicator itu sendiri.
 */
export const weightedSumVariablesSchema = z
  .array(
    z.object({
      variableId: z.string(),
      weight: z.number().min(0).max(100),
    })
  )
  .refine(
    (vars) => {
      const total = vars.reduce((sum, v) => sum + v.weight, 0);
      return Math.abs(total - 100) < 0.01; // toleransi floating point
    },
    { message: "Total bobot seluruh variabel harus tepat 100%." }
  );
