import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-08 — Rekonsiliasi & Mediasi Data (PRD 5.3, DDT Section 5.3).
 * `isLocked: true` merepresentasikan prinsip "True Single Source of Truth"
 * (PRD 4.1): setelah approved, nilai hanya bisa berubah lewat mekanisme
 * Override (lihat AuditLog.ts) — TIDAK PERNAH lewat update biasa.
 */
const finalValueSchema = new Schema(
  {
    indicatorId: { type: Schema.Types.ObjectId, ref: "Indicator", required: true },
    workUnitId: { type: Schema.Types.ObjectId, ref: "OrgUnit", required: true },
    periodYear: { type: Number, required: true },
    periodLabel: { type: String, required: true },

    value: { type: String, required: true },
    sourceSubmissionId: { type: Schema.Types.ObjectId, ref: "Submission", required: true },

    approvedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedAt: { type: Date, required: true },

    isLocked: { type: Boolean, default: true },
  },
  { timestamps: true }
);

finalValueSchema.index(
  { indicatorId: 1, workUnitId: 1, periodYear: 1, periodLabel: 1 },
  { unique: true }
);

export type FinalValueDoc = InferSchemaType<typeof finalValueSchema>;

export async function getFinalValueModel(conn?: Connection): Promise<Model<FinalValueDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.FinalValue as Model<FinalValueDoc>) ??
    connection.model<FinalValueDoc>("FinalValue", finalValueSchema)
  );
}
