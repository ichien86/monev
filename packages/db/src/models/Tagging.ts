import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-02 — Inti modul Tagging Anggaran Tematik (PRD 5.6).
 *
 * KEPUTUSAN DESAIN PENTING — cascade dihitung saat BACA, bukan disimpan
 * sebagai salinan fisik: satu Tagging disimpan persis di level tempat
 * Bapperida membuatnya (program/kegiatan/subkegiatan). Untuk tahu "tema apa
 * saja yang efektif berlaku di subkegiatan X" (termasuk warisan dari Program
 * atau Kegiatan induknya), query memanfaatkan `path` milik BudgetStructure:
 *
 *   Tagging.find({ budgetStructureId: { $in: [X._id, ...X.path] } })
 *
 * Alasan memilih ini dibanding menduplikasi Tagging ke setiap descendant
 * saat cascade terjadi: descendant baru bisa muncul kapan saja (APBD-P,
 * subkegiatan baru) — kalau cascade disimpan fisik, setiap penambahan
 * descendant baru butuh proses sinkronisasi ulang yang gampang lupa/meleset.
 * Dengan pendekatan "hitung saat baca", descendant baru otomatis ikut ter-tag
 * begitu import SIPD berikutnya menautkan `parentId`-nya — tanpa proses
 * sinkronisasi terpisah sama sekali.
 *
 * Overlap antar tema SENGAJA tidak divalidasi/dibatasi (PRD 5.6 — overlap
 * merepresentasikan "kinerja berbagi pakai", bukan kesalahan data).
 */
const taggingSchema = new Schema(
  {
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true },
    budgetStructureId: { type: Schema.Types.ObjectId, ref: "BudgetStructure", required: true },
    budgetYear: { type: Number, required: true },

    coverage: { type: String, enum: ["penuh", "sebagian"], required: true },
    // Diisi PD saat realisasi (PRD 5.6) — null sampai entri split terjadi.
    coveragePercent: { type: Number, default: null, min: 0, max: 100 },
    splitEnteredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    splitEnteredAt: { type: Date, default: null },

    // Jadwal entri split diatur Bapperida per tagging (PRD 5.6), bukan
    // mengikuti siklus SIPD otomatis — lihat F-03 Schedule (scope
    // "entri_split_tagging", refId = _id dokumen Tagging ini).
    requiresSubTagging: { type: Boolean, default: false },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Satu kombinasi tema+struktur+tahun hanya boleh punya SATU dokumen tagging
// langsung (mencegah duplikasi entri, BUKAN mencegah overlap antar tema —
// overlap antar TEMA BERBEDA pada struktur yang sama tetap bebas terjadi).
taggingSchema.index({ themeId: 1, budgetStructureId: 1, budgetYear: 1 }, { unique: true });
taggingSchema.index({ budgetStructureId: 1 });
taggingSchema.index({ coverage: 1, coveragePercent: 1 });

export type TaggingDoc = InferSchemaType<typeof taggingSchema>;

export async function getTaggingModel(conn?: Connection): Promise<Model<TaggingDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.Tagging as Model<TaggingDoc>) ??
    connection.model<TaggingDoc>("Tagging", taggingSchema)
  );
}
