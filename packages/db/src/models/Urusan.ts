import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * DDT v2.0 Section 2.8 — koleksi referensi murni (bukan hasil impor SIPD
 * tahunan seperti BudgetStructure). 9 dokumen, diisi sekali lewat seed,
 * jarang berubah.
 */
const urusanSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export type UrusanDoc = InferSchemaType<typeof urusanSchema>;

export async function getUrusanModel(conn?: Connection): Promise<Model<UrusanDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.Urusan as Model<UrusanDoc>) ?? connection.model<UrusanDoc>("Urusan", urusanSchema)
  );
}
