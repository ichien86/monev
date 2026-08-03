import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * Master data bersama (DDT v2.0 Section 2.1, PRD 5.1.4). Realisasinya SELALU
 * global per periode (lihat VariableFinalValue) — satu Variable bisa dipakai
 * di formula banyak Indicator sekaligus. Tidak menyimpan referensi balik ke
 * Indicator manapun; relasi Variable→Indicator hidup di sisi Indicator.formula.
 */
const variableSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

variableSchema.index({ name: "text" });
variableSchema.index({ isActive: 1 });

export type VariableDoc = InferSchemaType<typeof variableSchema>;

export async function getVariableModel(conn?: Connection): Promise<Model<VariableDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.Variable as Model<VariableDoc>) ??
    connection.model<VariableDoc>("Variable", variableSchema)
  );
}
