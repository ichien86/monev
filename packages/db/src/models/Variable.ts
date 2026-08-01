import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-01 — Master Data Variabel (PRD 5.1, DDT Section 5.1 & 11). Katalog
 * variabel statistik/sumber data (mis. dari BPS atau SIPD) yang bisa dirujuk
 * oleh indikator dengan `calculationMethod: "weighted_sum"` — lihat
 * `weightedSumVariablesSchema` di @simonev/schemas dan field `variables` di
 * IndicatorDoc. Satu Variable bisa dipakai oleh banyak indikator komposit
 * dengan bobot berbeda-beda, karena itu bobotnya melekat pada Indicator
 * (relasi), bukan pada Variable itu sendiri.
 */
const variableSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // "Angka Harapan Hidup"
    code: { type: String, trim: true, default: null }, // kode BPS/SIPD, opsional
    unit: { type: String, trim: true, default: null }, // "Tahun", "%", "Poin"
    source: { type: String, trim: true, default: null }, // "BPS", "SIPD", "Manual"
    description: { type: String, trim: true, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hybrid search (DDT Section 11): text index untuk pencocokan kata utuh,
// dikombinasikan pencarian trigram sederhana di level aplikasi (lihat
// listVariables di apps/ops/.../variabel/actions.ts) untuk toleransi typo/kata
// sebagian — skala data variabel RPJMD ratusan entri, cukup tanpa Elasticsearch.
variableSchema.index({ name: "text", description: "text" });
variableSchema.index({ code: 1 }, { unique: true, sparse: true });

export type VariableDoc = InferSchemaType<typeof variableSchema>;

export async function getVariableModel(conn?: Connection): Promise<Model<VariableDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.Variable as Model<VariableDoc>) ??
    connection.model<VariableDoc>("Variable", variableSchema)
  );
}
