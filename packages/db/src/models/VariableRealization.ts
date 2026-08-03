import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * DDT v2.0 Section 2.3 — menggantikan peran Submission (v1.0) di level
 * variabel. `indicatorId` disimpan untuk konteks/filter (jejak proses "siapa
 * submit dari konteks indikator apa"), TAPI realisasi final yang benar-benar
 * dipakai lintas indikator adalah VariableFinalValue, di-key murni oleh
 * (variableId, periodYear, periodLabel) — bukan dokumen ini.
 */
export const VARIABLE_REALIZATION_STATUSES = [
  "validasi_link",
  "validasi_format",
  "validasi_ekstraksi",
  "menunggu_konfirmasi_pd",
  "ditandai_gagal_ekstrak",
  "menunggu_admin_perencana",
  "disetujui",
  "ditolak",
  "final_otomatis",
] as const;
export type VariableRealizationStatus = (typeof VARIABLE_REALIZATION_STATUSES)[number];

export const VARIABLE_SOURCE_TYPES = ["manual", "satu_data", "api"] as const;
export type VariableSourceType = (typeof VARIABLE_SOURCE_TYPES)[number];

const variableRealizationSchema = new Schema(
  {
    variableId: { type: Schema.Types.ObjectId, ref: "Variable", required: true },
    indicatorId: { type: Schema.Types.ObjectId, ref: "Indicator", required: true },
    workUnitId: { type: Schema.Types.ObjectId, ref: "OrgUnit", required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Mengikuti periodisitas INDICATOR induk (PRD 4.1), bukan variabel.
    periodYear: { type: Number, required: true },
    periodLabel: { type: String, required: true },

    reportedValue: { type: String, required: true },
    // null jika sourceType != "manual" (satu_data/api tidak butuh bukti dokumen).
    evidenceLink: { type: String, default: null },

    status: { type: String, enum: VARIABLE_REALIZATION_STATUSES, default: "validasi_link" },

    systemValidation: {
      linkAccessible: { type: Boolean, default: null },
      formatValid: { type: Boolean, default: null },
      extractedValue: { type: String, default: null },
      extractionMatched: { type: Boolean, default: null },
      failureReason: { type: String, default: null },
    },

    // Salinan dari Indicator.variableSources saat submission dibuat —
    // snapshot, bukan referensi hidup (kalau konfigurasi sumber berubah
    // belakangan, realisasi lama tidak ikut berubah maknanya).
    sourceType: { type: String, enum: VARIABLE_SOURCE_TYPES, required: true },

    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionNote: { type: String, default: null },

    // F-06 — ditandai saat job escalate-stale-reviews mengeskalasi realisasi
    // ini (menunggu review > 5 hari). Null = belum pernah dieskalasi.
    escalatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

variableRealizationSchema.index({ variableId: 1, periodYear: 1, periodLabel: 1, status: 1 });
variableRealizationSchema.index({ indicatorId: 1, workUnitId: 1, periodYear: 1 });
variableRealizationSchema.index({ status: 1, createdAt: 1 });

export type VariableRealizationDoc = InferSchemaType<typeof variableRealizationSchema>;

export async function getVariableRealizationModel(
  conn?: Connection
): Promise<Model<VariableRealizationDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.VariableRealization as Model<VariableRealizationDoc>) ??
    connection.model<VariableRealizationDoc>("VariableRealization", variableRealizationSchema)
  );
}
