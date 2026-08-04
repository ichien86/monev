"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getSystemSettingModel } from "@simonev/db";
import { setTahunAktifSchema, type SetTahunAktifInput } from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";
import { getTahunAktif, invalidateTahunAktifCache } from "@/lib/system-setting";

export async function getCurrentTahunAktif() {
  return getTahunAktif();
}

/** DDT v2.0 Section 2.11 — Tahun Aktif (PRD 5.5.1), hanya Admin Sistem yang boleh mengubah. */
export async function setTahunAktif(input: SetTahunAktifInput): Promise<ActionResult> {
  const session = await auth();
  if (session?.user.role !== "admin_sistem") {
    return { ok: false, error: "Hanya Admin Sistem yang dapat mengatur Tahun Aktif." };
  }

  const parsed = setTahunAktifSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const SystemSettingModel = await getSystemSettingModel();
  await SystemSettingModel.findByIdAndUpdate(
    "tahun_aktif",
    { _id: "tahun_aktif", value: parsed.data.value, setBy: session!.user.id, setAt: new Date() },
    { upsert: true, setDefaultsOnInsert: true }
  );
  invalidateTahunAktifCache();

  revalidatePath("/pengaturan");
  return { ok: true, data: undefined };
}
