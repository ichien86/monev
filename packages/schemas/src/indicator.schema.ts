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

/** DDT v2.0 Section 2.2 — 8 metode, menggantikan 5 metode lama (sum/average/weighted_sum/last_period/categorical). */
export const CALCULATION_METHOD_VALUES = [
  "variabel_tunggal",
  "persentase",
  "penjumlahan",
  "rata_rata",
  "penjumlahan_berbobot",
  "selisih",
  "rasio",
  "kategorikal",
] as const;

export const FORMULA_ROLE_VALUES = ["tunggal", "pembilang", "penyebut", "komponen", "pengurang"] as const;
export const CROSS_CUTTING_TYPE_VALUES = ["berbagi", "terpisah"] as const;
export const SPLIT_CONFIG_MODE_VALUES = ["dijumlahkan", "ditunjuk"] as const;
export const VARIABLE_DATA_SOURCE_TYPE_VALUES = ["manual", "satu_data", "api"] as const;

export const targetEntrySchema = z.object({
  year: z.number().int().min(2020).max(2100),
  value: z.string().trim().min(1, "Nilai target wajib diisi"),
});

/** DDT v2.0 Section 2.2 — satu baris formula: Variable pembentuk + perannya. */
export const formulaEntrySchema = z.object({
  variableId: z.string(),
  role: z.enum(FORMULA_ROLE_VALUES),
  weight: z.number().min(0).max(100).nullable().default(null),
});

/** DDT v2.0 Section 3.2 — lookup label kategori → capaian% (calculationMethod="kategorikal"). */
export const categoryEntrySchema = z.object({
  label: z.string().trim().min(1),
  capaianPercent: z.number().min(0),
});

/** DDT v2.0 Section 2.2 & 3.3 — F-05 Cross-Cutting per Indicator. */
export const crossCuttingSplitConfigEntrySchema = z
  .object({
    variableId: z.string(),
    mode: z.enum(SPLIT_CONFIG_MODE_VALUES),
    designatedWorkUnitId: z.string().nullable().default(null),
  })
  .refine((entry) => entry.mode !== "ditunjuk" || entry.designatedWorkUnitId !== null, {
    message: "designatedWorkUnitId wajib diisi untuk mode 'ditunjuk'.",
    path: ["designatedWorkUnitId"],
  });

export const crossCuttingSchema = z.object({
  type: z.enum(CROSS_CUTTING_TYPE_VALUES).nullable().default(null),
  primaryWorkUnitId: z.string().nullable().default(null),
  workUnitIds: z.array(z.string()).default([]),
  splitConfig: z.array(crossCuttingSplitConfigEntrySchema).default([]),
});

/** DDT v2.0 Section 2.2 & 3.5 — Pengelolaan Sumber Data per variabel dalam formula. */
export const variableSourceEntrySchema = z
  .object({
    variableId: z.string(),
    sourceType: z.enum(VARIABLE_DATA_SOURCE_TYPE_VALUES),
    apiConnectorKey: z.string().trim().nullable().default(null),
  })
  .refine((entry) => entry.sourceType !== "api" || Boolean(entry.apiConnectorKey), {
    message: "apiConnectorKey wajib diisi untuk sourceType 'api'.",
    path: ["apiConnectorKey"],
  });

export const createIndicatorSchema = z
  .object({
    tier: z.enum(INDICATOR_TIER_VALUES),
    parentId: z.string().nullable(),
    label: z.string().trim().min(5, "Label minimal 5 karakter").max(500),
    ownerWorkUnitId: z.string().nullable().optional(),
    calculationMethod: z.enum(CALCULATION_METHOD_VALUES).default("variabel_tunggal"),
    formula: z.array(formulaEntrySchema).default([]),
    categories: z.array(categoryEntrySchema).default([]),
    crossCutting: crossCuttingSchema.default({
      type: null,
      primaryWorkUnitId: null,
      workUnitIds: [],
      splitConfig: [],
    }),
    // F-01 5.1.6 — wajib untuk tier SASARAN_PROGRAM (divalidasi lewat .refine di bawah).
    linkedProgramId: z.string().nullable().default(null),
    rpjmdCumulative: z.boolean().default(false),
    variableSources: z.array(variableSourceEntrySchema).default([]),
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
  })
  .refine((data) => data.tier !== "SASARAN_PROGRAM" || data.linkedProgramId !== null, {
    message: "linkedProgramId wajib diisi untuk tier SASARAN_PROGRAM (PRD 5.1.6).",
    path: ["linkedProgramId"],
  })
  .refine((data) => data.tier !== "SASARAN_PROGRAM" || data.formula.length > 0, {
    message: "Formula wajib berisi minimal satu Variable untuk tier SASARAN_PROGRAM.",
    path: ["formula"],
  })
  .refine(
    (data) => {
      if (data.calculationMethod !== "penjumlahan_berbobot") return true;
      const total = data.formula.reduce((sum, f) => sum + (f.weight ?? 0), 0);
      return Math.abs(total - 100) < 0.01; // toleransi floating point
    },
    { message: "Total bobot seluruh variabel dalam formula harus tepat 100% (penjumlahan_berbobot).", path: ["formula"] }
  )
  .refine((data) => data.calculationMethod !== "kategorikal" || data.categories.length > 0, {
    message: "Minimal satu kategori wajib diisi untuk calculationMethod 'kategorikal'.",
    path: ["categories"],
  });

export type CreateIndicatorInput = z.infer<typeof createIndicatorSchema>;

export const updateIndicatorSchema = createIndicatorSchema.and(z.object({ id: z.string() }));
export type UpdateIndicatorInput = z.infer<typeof updateIndicatorSchema>;
