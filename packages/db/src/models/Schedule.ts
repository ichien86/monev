import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-03 — Penjadwalan & Penguncian Otomatis (PRD Section 3 F-03).
 * Dikonsumsi oleh worker Agenda.js (lihat apps/ops/src/worker/jobs/lockPeriod.job.ts)
 * untuk mengunci periode pelaporan setelah tenggat, dan sebagai target jadwal
 * entri split tagging tematik (PRD 5.6 — "Bapperida mengatur jadwal untuk
 * entri tiap tagging").
 */
const scheduleSchema = new Schema(
  {
    scope: { type: String, enum: ["pelaporan_indikator", "entri_split_tagging"], required: true },
    // Untuk scope "pelaporan_indikator": referensi ke Indicator + workUnit.
    // Untuk scope "entri_split_tagging": referensi ke Tagging (lihat F-02, belum di-scaffold).
    refId: { type: Schema.Types.ObjectId, required: true },
    periodYear: { type: Number, required: true },
    periodLabel: { type: String, required: true },
    deadlineAt: { type: Date, required: true },
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

scheduleSchema.index({ scope: 1, deadlineAt: 1, isLocked: 1 });

export type ScheduleDoc = InferSchemaType<typeof scheduleSchema>;

export async function getScheduleModel(conn?: Connection): Promise<Model<ScheduleDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.Schedule as Model<ScheduleDoc>) ??
    connection.model<ScheduleDoc>("Schedule", scheduleSchema)
  );
}
