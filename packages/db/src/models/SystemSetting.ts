import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * DDT v2.0 Section 2.11 — Tahun Aktif (PRD 5.5.1). Satu dokumen singleton
 * dengan _id tetap "tahun_aktif" — BUKAN bagian dari Schedule (yang sifatnya
 * banyak dokumen per indikator/tagging). Dibaca lewat helper getTahunAktif()
 * di apps/ops/src/lib/system-setting.ts (cache in-memory + invalidation).
 */
const systemSettingSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true },
    setBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    setAt: { type: Date, required: true },
  },
  { timestamps: true, _id: false }
);

export type SystemSettingDoc = InferSchemaType<typeof systemSettingSchema>;

export async function getSystemSettingModel(conn?: Connection): Promise<Model<SystemSettingDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.SystemSetting as Model<SystemSettingDoc>) ??
    connection.model<SystemSettingDoc>("SystemSetting", systemSettingSchema)
  );
}
