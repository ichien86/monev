import { Schema, Types, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-03 — Penjadwalan & Penguncian Otomatis (PRD Section 3 F-03, DDT v2.0
 * Section 2.12). Dikonsumsi oleh worker Agenda.js (lihat
 * apps/ops/src/worker/jobs/lockPeriod.job.ts) untuk mengunci periode.
 *
 * DDT v2.0 — scope "entri_split_tagging" DIHAPUS (PRD 5.5.5): digantikan
 * trigger notifikasi langsung dari job impor realisasi (lihat
 * apps/ops/src/app/(dashboard)/tagging/actions.ts), bukan lagi jendela
 * jadwal terpisah. Dua scope baru menggantikannya:
 * - "penentuan_target": refId mengacu ke Indicator, BISA dibuka ulang —
 *   multiple dokumen per indicator+tahun diperbolehkan, dibedakan
 *   `createdAt`; dokumen aktif = yang terbaru dan belum `isLocked`.
 * - "penutupan_tahun": refId bersifat generik (kunci ini berlaku ke SELURUH
 *   sistem untuk tahun itu, bukan entitas spesifik) — pakai
 *   GLOBAL_SCHEDULE_REF_ID sebagai placeholder tetap.
 */
export const SCHEDULE_SCOPES = ["pelaporan_indikator", "penentuan_target", "penutupan_tahun"] as const;
export type ScheduleScope = (typeof SCHEDULE_SCOPES)[number];

/** Placeholder refId untuk scope "penutupan_tahun" — scope ini secara semantik global per tahun, bukan per entitas. */
export const GLOBAL_SCHEDULE_REF_ID = new Types.ObjectId("000000000000000000000000");

const scheduleSchema = new Schema(
  {
    scope: { type: String, enum: SCHEDULE_SCOPES, required: true },
    // "pelaporan_indikator"/"penentuan_target": referensi ke Indicator.
    // "penutupan_tahun": GLOBAL_SCHEDULE_REF_ID (lihat catatan di atas).
    refId: { type: Schema.Types.ObjectId, required: true },
    periodYear: { type: Number, required: true },
    periodLabel: { type: String, required: true },
    deadlineAt: { type: Date, required: true },
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
    // F-12 — penanda H-3/H-1 mana yang sudah dikirim (mis. [3] atau [3, 1]),
    // supaya schedule-reminder.job.ts tidak mengirim reminder duplikat kalau
    // job berjalan lebih dari sekali dalam rentang hari yang sama.
    remindersSent: { type: [Number], default: [] },
  },
  { timestamps: true }
);

scheduleSchema.index({ scope: 1, deadlineAt: 1, isLocked: 1 });
scheduleSchema.index({ scope: 1, refId: 1, periodYear: 1, createdAt: -1 });

export type ScheduleDoc = InferSchemaType<typeof scheduleSchema>;

export async function getScheduleModel(conn?: Connection): Promise<Model<ScheduleDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.Schedule as Model<ScheduleDoc>) ??
    connection.model<ScheduleDoc>("Schedule", scheduleSchema)
  );
}
