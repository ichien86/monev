import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-09 — Master Data Nomenklatur SIPD (PRD Section 3 F-09, Open Issue #2
 * "Versioning nomenklatur SIPD → Buat history table"). Dicatat OTOMATIS oleh
 * `importBudgetStructure` (F-02) setiap kali kode SIPD yang sama muncul lagi
 * di tahun berjalan tapi salah satu field-nya (nama/level/induk) berbeda dari
 * tahun sebelumnya — memberi Bapperida jejak audit "kenapa nama program ini
 * berubah dari tahun ke tahun", terpisah dari BudgetStructure yang hanya
 * menyimpan snapshot per tahun tanpa riwayat perubahannya sendiri.
 */
const sipdNomenclatureChangeSchema = new Schema(
  {
    sipdCode: { type: String, required: true },
    fromYear: { type: Number, required: true },
    toYear: { type: Number, required: true },
    fieldChanged: { type: String, enum: ["name", "level", "parentSipdCode"], required: true },
    oldValue: { type: String, required: true },
    newValue: { type: String, required: true },
    detectedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

sipdNomenclatureChangeSchema.index({ sipdCode: 1, toYear: -1 });

export type SipdNomenclatureChangeDoc = InferSchemaType<typeof sipdNomenclatureChangeSchema>;

export async function getSipdNomenclatureChangeModel(
  conn?: Connection
): Promise<Model<SipdNomenclatureChangeDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.SipdNomenclatureChange as Model<SipdNomenclatureChangeDoc>) ??
    connection.model<SipdNomenclatureChangeDoc>("SipdNomenclatureChange", sipdNomenclatureChangeSchema)
  );
}
