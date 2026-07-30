"use server";

import { auth } from "@/auth";
import { getSubmissionModel, getScheduleModel, getIndicatorModel } from "@simonev/db";
import { createSubmissionSchema, type CreateSubmissionInput } from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";
import { agenda } from "@/worker/agenda";
import { VALIDATE_EVIDENCE_JOB } from "@/worker/jobs/validateEvidence.job";

/**
 * F-04 — Input & Validasi Bukti (PRD 5.2). Alur:
 * 1. Cek F-03: periode yang bersangkutan belum terkunci.
 * 2. Simpan submission berstatus awal "validasi_link".
 * 3. Enqueue job Agenda `validate-evidence` — TIDAK diproses di sini
 *    (lihat DDT 6.1: submission tidak boleh menunggu validasi eksternal).
 */
export async function createSubmission(input: CreateSubmissionInput): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (session?.user.role !== "pd_opd" || !session.user.workUnitId) {
    return { ok: false, error: "Hanya operator PD/OPD yang dapat mengirim submission." };
  }

  const parsed = createSubmissionSchema.safeParse({
    ...input,
    workUnitId: session.user.workUnitId,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const data = parsed.data;

  const ScheduleModel = await getScheduleModel();
  const lockedSchedule = await ScheduleModel.findOne({
    scope: "pelaporan_indikator",
    refId: data.indicatorId,
    periodYear: data.periodYear,
    periodLabel: data.periodLabel,
    isLocked: true,
  }).lean();
  if (lockedSchedule) {
    return {
      ok: false,
      error: "Periode pelaporan ini sudah terkunci (F-03) dan tidak dapat menerima submission baru.",
    };
  }

  const SubmissionModel = await getSubmissionModel();

  const existingActive = await SubmissionModel.findOne({
    indicatorId: data.indicatorId,
    workUnitId: data.workUnitId,
    periodYear: data.periodYear,
    periodLabel: data.periodLabel,
    status: { $in: ["validasi_link", "validasi_format", "menunggu_bapperida", "disetujui"] },
  }).lean();
  if (existingActive) {
    return {
      ok: false,
      error: "Sudah ada submission aktif untuk indikator dan periode ini (PRD 5.4 — satu kombinasi unik).",
    };
  }

  const created = await SubmissionModel.create({
    ...data,
    submittedBy: session.user.id,
    status: "validasi_link",
  });

  await agenda.now(VALIDATE_EVIDENCE_JOB, { submissionId: created._id.toString() });

  return { ok: true, data: { id: created._id.toString() } };
}

export async function listReportableIndicators() {
  const session = await auth();
  if (!session?.user.workUnitId) return [];

  const IndicatorModel = await getIndicatorModel();
  // F-05: OPD boleh melapor untuk indikator yang dia MILIKI (ownerWorkUnitId)
  // ATAU indikator cross-cutting yang mencantumkan dia sebagai kontributor.
  return IndicatorModel.find({
    tier: "SASARAN_PROGRAM",
    isActive: true,
    $or: [
      { ownerWorkUnitId: session.user.workUnitId },
      { crossCuttingWorkUnitIds: session.user.workUnitId },
    ],
  })
    .select("label crossCuttingWorkUnitIds")
    .lean();
}

export async function listMySubmissions() {
  const session = await auth();
  if (!session?.user.workUnitId) return [];

  const SubmissionModel = await getSubmissionModel();
  return SubmissionModel.find({ workUnitId: session.user.workUnitId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("indicatorId", "label")
    .lean();
}
