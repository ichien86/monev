"use server";

import { auth } from "@/auth";
import { getFinalValueModel, getOrgUnitModel } from "@simonev/db";

export type LaporanFilter = {
  periodYear?: number;
  workUnitId?: string;
};

/**
 * F-11 (versi operasional) — Tabel Data Dinamis (PRD Section 3 F-11). Berbeda
 * dari dashboard pimpinan (apps/eksekutif, ringkasan agregat) — ini tabel
 * RINCI per baris FinalValue untuk kebutuhan kerja sehari-hari Bapperida/PD.
 * PD/OPD hanya bisa melihat & mengekspor data milik OPD-nya sendiri
 * (dipaksa di server, bukan hanya disembunyikan di UI — lihat filter di bawah).
 */
export async function listFinalValuesForReport(filter: LaporanFilter) {
  const session = await auth();
  if (!session?.user) return [];

  const query: Record<string, unknown> = {};
  if (filter.periodYear) query.periodYear = filter.periodYear;

  if (session.user.role === "pd_opd") {
    query.workUnitId = session.user.workUnitId; // dipaksa, mengabaikan filter.workUnitId dari client
  } else if (filter.workUnitId) {
    query.workUnitId = filter.workUnitId;
  }

  const FinalValueModel = await getFinalValueModel();
  return FinalValueModel.find(query)
    .sort({ approvedAt: -1 })
    .limit(500)
    .populate("indicatorId", "label unit")
    .populate("workUnitId", "name")
    .populate("approvedBy", "name")
    .lean();
}

export async function listWorkUnitsForFilter() {
  const session = await auth();
  if (session?.user.role === "pd_opd") return []; // PD tidak perlu filter OPD — otomatis miliknya sendiri
  const OrgUnitModel = await getOrgUnitModel();
  return OrgUnitModel.find({ isActive: true }).select("name").sort({ name: 1 }).lean();
}
