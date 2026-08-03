"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getScheduleModel, getIndicatorModel, GLOBAL_SCHEDULE_REF_ID } from "@simonev/db";
import { createScheduleSchema, type CreateScheduleInput } from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";

function requireScheduleManager(role: string | undefined) {
  return role === "bapperida" || role === "admin_sistem";
}

/**
 * DDT v2.0 Section 2.12 — scope "entri_split_tagging" DIHAPUS (digantikan
 * trigger notifikasi langsung dari impor realisasi tagging). Dua scope baru:
 * "penentuan_target" (refId → Indicator, boleh dibuka ulang lewat dokumen
 * baru) dan "penutupan_tahun" (refId generik/global — GLOBAL_SCHEDULE_REF_ID).
 */
export async function createSchedule(input: CreateScheduleInput): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!requireScheduleManager(session?.user.role)) {
    return { ok: false, error: "Hanya Bapperida/Admin Sistem yang dapat membuat jadwal." };
  }
  const parsed = createScheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const ScheduleModel = await getScheduleModel();
  const created = await ScheduleModel.create({
    ...parsed.data,
    refId: parsed.data.scope === "penutupan_tahun" ? GLOBAL_SCHEDULE_REF_ID : parsed.data.refId,
    deadlineAt: new Date(parsed.data.deadlineAt),
    isLocked: false,
  });
  revalidatePath("/jadwal");
  return { ok: true, data: { id: created._id.toString() } };
}

export async function unlockSchedule(scheduleId: string): Promise<ActionResult> {
  const session = await auth();
  if (!requireScheduleManager(session?.user.role)) {
    return { ok: false, error: "Hanya Bapperida/Admin Sistem yang dapat membuka kunci jadwal." };
  }
  const ScheduleModel = await getScheduleModel();
  await ScheduleModel.updateOne({ _id: scheduleId }, { $set: { isLocked: false, lockedAt: null } });
  revalidatePath("/jadwal");
  return { ok: true, data: undefined };
}

/**
 * DDT v2.0 — menggabungkan label tampilan: "pelaporan_indikator" &
 * "penentuan_target" merujuk Indicator; "penutupan_tahun" berlabel tetap
 * (bersifat sistem-lebar, bukan per-entitas — lihat GLOBAL_SCHEDULE_REF_ID).
 */
export async function listSchedules() {
  const ScheduleModel = await getScheduleModel();
  const schedules = await ScheduleModel.find({}).sort({ deadlineAt: 1 }).lean();

  const indicatorIds = schedules
    .filter((s) => s.scope === "pelaporan_indikator" || s.scope === "penentuan_target")
    .map((s) => s.refId);

  const IndicatorModel = await getIndicatorModel();
  const indicators = await IndicatorModel.find({ _id: { $in: indicatorIds } }).select("label").lean();
  const indicatorLabelById = new Map(indicators.map((i) => [i._id.toString(), i.label]));

  return schedules.map((s) => ({
    ...s,
    label:
      s.scope === "penutupan_tahun"
        ? "Penutupan Tahun (berlaku sistem-lebar)"
        : indicatorLabelById.get(s.refId.toString()) ?? "(indikator tidak ditemukan)",
  }));
}

export async function listSasaranProgramIndicators() {
  const IndicatorModel = await getIndicatorModel();
  return IndicatorModel.find({ tier: "SASARAN_PROGRAM", isActive: true }).select("label").lean();
}
