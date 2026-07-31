import type Agenda from "agenda";
import { getScheduleModel } from "@simonev/db";

/**
 * F-03 — Penjadwalan & Penguncian Otomatis (PRD Section 3).
 * Berjalan berkala; mengunci setiap Schedule yang tenggatnya sudah lewat
 * dan belum terkunci. Setelah terkunci, PD tidak bisa lagi submit untuk
 * periode tersebut (pengecekan `isLocked` dilakukan di F-04 createSubmission —
 * belum di-scaffold pada tahap ini, lihat README bagian "Langkah Selanjutnya").
 */
export const LOCK_OVERDUE_PERIODS_JOB = "lock-overdue-periods";

export function defineLockOverduePeriodsJob(agenda: Agenda) {
  agenda.define(LOCK_OVERDUE_PERIODS_JOB, async () => {
    const ScheduleModel = await getScheduleModel();
    const now = new Date();

    const result = await ScheduleModel.updateMany(
      { isLocked: false, deadlineAt: { $lte: now } },
      { $set: { isLocked: true, lockedAt: now } }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `[${LOCK_OVERDUE_PERIODS_JOB}] Mengunci ${result.modifiedCount} periode yang melewati tenggat.`
      );
    }
  });
}
