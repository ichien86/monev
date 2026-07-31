import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-02 — Tema dikonfigurasi bebas oleh Bapperida (PRD 5.6), bukan daftar
 * tetap dari sistem. Contoh: Stunting, Kemiskinan Ekstrem, Ketahanan Pangan.
 */
const themeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    colorHex: { type: String, required: true, default: "#4A6FA5" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export type ThemeDoc = InferSchemaType<typeof themeSchema>;

export async function getThemeModel(conn?: Connection): Promise<Model<ThemeDoc>> {
  const connection = conn ?? (await connectCore());
  return (connection.models.Theme as Model<ThemeDoc>) ?? connection.model<ThemeDoc>("Theme", themeSchema);
}
