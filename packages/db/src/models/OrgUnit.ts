import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-10 — Pengaturan Urusan Pemerintahan per Unit Kerja (PRD 5.x, Section 3 F-10).
 * Satu OPD bisa membawahi beberapa "urusan" pemerintahan (mis. Dinas Peternakan
 * dan Perikanan membawahi urusan Peternakan DAN Perikanan sekaligus — lihat
 * data riil RPJMD kode 3.25 & 3.27 pada Tabel IV.1).
 */
const orgUnitSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // "Dinas Ketahanan Pangan"
    sipdCode: { type: String, required: true, unique: true }, // "2.09.0.00.0.00.01.0000"
    urusan: [{ type: String, trim: true }], // ["Ketahanan Pangan"]
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

orgUnitSchema.index({ name: "text" }); // pencarian sederhana, lihat DDT Section 11

export type OrgUnitDoc = InferSchemaType<typeof orgUnitSchema>;

export async function getOrgUnitModel(conn?: Connection): Promise<Model<OrgUnitDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.OrgUnit as Model<OrgUnitDoc>) ??
    connection.model<OrgUnitDoc>("OrgUnit", orgUnitSchema)
  );
}
