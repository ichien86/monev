import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * Log audit terpisah dari FinalValue (PRD 5.4) — sengaja tabel/koleksi
 * berbeda, bukan sub-array di dalam FinalValue, supaya riwayat tidak pernah
 * bisa "hilang" akibat operasi yang menyentuh dokumen FinalValue itu sendiri.
 *
 * Ditulis SELALU dalam satu transaksi MongoDB bersama perubahan FinalValue
 * (lihat DDT Section 6.2 dan Server Action overrideFinalValue).
 */
const auditLogSchema = new Schema(
  {
    finalValueId: { type: Schema.Types.ObjectId, ref: "FinalValue", required: true },
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

auditLogSchema.index({ finalValueId: 1, performedAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;

export async function getAuditLogModel(conn?: Connection): Promise<Model<AuditLogDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.AuditLog as Model<AuditLogDoc>) ??
    connection.model<AuditLogDoc>("AuditLog", auditLogSchema)
  );
}
