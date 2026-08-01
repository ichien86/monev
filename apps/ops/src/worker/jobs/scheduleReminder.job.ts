import type Agenda from "agenda";
import {
  getScheduleModel,
  getIndicatorModel,
  getTaggingModel,
  getThemeModel,
  getBudgetStructureModel,
  getUserModel,
} from "@simonev/db";
import { notify } from "@/lib/notify";

export const SCHEDULE_REMINDER_JOB = "schedule-reminder";

/**
 * F-03 + F-12 — Smart Reminder. Berjalan sekali sehari; mengecek Schedule
 * yang belum terkunci dan tenggatnya H-3 atau H-1, lalu mengirim notifikasi
 * ke PD/OPD terkait lewat notify() (F-12). Dua penanda hari (bukan hanya
 * satu) supaya PD dapat peringatan lebih awal (H-3) DAN pengingat terakhir
 * yang lebih mendesak (H-1) — bukan cuma sekali saja.
 *
 * Field `remindersSent` menandai penanda mana yang sudah dikirim, supaya
 * job harian ini idempoten (tidak mengirim reminder H-3 berkali-kali kalau
 * job kebetulan jalan lebih dari sekali dalam rentang H-3 yang sama).
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
    const TaggingModel = await getTaggingModel();
    const ThemeModel = await getThemeModel();
    const BudgetStructureModel = await getBudgetStructureModel();
    const UserModel = await getUserModel();

    for (const schedule of upcoming) {
      const daysLeft = Math.ceil((schedule.deadlineAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (daysLeft !== 3 && daysLeft !== 1) continue; // hanya kirim tepat di penanda H-3/H-1
      if (schedule.remindersSent?.includes(daysLeft)) continue; // sudah dikirim, jangan duplikat

      let label = "";
      let workUnitId: string | null = null;

      if (schedule.scope === "pelaporan_indikator") {
        const indicator = await IndicatorModel.findById(schedule.refId).select("label ownerWorkUnitId").lean();
        if (!indicator) continue;
        label = indicator.label;
        workUnitId = indicator.ownerWorkUnitId?.toString() ?? null;
      } else {
        const tagging = await TaggingModel.findById(schedule.refId).lean();
        if (!tagging) continue;
        const [theme, structure] = await Promise.all([
          ThemeModel.findById(tagging.themeId).select("name").lean(),
          BudgetStructureModel.findById(tagging.budgetStructureId).select("name ownerWorkUnitId").lean(),
        ]);
        label = `${theme?.name ?? "?"} — ${structure?.name ?? "?"}`;
        workUnitId = structure?.ownerWorkUnitId?.toString() ?? null;
      }

      if (!workUnitId) continue;

      const recipients = await UserModel.find({ workUnitId, isActive: true }).select("_id").lean();
      for (const recipient of recipients) {
        await notify({
          userId: recipient._id.toString(),
          type: "warning",
          title: `Tenggat H-${daysLeft}: ${schedule.scope === "pelaporan_indikator" ? "Pelaporan Indikator" : "Entri Split Tagging"}`,
          message: `${label} — periode ${schedule.periodLabel} ${schedule.periodYear}, tenggat ${schedule.deadlineAt.toLocaleDateString("id-ID")}.`,
          link: schedule.scope === "pelaporan_indikator" ? "/input-data" : "/tagging",
        });
      }

      await ScheduleModel.updateOne({ _id: schedule._id }, { $addToSet: { remindersSent: daysLeft } });
    }

    console.log(`[${SCHEDULE_REMINDER_JOB}] Diproses ${upcoming.length} jadwal mendekati tenggat.`);
  });
}
