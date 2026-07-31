import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-02 — prasyarat tagging (PRD 5.6): struktur anggaran Program/Kegiatan/
 * Subkegiatan hasil impor SIPD, sampai level rekening belanja (pagu per
 * tahun). Materialized `path` dipakai persis seperti di Indicator.ts —
 * supaya menghitung "tagging mana saja yang efektif berlaku di subkegiatan X"
 * (termasuk yang diwariskan dari cascade Program/Kegiatan) cukup satu query,
 * lihat catatan lengkap di Tagging.ts.
 */
export const BUDGET_STRUCTURE_LEVELS = ["program", "kegiatan", "subkegiatan"] as const;
export type BudgetStructureLevel = (typeof BUDGET_STRUCTURE_LEVELS)[number];

const budgetStructureSchema = new Schema(
  {
    level: { type: String, enum: BUDGET_STRUCTURE_LEVELS, required: true },
    sipdCode: { type: String, required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "BudgetStructure", default: null },
    path: [{ type: Schema.Types.ObjectId, ref: "BudgetStructure" }],

    name: { type: String, required: true, trim: true },
    budgetYear: { type: Number, required: true },
    pagu: { type: Number, required: true },
    ownerWorkUnitId: { type: Schema.Types.ObjectId, ref: "OrgUnit", default: null },
  },
  { timestamps: true }
);

// Kode SIPD unik PER TAHUN (kode yang sama bisa muncul lagi tahun berikutnya
// dengan pagu berbeda — itulah mekanisme "copy-advice antar tahun" PRD 5.6).
budgetStructureSchema.index({ sipdCode: 1, budgetYear: 1 }, { unique: true });
budgetStructureSchema.index({ parentId: 1, budgetYear: 1 });
budgetStructureSchema.index({ path: 1 });

budgetStructureSchema.pre("save", async function (next) {
  if (!this.isModified("parentId")) return next();

  if (!this.parentId) {
    this.path = [];
    return next();
  }
  const parentId = this.parentId;

  type BudgetStructureModelType = import("mongoose").Model<InferSchemaType<typeof budgetStructureSchema>>;
  const BudgetStructureModel = this.constructor as BudgetStructureModelType;
  const parent = await BudgetStructureModel.findById(parentId).lean();
  if (!parent) return next(new Error("BudgetStructure parentId tidak ditemukan."));

  const parentPath = (parent.path ?? []).filter(
    (id): id is import("mongoose").Types.ObjectId => id != null
  );
  this.path = [...parentPath, parentId];
  next();
});

export type BudgetStructureDoc = InferSchemaType<typeof budgetStructureSchema>;

export async function getBudgetStructureModel(conn?: Connection): Promise<Model<BudgetStructureDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.BudgetStructure as Model<BudgetStructureDoc>) ??
    connection.model<BudgetStructureDoc>("BudgetStructure", budgetStructureSchema)
  );
}
