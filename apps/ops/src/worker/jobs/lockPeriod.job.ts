import type Agenda from "agenda";
import { getScheduleModel } from "@simonev/db";

/**
 * F-03 — Penjadwalan & Penguncian Otomatis (PRD Section 3, DDT v2.0
 * Section 2.12). Berjalan berkala; mengunci setiap Schedule yang tenggatnya
 * sudah lewat dan belum terkunci — logikanya scope-agnostic (bekerja sama
 * untuk ketiga scope: "pelaporan_indikator", "penentuan_target",
 * "penutupan_tahun"), jadi tidak berubah dari v1.0 walau daftar scope
 * bertambah. Setelah terkunci, PD tidak bisa lagi submit realisasi untuk
 * periode tersebut (pengecekan `isLocked` dilakukan di F-04
 * createVariableRealization). Untuk scope "penentuan_target" yang boleh
 * dibuka ulang (DDT v2.0 2.12): membuka ulang berarti membuat dokumen
 * Schedule BARU (bukan meng-unlock dokumen lama) lewat Server Action Admin
 * Perencana — job ini tidak perlu tahu soal itu sama sekali.
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
