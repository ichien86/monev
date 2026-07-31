import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectReadmodel } from "../connection";

/**
 * Koleksi tunggal berisi hasil agregasi siap-tampil untuk dashboard pimpinan
 * (lihat DDT Section 6.3). SIMONEV Eksekutif TIDAK PERNAH menjalankan agregasi
 * langsung ke data transaksi — hanya membaca dokumen terbaru di sini.
 *
 * Ditulis oleh worker `sync-readmodel` (apps/ops/src/worker/jobs/syncReadmodel.job.ts),
 * dijadwalkan tiap 15 menit dan dipicu ulang setelah event kritis (approve/override).
 */
const readmodelSnapshotSchema = new Schema(
  {
    generatedAt: { type: Date, required: true },

    statusDistribution: {
      tercapai: { type: Number, default: 0 },
      proses: { type: Number, default: 0 },
      belumTercapai: { type: Number, default: 0 },
    },

    totals: {
      sasaranStrategisDaerah: { type: Number, default: 0 },
      indikatorUtama: { type: Number, default: 0 },
      programPerangkatDaerah: { type: Number, default: 0 },
      belumLaporPeriodeIni: { type: Number, default: 0 },
    },

    // Rekap per tema tagging (PRD 5.6) — sengaja TIDAK di-dedup lintas tema,
    // sesuai keputusan PRD bahwa overlap direpresentasikan apa adanya.
    temaSummary: [
      {
        themeId: { type: Schema.Types.ObjectId, required: true },
        themeName: { type: String, required: true },
        colorHex: { type: String, required: true },
        paguTerTag: { type: Number, required: true },
        jumlahProgram: { type: Number, required: true },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

// Hanya perlu dokumen terbaru; index descending pada generatedAt mempercepat query "ambil 1 terbaru".
readmodelSnapshotSchema.index({ generatedAt: -1 });

export type ReadmodelSnapshotDoc = InferSchemaType<typeof readmodelSnapshotSchema>;

export async function getReadmodelSnapshotModel(
  conn?: Connection
): Promise<Model<ReadmodelSnapshotDoc>> {
  const connection = conn ?? (await connectReadmodel());
  return (
    (connection.models.ReadmodelSnapshot as Model<ReadmodelSnapshotDoc>) ??
    connection.model<ReadmodelSnapshotDoc>("ReadmodelSnapshot", readmodelSnapshotSchema)
  );
}
