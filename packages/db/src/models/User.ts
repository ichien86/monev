import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * Peran sesuai PRD v10.2 Section 2 — peran "Walidata" sudah dicabut
 * (validasi teknis bukti kini otomatis oleh sistem, lihat PRD 5.2).
 */
export const USER_ROLES = ["pd_opd", "bapperida", "pimpinan", "admin_sistem"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // DDT v2.0 Section 2.10 — kredensial login PRIMER (PRD 2.1), unique.
    username: { type: String, required: true, lowercase: true, trim: true },
    // Diubah dari required jadi OPSIONAL — hanya untuk notifikasi F-12
    // (bukan lagi index unique primer untuk login, lihat index partial di bawah).
    email: { type: String, default: null, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false }, // Argon2, lihat DDT Section 7
    role: { type: String, enum: USER_ROLES, required: true },
    // Diisi untuk role "pd_opd": OPD tempat pengguna bertugas (relasi ke OrgUnit).
    workUnitId: { type: Schema.Types.ObjectId, ref: "OrgUnit", default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ username: 1 }, { unique: true });
// Partial unique index — hanya menegakkan keunikan untuk dokumen yang
// benar-benar mengisi email (mengabaikan dokumen dengan email: null),
// karena field ini sekarang opsional.
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);
userSchema.index({ role: 1, isActive: 1 });

export type UserDoc = InferSchemaType<typeof userSchema>;

/** Model di-bind ke koneksi `core` secara eksplisit — bukan `mongoose.model()` global,
 *  supaya paket ini aman dipakai dari dua aplikasi (Ops & Eksekutif) tanpa tabrakan. */
export async function getUserModel(conn?: Connection): Promise<Model<UserDoc>> {
  const connection = conn ?? (await connectCore());
  return (connection.models.User as Model<UserDoc>) ?? connection.model<UserDoc>("User", userSchema);
}
