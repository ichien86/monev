import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * DDT v2.0 Section 2.4 — menggantikan peran FinalValue (v1.0) di level
 * variabel. Unique key SENGAJA tanpa indicatorId — inilah yang membuat nilai
 * ini "global" (PRD 5.1.4): satu variabel dipakai banyak indikator, nilai
 * finalnya cuma satu per periode, dibaca ulang oleh formula indikator manapun
 * yang memakainya (lihat computeIndicatorValue di apps/ops/src/lib/capaian.ts).
 *
 * `sourceRealizationId`/`approvedBy` SENGAJA nullable (beda dari FinalValue
 * v1.0 yang mewajibkan keduanya) — untuk mengakomodasi DDT v2.0 Section 3.5:
 * realisasi dari sourceType satu_data/api ditulis LANGSUNG ke sini oleh job
 * `pull-external-sources`, skip seluruh alur approval manusia sama sekali
 * (PRD 5.2.3 "langsung final"), jadi tidak selalu ada VariableRealization
 * atau User yang menyetujui secara eksplisit.
 */
const variableFinalValueSchema = new Schema(
  {
    variableId: { type: Schema.Types.ObjectId, ref: "Variable", required: true },
    periodYear: { type: Number, required: true },
    periodLabel: { type: String, required: true },

    value: { type: String, required: true },
    sourceRealizationId: { type: Schema.Types.ObjectId, ref: "VariableRealization", default: null },

    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, required: true },

    isLocked: { type: Boolean, default: true },
  },
  { timestamps: true }
);

variableFinalValueSchema.index(
  { variableId: 1, periodYear: 1, periodLabel: 1 },
  { unique: true }
);

export type VariableFinalValueDoc = InferSchemaType<typeof variableFinalValueSchema>;

export async function getVariableFinalValueModel(
  conn?: Connection
): Promise<Model<VariableFinalValueDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.VariableFinalValue as Model<VariableFinalValueDoc>) ??
    connection.model<VariableFinalValueDoc>("VariableFinalValue", variableFinalValueSchema)
  );
}
