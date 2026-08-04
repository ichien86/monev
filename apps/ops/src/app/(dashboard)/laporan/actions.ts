"use server";

import { auth } from "@/auth";
import { getIndicatorModel, getVariableFinalValueModel, getOrgUnitModel } from "@simonev/db";
import { computeIndicatorValue, representativeValueForYear } from "@/lib/capaian";

export type LaporanFilter = {
  periodYear?: number;
  workUnitId?: string;
};

/**
 * F-11 (versi operasional) — Tabel Data Dinamis (PRD Section 3 F-11). DDT
 * v2.0 — dirombak total: baris laporan sekarang per INDIKATOR dengan nilai
 * yang dihitung lewat computeIndicatorValue() (DDT 3.2), BUKAN query
 * langsung ke FinalValue level-indikator (v1.0, sudah dihapus) — karena
 * nilai final kini murni turunan dari VariableFinalValue per variabel.
 * PD/OPD hanya bisa melihat & mengekspor indikator yang jadi tanggung
 * jawabnya (owner ATAU cross-cutting, F-05) — dipaksa di server.
 */
export async function listFinalValuesForReport(filter: LaporanFilter) {
  const session = await auth();
  if (!session?.user) return [];

  const periodYear = filter.periodYear ?? new Date().getFullYear();

  const query: Record<string, unknown> = { tier: "SASARAN_PROGRAM", isActive: true };
  if (session.user.role === "pd_opd") {
    // dipaksa, mengabaikan filter.workUnitId dari client
    query.$or = [
      { ownerWorkUnitId: session.user.workUnitId },
      { "crossCutting.workUnitIds": session.user.workUnitId },
    ];
  } else if (filter.workUnitId) {
    query.ownerWorkUnitId = filter.workUnitId;
  }

  const IndicatorModel = await getIndicatorModel();
  const indicators = await IndicatorModel.find(query)
    .select("label unit formula categories calculationMethod rpjmdCumulative ownerWorkUnitId")
    .populate("ownerWorkUnitId", "name")
    .limit(500)
    .lean();
  if (indicators.length === 0) return [];

  const variableIds = Array.from(new Set(indicators.flatMap((i) => i.formula.map((f) => f.variableId.toString()))));
  const VariableFinalValueModel = await getVariableFinalValueModel();
  const finalValues = await VariableFinalValueModel.find({
    periodYear,
    variableId: { $in: variableIds },
  })
    .sort({ approvedAt: 1 })
    .lean();

  const valuesByVariable = new Map<string, typeof finalValues>();
  for (const fv of finalValues) {
    const key = fv.variableId.toString();
    if (!valuesByVariable.has(key)) valuesByVariable.set(key, []);
    valuesByVariable.get(key)!.push(fv);
  }

  const rows: {
    indicatorId: string;
    indicatorLabel: string;
    unit: string | null;
    workUnitName: string | null;
    periodYear: number;
    value: string | null;
    status: "lengkap" | "belum_lengkap";
    approvedAt: Date | null;
  }[] = [];

  for (const indicator of indicators) {
    const finalValuesByVariableId = new Map<string, string>();
    let latestApprovedAt: Date | null = null;
    for (const entry of indicator.formula) {
      const key = entry.variableId.toString();
      const values = valuesByVariable.get(key) ?? [];
      const representative = representativeValueForYear(values, indicator.rpjmdCumulative);
      if (representative !== null) {
        finalValuesByVariableId.set(key, representative);
        for (const v of values) {
          if (!latestApprovedAt || v.approvedAt > latestApprovedAt) latestApprovedAt = v.approvedAt;
        }
      }
    }

    const computed = computeIndicatorValue(
      {
        calculationMethod: indicator.calculationMethod,
        formula: indicator.formula.map((f) => ({
          variableId: f.variableId.toString(),
          role: f.role,
          weight: f.weight ?? null,
        })),
        categories: indicator.categories,
      },
      finalValuesByVariableId
    );
    const value =
      !computed || computed.status === "belum_lengkap"
        ? null
        : computed.kind === "kategorikal"
        ? computed.categoryLabel
        : computed.value;

    rows.push({
      indicatorId: indicator._id.toString(),
      indicatorLabel: indicator.label,
      unit: indicator.unit ?? null,
      workUnitName: (indicator.ownerWorkUnitId as any)?.name ?? null,
      periodYear,
      value,
      status: value !== null ? "lengkap" : "belum_lengkap",
      approvedAt: latestApprovedAt,
    });
  }

  return rows;
}

export async function listWorkUnitsForFilter() {
  const session = await auth();
  if (session?.user.role === "pd_opd") return []; // PD tidak perlu filter OPD — otomatis miliknya sendiri
  const OrgUnitModel = await getOrgUnitModel();
  return OrgUnitModel.find({ isActive: true }).select("name").sort({ name: 1 }).lean();
}
