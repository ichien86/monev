"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  getScheduleModel,
  getIndicatorModel,
  getTaggingModel,
  getThemeModel,
  getBudgetStructureModel,
} from "@simonev/db";
import { createScheduleSchema, type CreateScheduleInput } from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";

function requireScheduleManager(role: string | undefined) {
  return role === "bapperida" || role === "admin_sistem";
}

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
 * Menggabungkan label tampilan untuk dua scope berbeda — `refId` menunjuk ke
 * koleksi yang berbeda tergantung scope (Indicator vs Tagging), sehingga
 * tidak bisa memakai satu `.populate()` generik.
 */
export async function listSchedules() {
  const ScheduleModel = await getScheduleModel();
  const schedules = await ScheduleModel.find({}).sort({ deadlineAt: 1 }).lean();

  const indicatorIds = schedules.filter((s) => s.scope === "pelaporan_indikator").map((s) => s.refId);
  const taggingIds = schedules.filter((s) => s.scope === "entri_split_tagging").map((s) => s.refId);

  const IndicatorModel = await getIndicatorModel();
  const indicators = await IndicatorModel.find({ _id: { $in: indicatorIds } }).select("label").lean();
  const indicatorLabelById = new Map(indicators.map((i) => [i._id.toString(), i.label]));

  const TaggingModel = await getTaggingModel();
  const taggings = await TaggingModel.find({ _id: { $in: taggingIds } }).lean();
  const ThemeModel = await getThemeModel();
  const BudgetStructureModel = await getBudgetStructureModel();
  const themes = await ThemeModel.find({ _id: { $in: taggings.map((t) => t.themeId) } }).lean();
  const structures = await BudgetStructureModel.find({
    _id: { $in: taggings.map((t) => t.budgetStructureId) },
  }).lean();
  const themeById = new Map(themes.map((t) => [t._id.toString(), t.name]));
  const structureById = new Map(structures.map((s) => [s._id.toString(), s.name]));
  const taggingLabelById = new Map(
    taggings.map((t) => [
      t._id.toString(),
      `${themeById.get(t.themeId.toString()) ?? "?"} — ${structureById.get(t.budgetStructureId.toString()) ?? "?"}`,
    ])
  );

  return schedules.map((s) => ({
    ...s,
    label:
      s.scope === "pelaporan_indikator"
        ? indicatorLabelById.get(s.refId.toString()) ?? "(indikator tidak ditemukan)"
        : taggingLabelById.get(s.refId.toString()) ?? "(tagging tidak ditemukan)",
  }));
}

export async function listSasaranProgramIndicators() {
  const IndicatorModel = await getIndicatorModel();
  return IndicatorModel.find({ tier: "SASARAN_PROGRAM", isActive: true }).select("label").lean();
}

export async function listTaggingsRequiringSchedule() {
  const TaggingModel = await getTaggingModel();
  const ThemeModel = await getThemeModel();
  const BudgetStructureModel = await getBudgetStructureModel();

  const taggings = await TaggingModel.find({ coverage: "sebagian" }).lean();
  const themes = await ThemeModel.find({ _id: { $in: taggings.map((t) => t.themeId) } }).lean();
  const structures = await BudgetStructureModel.find({
    _id: { $in: taggings.map((t) => t.budgetStructureId) },
  }).lean();
  const themeById = new Map(themes.map((t) => [t._id.toString(), t.name]));
  const structureById = new Map(structures.map((s) => [s._id.toString(), s.name]));

  return taggings.map((t) => ({
    _id: t._id.toString(),
    label: `${themeById.get(t.themeId.toString()) ?? "?"} — ${structureById.get(t.budgetStructureId.toString()) ?? "?"}`,
  }));
}
