import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-02 — Inti modul Tagging Anggaran Tematik (PRD 5.6/5.7, revisi DDT v2.0
 * Section 2.7).
 *
 * KEPUTUSAN DESAIN PENTING — cascade dihitung saat BACA, bukan disimpan
 * sebagai salinan fisik: satu Tagging disimpan persis di level tempat
 * Bapperida membuatnya (program/kegiatan/subkegiatan). Untuk tahu "tema apa
 * saja yang efektif berlaku di rekening X" (termasuk warisan dari Program/
 * Kegiatan/Subkegiatan induknya), query memanfaatkan `path` milik
 * BudgetStructure:
 *
 *   Tagging.find({ budgetStructureId: { $in: [X._id, ...X.path] } })
 *
 * Alasan memilih ini dibanding menduplikasi Tagging ke setiap descendant
 * saat cascade terjadi: descendant baru bisa muncul kapan saja (APBD-P,
 * rekening baru) — kalau cascade disimpan fisik, setiap penambahan
 * descendant baru butuh proses sinkronisasi ulang yang gampang lupa/meleset.
 * Dengan pendekatan "hitung saat baca", descendant baru otomatis ikut ter-tag
 * begitu impor realisasi berikutnya menautkan `parentId`-nya — tanpa proses
 * sinkronisasi terpisah sama sekali.
 *
 * Overlap antar tema SENGAJA tidak divalidasi/dibatasi (PRD 5.6 — overlap
 * merepresentasikan "kinerja berbagi pakai", bukan kesalahan data).
 *
 * DDT v2.0 — `budgetStructureId` sekarang mengacu ke level SUBKEGIATAN (bukan
 * campuran program/kegiatan/subkegiatan seperti v1.0); cakupan "sebagian"
 * tidak lagi berupa satu persentase tunggal (`coveragePercent`), melainkan
 * daftar rekening spesifik + nominal Rupiah per rekening (PRD 5.7.3) —
 * lihat `partialAllocations`.
 */
const taggingSchema = new Schema(
  {
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true },
    budgetStructureId: { type: Schema.Types.ObjectId, ref: "BudgetStructure", required: true },
    budgetYear: { type: Number, required: true },

    coverage: { type: String, enum: ["penuh", "sebagian"], required: true },

    // DDT v2.0 Section 2.7 — BARU, menggantikan `coveragePercent` (Number
    // tunggal) versi v1.0. Untuk coverage="sebagian": daftar rekening
    // spesifik (di bawah subkegiatan ini) + nominal Rupiah per rekening.
    // Total pagu/realisasi ter-tag = jumlah amountRupiah di sini (untuk
    // "sebagian") atau BudgetStructure.realisasi subkegiatan penuh (untuk
    // "penuh").
    partialAllocations: [
      {
        rekeningStructureId: { type: Schema.Types.ObjectId, ref: "BudgetStructure", required: true },
        amountRupiah: { type: Number, required: true, min: 0 },
        lastConfirmedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        lastConfirmedAt: { type: Date, default: null },
        _id: false,
      },
    ],

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Satu kombinasi tema+struktur+tahun hanya boleh punya SATU dokumen tagging
// langsung (mencegah duplikasi entri, BUKAN mencegah overlap antar tema —
// overlap antar TEMA BERBEDA pada struktur yang sama tetap bebas terjadi).
taggingSchema.index({ themeId: 1, budgetStructureId: 1, budgetYear: 1 }, { unique: true });
taggingSchema.index({ budgetStructureId: 1 });
taggingSchema.index({ "partialAllocations.rekeningStructureId": 1 });

export type TaggingDoc = InferSchemaType<typeof taggingSchema>;

export async function getTaggingModel(conn?: Connection): Promise<Model<TaggingDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.Tagging as Model<TaggingDoc>) ??
    connection.model<TaggingDoc>("Tagging", taggingSchema)
  );
}
