"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getOrgUnitModel } from "@simonev/db";
import { createOrgUnitSchema, type CreateOrgUnitInput } from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";

export async function listOrgUnits() {
  const OrgUnitModel = await getOrgUnitModel();
  return OrgUnitModel.find({ isActive: true }).sort({ name: 1 }).lean();
}

export async function createOrgUnit(input: CreateOrgUnitInput): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (session?.user.role !== "admin_sistem") {
    return { ok: false, error: "Hanya Admin Sistem yang dapat mengelola data Perangkat Daerah." };
  }

  const parsed = createOrgUnitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const OrgUnitModel = await getOrgUnitModel();
  const existing = await OrgUnitModel.findOne({ sipdCode: parsed.data.sipdCode }).lean();
  if (existing) {
    return { ok: false, error: "Kode SIPD sudah terdaftar untuk Perangkat Daerah lain." };
  }

  const created = await OrgUnitModel.create(parsed.data);
  revalidatePath("/org-unit");
  return { ok: true, data: { id: created._id.toString() } };
}
