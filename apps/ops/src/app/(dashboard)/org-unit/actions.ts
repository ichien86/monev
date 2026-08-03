"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getOrgUnitModel, getBidangUrusanModel, getUrusanModel } from "@simonev/db";
import { createOrgUnitSchema, type CreateOrgUnitInput } from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";

export async function listOrgUnits() {
  const OrgUnitModel = await getOrgUnitModel();
  return OrgUnitModel.find({ isActive: true }).populate("bidangUrusanIds", "name").sort({ name: 1 }).lean();
}

/** DDT v2.0 Section 2.8/2.9 — daftar Bidang Urusan (dikelompokkan per Urusan) untuk checkbox form OPD. */
export async function listBidangUrusanOptions() {
  const UrusanModel = await getUrusanModel();
  const BidangUrusanModel = await getBidangUrusanModel();
  const [urusanList, bidangList] = await Promise.all([
    UrusanModel.find({}).sort({ code: 1 }).lean(),
    BidangUrusanModel.find({}).sort({ code: 1 }).lean(),
  ]);
  const urusanById = new Map(urusanList.map((u) => [u._id.toString(), u]));
  return bidangList.map((b) => ({
    _id: b._id.toString(),
    name: b.name,
    urusanName: urusanById.get(b.urusanId.toString())?.name ?? "?",
  }));
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
