"use server";

import { getIndicatorModel } from "@simonev/db";
import { calculateCapaian, resolveTargetForYear } from "@/lib/capaian";
import type { ActionResult } from "@/lib/action-result";

/**
 * F-07 — Simulasi & What-If Analysis (PRD Section 3 F-07, DDT Section 4.B:
 * "Route Handler komputasi stateless, tanpa menulis ke simonev_core").
 * Diimplementasikan sebagai Server Action (bukan Route Handler terpisah)
 * untuk konsistensi pola dengan modul lain — tapi sifatnya sama persis:
 * HANYA membaca Indicator (untuk target & aturan polaritas), TIDAK PERNAH
 * menulis Submission/FinalValue apa pun. Aman dipakai coba-coba berkali-kali
 * tanpa efek samping ke data produksi.
 */
export async function simulateCapaian(
  indicatorId: string,
  hypotheticalValue: string,
  targetYear: number
): Promise<ActionResult<{ capaianPercent: number; status: string; targetUsed: string }>> {
  const IndicatorModel = await getIndicatorModel();
  const indicator = await IndicatorModel.findById(indicatorId)
    .select("targets polarity allowOverachievement label")
    .lean();
  if (!indicator) return { ok: false, error: "Indikator tidak ditemukan." };

  const target = resolveTargetForYear(
    (indicator.targets ?? []).map((t) => ({ year: t.year, value: t.value })),
    targetYear
  );
  if (!target) {
    return { ok: false, error: "Indikator ini belum punya target tahunan — simulasi tidak dapat dihitung." };
  }

  const result = calculateCapaian(
    hypotheticalValue,
    target,
    (indicator.polarity as "positive" | "negative") ?? "positive",
    indicator.allowOverachievement ?? false
  );
  if (!result) {
    return { ok: false, error: "Nilai yang dimasukkan tidak dapat diproses sebagai angka." };
  }

  return {
    ok: true,
    data: { capaianPercent: result.capaianPercent, status: result.status, targetUsed: target },
  };
}

export async function listSimulatableIndicators() {
  const IndicatorModel = await getIndicatorModel();
  return IndicatorModel.find({ tier: "SASARAN_PROGRAM", isActive: true })
    .select("label targets polarity allowOverachievement")
    .lean();
}
