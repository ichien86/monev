import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-01 — Master Data Indikator & Pohon Kinerja (PRD 5.1, 4.1).
 *
 * Tujuh tingkat hierarki sesuai PRD:
 * VISI → MISI → TUJUAN_DAERAH → SASARAN_STRATEGIS_DAERAH → TUJUAN_PD
 *      → SASARAN_STRATEGIS_PD → SASARAN_PROGRAM
 *
 * `path` adalah "materialized path": daftar seluruh leluhur node ini dari akar
 * hingga induk langsung. Ini membuat query "ambil seluruh keturunan node X"
 * cukup satu query (`{ path: nodeId }`) tanpa rekursi — penting untuk performa
 * dashboard (NFR: API < 500ms, PRD Section 6).
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

export const CALCULATION_METHODS = [
  "sum",
  "average",
  "weighted_sum",
  "last_period",
  "categorical",
] as const;

const indicatorSchema = new Schema(
  {
    tier: { type: String, enum: INDICATOR_TIERS, required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Indicator", default: null },
    path: [{ type: Schema.Types.ObjectId, ref: "Indicator" }],

    label: { type: String, required: true, trim: true },

    // Diisi mulai tier TUJUAN_PD ke bawah — OPD penanggung jawab utama.
    ownerWorkUnitId: { type: Schema.Types.ObjectId, ref: "OrgUnit", default: null },

    // F-05 — Target Silang Sektor (PRD Section 3 F-05). Kosong = indikator
    // biasa (single-owner, asumsi rilis awal F-08 di PRD 5.3). Non-kosong =
    // indikator cross-cutting: OPD di luar ownerWorkUnitId yang tercantum di
    // sini JUGA berhak melapor untuk indikator ini (lihat F-04
    // listReportableIndicators). Setiap OPD tetap punya FinalValue miliknya
    // sendiri (keyed indicatorId+workUnitId+period, tidak berubah) — F-05
    // menambah KEMAMPUAN MELIHAT & MENJUMLAHKAN seluruh kontribusi OPD lewat
    // getCrossCuttingRollup(), bukan memaksa satu nilai tunggal yang
    // diperebutkan banyak OPD (lihat komentar lengkap di rekonsiliasi/actions.ts).
    crossCuttingWorkUnitIds: [{ type: Schema.Types.ObjectId, ref: "OrgUnit" }],

    calculationMethod: { type: String, enum: CALCULATION_METHODS, default: "last_period" },
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
indicatorSchema.index({ crossCuttingWorkUnitIds: 1 });
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
