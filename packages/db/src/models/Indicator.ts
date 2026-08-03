import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-01 — Master Data Indikator & Pohon Kinerja (PRD 5.1, 4.1; DDT v2.0
 * Section 2.2).
 *
 * Tujuh tingkat hierarki sesuai PRD:
 * VISI → MISI → TUJUAN_DAERAH → SASARAN_STRATEGIS_DAERAH → TUJUAN_PD
 *      → SASARAN_STRATEGIS_PD → SASARAN_PROGRAM
 *
 * `path` adalah "materialized path": daftar seluruh leluhur node ini dari akar
 * hingga induk langsung. Ini membuat query "ambil seluruh keturunan node X"
 * cukup satu query (`{ path: nodeId }`) tanpa rekursi — penting untuk performa
 * dashboard (NFR: API < 500ms, PRD Section 6).
 *
 * DDT v2.0 — pergeseran arsitektur ke level Variabel: indikator TIDAK LAGI
 * diisi/disetujui langsung (lihat VariableRealization/VariableFinalValue).
 * Nilainya dihitung dari `formula` (daftar Variable + peran) lewat
 * computeIndicatorValue() di apps/ops/src/lib/capaian.ts, dievaluasi saat
 * dibutuhkan (atau di-cache di ReadmodelSnapshot).
 */
export const INDICATOR_TIERS = [
  "VISI",
  "MISI",
  "TUJUAN_DAERAH",
  "SASARAN_STRATEGIS_DAERAH",
  "TUJUAN_PD",
  "SASARAN_STRATEGIS_PD",
  "SASARAN_PROGRAM",
] as const;
export type IndicatorTier = (typeof INDICATOR_TIERS)[number];

/** DDT v2.0 Section 2.2 — menggantikan 5 metode lama (sum/average/weighted_sum/last_period/categorical). */
export const CALCULATION_METHODS = [
  "variabel_tunggal",
  "persentase",
  "penjumlahan",
  "rata_rata",
  "penjumlahan_berbobot",
  "selisih",
  "rasio",
  "kategorikal",
] as const;
export type CalculationMethod = (typeof CALCULATION_METHODS)[number];

export const FORMULA_ROLES = ["tunggal", "pembilang", "penyebut", "komponen", "pengurang"] as const;
export type FormulaRole = (typeof FORMULA_ROLES)[number];

export const CROSS_CUTTING_TYPES = ["berbagi", "terpisah"] as const;
export type CrossCuttingType = (typeof CROSS_CUTTING_TYPES)[number];

export const SPLIT_CONFIG_MODES = ["dijumlahkan", "ditunjuk"] as const;
export type SplitConfigMode = (typeof SPLIT_CONFIG_MODES)[number];

export const VARIABLE_DATA_SOURCE_TYPES = ["manual", "satu_data", "api"] as const;
export type VariableDataSourceType = (typeof VARIABLE_DATA_SOURCE_TYPES)[number];

const indicatorSchema = new Schema(
  {
    tier: { type: String, enum: INDICATOR_TIERS, required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Indicator", default: null },
    path: [{ type: Schema.Types.ObjectId, ref: "Indicator" }],

    label: { type: String, required: true, trim: true },

    // Diisi mulai tier TUJUAN_PD ke bawah — OPD penanggung jawab utama.
    ownerWorkUnitId: { type: Schema.Types.ObjectId, ref: "OrgUnit", default: null },

    // DDT v2.0 Section 2.2 — 8 metode, diterapkan lewat computeIndicatorValue().
    calculationMethod: { type: String, enum: CALCULATION_METHODS, default: "variabel_tunggal" },

    // Daftar Variable pembentuk formula + peran masing-masing.
    formula: [
      {
        variableId: { type: Schema.Types.ObjectId, ref: "Variable", required: true },
        role: { type: String, enum: FORMULA_ROLES, required: true },
        // hanya dipakai untuk calculationMethod="penjumlahan_berbobot", total wajib 100 (divalidasi Zod)
        weight: { type: Number, default: null },
        _id: false,
      },
    ],

    // Kategorikal (PRD 5.1.5) — nilai VariableFinalValue untuk variabel
    // kategorikal menyimpan LABEL kategori, capaian%-nya di-lookup dari sini.
    categories: [
      { label: { type: String, required: true }, capaianPercent: { type: Number, required: true }, _id: false },
    ],

    // F-05 Cross-Cutting (PRD 5.4, DDT v2.0 Section 2.2) — per Indicator,
    // bukan per Variable, karena ini properti "siapa boleh lapor untuk
    // indikator ini", bukan properti variabel itu sendiri.
    crossCutting: {
      type: { type: String, enum: CROSS_CUTTING_TYPES, default: null },
      primaryWorkUnitId: { type: Schema.Types.ObjectId, ref: "OrgUnit", default: null }, // Tipe Berbagi
      workUnitIds: [{ type: Schema.Types.ObjectId, ref: "OrgUnit" }], // seluruh PD terlibat (kedua tipe)
      // Tipe Terpisah — pengaturan PER VARIABEL dalam formula (PRD 5.4.2):
      // satu formula bisa punya variabel "dijumlahkan" dan variabel
      // "ditunjuk" sekaligus.
      splitConfig: [
        {
          variableId: { type: Schema.Types.ObjectId, ref: "Variable", required: true },
          mode: { type: String, enum: SPLIT_CONFIG_MODES, required: true },
          designatedWorkUnitId: { type: Schema.Types.ObjectId, ref: "OrgUnit", default: null }, // wajib jika mode="ditunjuk"
          _id: false,
        },
      ],
    },

    // F-01 5.1.6 — wajib untuk tier SASARAN_PROGRAM.
    linkedProgramId: { type: Schema.Types.ObjectId, ref: "BudgetStructure", default: null },

    // Target RPJMD (PRD 5.6.2) — "Akumulatif untuk Periode RPJMD?"
    rpjmdCumulative: { type: Boolean, default: false },

    // Pengelolaan Sumber Data (PRD 5.2.3) — per variabel dalam formula.
    variableSources: [
      {
        variableId: { type: Schema.Types.ObjectId, ref: "Variable", required: true },
        sourceType: { type: String, enum: VARIABLE_DATA_SOURCE_TYPES, required: true },
        apiConnectorKey: { type: String, default: null }, // wajib jika sourceType="api"
        _id: false,
      },
    ],

    polarity: { type: String, enum: ["positive", "negative"], default: "positive" },
    allowOverachievement: { type: Boolean, default: false },
    periodicity: {
      type: String,
      enum: ["bulanan", "triwulanan", "semesteran", "tahunan"],
      default: "tahunan",
    },
    unit: { type: String, default: null }, // satuan: "%", "Poin", "Rp Juta", dst.

    baseline: {
      year: { type: Number, default: null },
      value: { type: String, default: null }, // String: RPJMD kadang memuat rentang, mis. "5,70-5,94"
    },
    targets: [
      {
        year: { type: Number, required: true },
        value: { type: String, required: true },
        _id: false,
      },
    ],

    // Hanya relevan saat calculationMethod === "weighted_sum" (PRD 5.1) --
    // bobot tiap Variable rujukan, ditegakkan totalnya = 100% di Server Action
    // (lihat weightedSumVariablesSchema di @simonev/schemas).
    variables: [
      {
        variableId: { type: Schema.Types.ObjectId, ref: "Variable", required: true },
        weight: { type: Number, required: true, min: 0, max: 100 },
        _id: false,
      },
    ],

    // Historical Integrity (PRD 4.1): saat definisi/metode berubah, node lama
    // di-nonaktifkan dan digantikan node baru — bukan di-overwrite.
    isActive: { type: Boolean, default: true },
    supersededBy: { type: Schema.Types.ObjectId, ref: "Indicator", default: null },

    // IKU/IKK/IKD bersifat tag klasifikasi opsional, BUKAN tingkatan hierarki
    // (klarifikasi eksplisit dari histori diskusi PRD).
    classificationTags: [{ type: String, enum: ["IKU", "IKK", "IKD"] }],
  },
  { timestamps: true }
);

indicatorSchema.index({ parentId: 1 });
indicatorSchema.index({ path: 1 });
indicatorSchema.index({ ownerWorkUnitId: 1, isActive: 1 });
indicatorSchema.index({ "crossCutting.workUnitIds": 1 });
indicatorSchema.index({ "formula.variableId": 1 });
indicatorSchema.index({ tier: 1, isActive: 1 });

/**
 * Hook: menjaga integritas hierarki (PRD 5.1 — "tidak boleh ada mission tanpa
 * vision, dll") dengan membangun `path` otomatis dari parent saat dokumen dibuat.
 * Validasi urutan tier yang sah tetap dilakukan di service layer (lihat
 * apps/ops .../pohon-kinerja/actions.ts) karena butuh membaca dokumen parent.
 */
indicatorSchema.pre("save", async function (next) {
  if (!this.isModified("parentId")) return next();

  if (!this.parentId) {
    this.path = [];
    return next();
  }
  const parentId = this.parentId;

  type IndicatorModelType = import("mongoose").Model<InferSchemaType<typeof indicatorSchema>>;
  const IndicatorModel = this.constructor as IndicatorModelType;
  const parent = await IndicatorModel.findById(parentId).lean();
  if (!parent) return next(new Error("Indicator parentId tidak ditemukan."));

  const parentPath = (parent.path ?? []).filter(
    (id): id is import("mongoose").Types.ObjectId => id != null
  );
  this.path = [...parentPath, parentId];
  next();
});

export type IndicatorDoc = InferSchemaType<typeof indicatorSchema>;

export async function getIndicatorModel(conn?: Connection): Promise<Model<IndicatorDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.Indicator as Model<IndicatorDoc>) ??
    connection.model<IndicatorDoc>("Indicator", indicatorSchema)
  );
}
