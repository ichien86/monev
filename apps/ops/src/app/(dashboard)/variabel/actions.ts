"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getVariableModel } from "@simonev/db";
import { createVariableSchema, type CreateVariableInput } from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";

function requireVariableManager(role: string | undefined) {
  return role === "bapperida" || role === "admin_sistem";
}

export async function createVariable(input: CreateVariableInput): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!requireVariableManager(session?.user.role)) {
    return { ok: false, error: "Hanya Bapperida/Admin Sistem yang dapat mengelola Master Variabel." };
  }

  const parsed = createVariableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const VariableModel = await getVariableModel();
  if (parsed.data.code) {
    const existing = await VariableModel.findOne({ code: parsed.data.code }).lean();
    if (existing) return { ok: false, error: "Kode variabel sudah dipakai." };
  }

  const created = await VariableModel.create(parsed.data);
  revalidatePath("/variabel");
  return { ok: true, data: { id: created._id.toString() } };
}

/**
 * F-01 hybrid search (DDT Section 11): kalau ada query, cocokkan dulu lewat
 * substring case-insensitive (menangkap sebagian besar kasus nyata), lalu
 * lengkapi dengan skor kemiripan trigram sederhana supaya typo/kata tak
 * lengkap tetap dapat hasil relevan -- semuanya di level aplikasi karena
 * skala data variabel RPJMD cuma ratusan entri (bukan jutaan).
 */
function trigrams(text: string): Set<string> {
  const s = text.toLowerCase().trim();
  const grams = new Set<string>();
  for (let i = 0; i <= s.length - 3; i++) grams.add(s.slice(i, i + 3));
  return grams;
}

// Recall trigram query di dalam kandidat -- BUKAN Math.max(ga, gb), supaya
// nama kandidat yang panjang/multi-kata (mis. "Angka Harapan Hidup") tidak
// "menenggelamkan" skor query pendek yang sebenarnya cocok (typo "harpan").
function trigramSimilarity(query: string, candidate: string): number {
  const ga = trigrams(query);
  const gb = trigrams(candidate);
  if (ga.size === 0 || gb.size === 0) return 0;
  let intersection = 0;
  for (const g of ga) if (gb.has(g)) intersection += 1;
  return intersection / ga.size;
}

export async function listVariables(query?: string) {
  const VariableModel = await getVariableModel();
  const all = await VariableModel.find({ isActive: true }).sort({ name: 1 }).limit(500).lean();

  const q = query?.trim();
  if (!q) return all;

  const qLower = q.toLowerCase();
  const scored = all
    .map((v) => {
      const nameLower = v.name.toLowerCase();
      const codeLower = v.code?.toLowerCase() ?? "";
      const substringHit = nameLower.includes(qLower) || codeLower.includes(qLower);
      const similarity = Math.max(trigramSimilarity(qLower, nameLower), trigramSimilarity(qLower, codeLower));
      const score = substringHit ? 1 + similarity : similarity;
      return { v, score };
    })
    .filter(({ score }) => score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return scored.map(({ v }) => v);
}
