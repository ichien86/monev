import type Agenda from "agenda";
import { getScheduleModel, getIndicatorModel, getUserModel } from "@simonev/db";
import { notify } from "@/lib/notify";

export const SCHEDULE_REMINDER_JOB = "schedule-reminder";

const SCOPE_LABEL: Record<string, string> = {
  pelaporan_indikator: "Pelaporan Indikator",
  penentuan_target: "Penentuan Target",
  penutupan_tahun: "Penutupan Tahun",
};

/**
 * F-03 + F-12 — Smart Reminder (DDT v2.0 Section 2.12). Berjalan sekali
 * sehari; mengecek Schedule yang belum terkunci dan tenggatnya H-3 atau H-1.
 *
 * DDT v2.0 — scope "entri_split_tagging" DIHAPUS (lihat Schedule.ts model);
 * digantikan trigger notifikasi langsung dari job impor realisasi tagging
 * (apps/ops/src/app/(dashboard)/tagging/actions.ts), bukan lagi jendela
 * jadwal terpisah. Job ini sekarang menangani tiga scope: "pelaporan_indikator"
 * & "penentuan_target" (keduanya refId → Indicator, dikirim ke PD/OPD
 * pengampu) dan "penutupan_tahun" (refId generik/global — lihat
 * GLOBAL_SCHEDULE_REF_ID di Schedule.ts — dikirim ke seluruh Bapperida +
 * Admin Sistem karena berlaku sistem-lebar, bukan per-OPD).
 */
export function defineScheduleReminderJob(agenda: Agenda) {
  agenda.define(SCHEDULE_REMINDER_JOB, async () => {
    const ScheduleModel = await getScheduleModel();
    const now = new Date();

    const upcoming = await ScheduleModel.find({
      isLocked: false,
      deadlineAt: { $gt: now, $lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
    }).lean();

    if (upcoming.length === 0) return;

    const IndicatorModel = await getIndicatorModel();
    const UserModel = await getUserModel();

    for (const schedule of upcoming) {
      const daysLeft = Math.ceil((schedule.deadlineAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (daysLeft !== 3 && daysLeft !== 1) continue; // hanya kirim tepat di penanda H-3/H-1
      if (schedule.remindersSent?.includes(daysLeft)) continue; // sudah dikirim, jangan duplikat

      if (schedule.scope === "penutupan_tahun") {
        const admins = await UserModel.find({
          role: { $in: ["bapperida", "admin_sistem"] },
          isActive: true,
        })
          .select("_id")
          .lean();
        for (const admin of admins) {
          await notify({
            userId: admin._id.toString(),
            type: "warning",
            title: `Tenggat H-${daysLeft}: Penutupan Tahun`,
            message: `Periode ${schedule.periodLabel} ${schedule.periodYear} akan ditutup pada ${schedule.deadlineAt.toLocaleDateString("id-ID")}.`,
            link: "/jadwal",
          });
        }
        continue;
      }

      const indicator = await IndicatorModel.findById(schedule.refId).select("label ownerWorkUnitId").lean();
      if (!indicator || !indicator.ownerWorkUnitId) continue;

      const recipients = await UserModel.find({ workUnitId: indicator.ownerWorkUnitId, isActive: true })
        .select("_id")
        .lean();
      for (const recipient of recipients) {
        await notify({
          userId: recipient._id.toString(),
          type: "warning",
          title: `Tenggat H-${daysLeft}: ${SCOPE_LABEL[schedule.scope] ?? schedule.scope}`,
          message: `${indicator.label} — periode ${schedule.periodLabel} ${schedule.periodYear}, tenggat ${schedule.deadlineAt.toLocaleDateString("id-ID")}.`,
          link: schedule.scope === "penentuan_target" ? "/pohon-kinerja" : "/input-data",
        });
      }

      await ScheduleModel.updateOne({ _id: schedule._id }, { $addToSet: { remindersSent: daysLeft } });
    }

    console.log(`[${SCHEDULE_REMINDER_JOB}] Diproses ${upcoming.length} jadwal mendekati tenggat.`);
  });
}
