import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-10 — Pengaturan Urusan Pemerintahan per Unit Kerja (PRD 5.8/5.9, DDT v2.0
 * Section 2.9). Satu OPD bisa membawahi beberapa Bidang Urusan pemerintahan
 * (mis. Dinas Peternakan dan Perikanan membawahi Bidang Urusan Peternakan
 * DAN Perikanan sekaligus — lihat data riil RPJMD kode 3.25 & 3.27 pada
 * Tabel IV.1), maksimal 3 per PD (PRD 5.9 — divalidasi di Server Action,
 * Mongoose tidak native mendukung batas panjang array di skema).
 */
const orgUnitSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // "Dinas Ketahanan Pangan"
    sipdCode: { type: String, required: true, unique: true }, // "2.09.0.00.0.00.01.0000"
    // DDT v2.0 — menggantikan `urusan` (String[] bebas teks) versi v1.0.
    bidangUrusanIds: [{ type: Schema.Types.ObjectId, ref: "BidangUrusan" }],
    // PD Eksternal (PRD 5.9.2) — mis. BPS/Kemenag. Memakai role pd_opd yang
    // sama persis; tidak ada RBAC check eksplisit terpisah untuk flag ini
    // (lihat DDT v2.0 Section 4.2).
    isExternal: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

orgUnitSchema.index({ name: "text" }); // pencarian sederhana, lihat DDT Section 11
orgUnitSchema.index({ bidangUrusanIds: 1 });

export type OrgUnitDoc = InferSchemaType<typeof orgUnitSchema>;

export async function getOrgUnitModel(conn?: Connection): Promise<Model<OrgUnitDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.OrgUnit as Model<OrgUnitDoc>) ??
    connection.model<OrgUnitDoc>("OrgUnit", orgUnitSchema)
  );
}
