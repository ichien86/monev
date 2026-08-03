import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * Log audit terpisah dari VariableFinalValue (PRD 5.4) — sengaja tabel/
 * koleksi berbeda, bukan sub-array di dalam VariableFinalValue, supaya
 * riwayat tidak pernah bisa "hilang" akibat operasi yang menyentuh dokumen
 * VariableFinalValue itu sendiri.
 *
 * Ditulis SELALU dalam satu transaksi MongoDB bersama perubahan
 * VariableFinalValue (lihat DDT v2.0 Section 3.1 dan Server Action
 * overrideVariableFinalValue). DDT v2.0 — mengacu ke VariableFinalValue
 * (bukan FinalValue level-indikator lagi, lihat DDT v2.0 Section 2.3–2.4).
 */
const auditLogSchema = new Schema(
  {
    variableFinalValueId: { type: Schema.Types.ObjectId, ref: "VariableFinalValue", required: true },
    action: { type: String, enum: ["approve", "override"], required: true },

    previousValue: { type: String, default: null }, // null untuk action "approve" pertama kali
    newValue: { type: String, required: true },

    // Wajib diisi ≥500 karakter khusus untuk action "override" — ditegakkan
    // di Zod (overrideFinalValueSchema), bukan di sini, karena "approve"
    // tidak memerlukan alasan sepanjang itu.
    reason: { type: String, default: null },

    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    performedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

auditLogSchema.index({ variableFinalValueId: 1, performedAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;

export async function getAuditLogModel(conn?: Connection): Promise<Model<AuditLogDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.AuditLog as Model<AuditLogDoc>) ??
    connection.model<AuditLogDoc>("AuditLog", auditLogSchema)
  );
}
