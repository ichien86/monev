import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * DDT v2.0 Section 2.8 — koleksi referensi murni, 44 dokumen, tiap Bidang
 * Urusan bernaung di bawah satu Urusan (PRD 5.8.1).
 */
const bidangUrusanSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    urusanId: { type: Schema.Types.ObjectId, ref: "Urusan", required: true },
  },
  { timestamps: true }
);

bidangUrusanSchema.index({ urusanId: 1 });

export type BidangUrusanDoc = InferSchemaType<typeof bidangUrusanSchema>;

export async function getBidangUrusanModel(conn?: Connection): Promise<Model<BidangUrusanDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.BidangUrusan as Model<BidangUrusanDoc>) ??
    connection.model<BidangUrusanDoc>("BidangUrusan", bidangUrusanSchema)
  );
}
