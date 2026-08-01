"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getIndicatorModel } from "@simonev/db";
import {
  createIndicatorSchema,
  weightedSumVariablesSchema,
  TIER_ORDER,
  type CreateIndicatorInput,
} from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";

/**
 * Membuat node baru di Pohon Kinerja (F-01). Dua lapis validasi:
 * 1. Bentuk data — Zod (createIndicatorSchema), sama seperti di client.
 * 2. Aturan bisnis integritas hierarki (PRD 5.1) — anak harus persis satu
 *    tingkat di bawah induknya. Ini TIDAK bisa dicek oleh Zod saja karena
 *    butuh membaca dokumen induk dari database.
 */
export async function createIndicator(input: CreateIndicatorInput): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user || !["bapperida", "admin_sistem"].includes(session.user.role)) {
    return { ok: false, error: "Anda tidak memiliki izin untuk menambah indikator." };
  }

  const parsed = createIndicatorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const data = parsed.data;

  const IndicatorModel = await getIndicatorModel();

  if (data.parentId) {
    const parent = await IndicatorModel.findById(data.parentId).lean();
    if (!parent) return { ok: false, error: "Induk indikator tidak ditemukan." };
    const expectedChildTierRank = TIER_ORDER[parent.tier as keyof typeof TIER_ORDER] + 1;
    if (TIER_ORDER[data.tier] !== expectedChildTierRank) {
      return {
        ok: false,
        error: `Tingkat "${data.tier}" tidak valid sebagai anak langsung dari "${parent.tier}". Integritas hierarki dilanggar (PRD 5.1).`,
      };
    }
  } else if (data.tier !== "VISI") {
    return { ok: false, error: "Hanya tingkat VISI yang boleh tanpa induk." };
  }

  if (data.calculationMethod === "weighted_sum") {
    const parsedVariables = weightedSumVariablesSchema.safeParse(data.variables);
    if (!parsedVariables.success) {
      return { ok: false, error: parsedVariables.error.issues[0]?.message ?? "Data variabel tidak valid." };
    }
  }

  const created = await IndicatorModel.create({
    ...data,
    parentId: data.parentId ?? null,
  });

  revalidatePath("/pohon-kinerja");
  return { ok: true, data: { id: created._id.toString() } };
}

/**
 * Mengambil seluruh pohon dalam satu query memakai materialized `path`
 * (lihat DDT Section 5.1) lalu merakitnya jadi struktur bertingkat di memori —
 * jauh lebih murah daripada N query rekursif untuk pohon sedalam 7 tingkat.
 */
export async function getIndicatorTree() {
  const IndicatorModel = await getIndicatorModel();
  const all = await IndicatorModel.find({ isActive: true }).sort({ createdAt: 1 }).lean();

  type Node = (typeof all)[number] & { children: Node[] };
  const byId = new Map<string, Node>();
  for (const doc of all) {
    byId.set(doc._id.toString(), { ...doc, children: [] } as Node);
  }

  const roots: Node[] = [];
  for (const doc of all) {
    const node = byId.get(doc._id.toString())!;
    if (doc.parentId) {
      const parent = byId.get(doc.parentId.toString());
      if (parent) parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
