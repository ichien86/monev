"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getVariableModel } from "@simonev/db";
import { createVariableSchema, type CreateVariableInput } from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";

function requireVariableManager(role: string | undefined) {
  return role === "bapperida" || role === "admin_sistem";
}

/** DDT v2.0 Section 2.1 — CRUD master data Variable, dipakai lintas Indicator. */
export async function listVariables() {
  const VariableModel = await getVariableModel();
  return VariableModel.find({}).sort({ name: 1 }).lean();
}

export async function createVariable(input: CreateVariableInput): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!requireVariableManager(session?.user.role)) {
    return { ok: false, error: "Hanya Bapperida/Admin Sistem yang dapat mengelola master data Variabel." };
  }

  const parsed = createVariableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const VariableModel = await getVariableModel();
  const created = await VariableModel.create({ ...parsed.data, createdBy: session!.user.id });
  revalidatePath("/variabel");
  return { ok: true, data: { id: created._id.toString() } };
}
