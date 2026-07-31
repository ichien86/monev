"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  connectCore,
  getSubmissionModel,
  getFinalValueModel,
  getAuditLogModel,
  getIndicatorModel,
} from "@simonev/db";
import {
  reviewSubmissionSchema,
  overrideFinalValueSchema,
  type ReviewSubmissionInput,
  type OverrideFinalValueInput,
} from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";
import { agenda } from "@/worker/agenda";
import { SYNC_READMODEL_JOB } from "@/worker/jobs/syncReadmodel.job";
import { notify } from "@/lib/notify";
import { parseNumeric } from "@/lib/capaian";

function requireBapperida(role: string | undefined) {
  return role === "bapperida";
}

export async function listPendingReview() {
  const SubmissionModel = await getSubmissionModel();
  return SubmissionModel.find({ status: "menunggu_bapperida" })
    .sort({ createdAt: 1 })
    .populate("indicatorId", "label")
    .populate("workUnitId", "name")
    .lean();
}

/**
 * F-08 — review substansi Bapperida (PRD 5.3). Approve membuat/menimpa
 * FinalValue (dokumen pertama untuk kombinasi indikator+PD+periode ini —
 * bukan override, karena belum pernah ada nilai approved sebelumnya) DAN
 * mencatat AuditLog action "approve" — tetap satu transaksi supaya riwayat
 * "siapa yang pertama kali menyetujui" tidak pernah hilang.
 */
export async function reviewSubmission(input: ReviewSubmissionInput): Promise<ActionResult> {
  const session = await auth();
  if (!requireBapperida(session?.user.role)) {
    return { ok: false, error: "Hanya Bapperida yang dapat mereview submission." };
  }

  const parsed = reviewSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const { submissionId, decision, rejectionNote } = parsed.data;

  const SubmissionModel = await getSubmissionModel();
  const submission = await SubmissionModel.findById(submissionId);
  if (!submission || submission.status !== "menunggu_bapperida") {
    return { ok: false, error: "Submission tidak ditemukan atau sudah diproses." };
  }

  if (decision === "ditolak_bapperida") {
    submission.status = "ditolak_bapperida";
    submission.reviewedBy = session!.user.id as any;
    submission.reviewedAt = new Date();
    submission.rejectionNote = rejectionNote ?? null;
    await submission.save();
    await notify({
      userId: submission.submittedBy.toString(),
      type: "warning",
      title: "Submission ditolak Bapperida",
      message: `Periode ${submission.periodLabel} ${submission.periodYear}: ${rejectionNote ?? "Tanpa catatan."}`,
      link: "/input-data",
    });
    revalidatePath("/rekonsiliasi");
    return { ok: true, data: undefined };
  }

  const connection = await connectCore();
  const dbSession = await connection.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const FinalValueModel = await getFinalValueModel(connection);
      const AuditLogModel = await getAuditLogModel(connection);

      const [finalValue] = await FinalValueModel.create(
        [
          {
            indicatorId: submission.indicatorId,
            workUnitId: submission.workUnitId,
            periodYear: submission.periodYear,
            periodLabel: submission.periodLabel,
            value: submission.reportedValue,
            sourceSubmissionId: submission._id,
            approvedBy: session!.user.id,
            approvedAt: new Date(),
            isLocked: true,
          },
        ],
        { session: dbSession }
      );

      await AuditLogModel.create(
        [
          {
            finalValueId: finalValue._id,
            action: "approve",
            previousValue: null,
            newValue: submission.reportedValue,
            reason: null,
            performedBy: session!.user.id,
            performedAt: new Date(),
          },
        ],
        { session: dbSession }
      );

      submission.status = "disetujui";
      submission.reviewedBy = session!.user.id as any;
      submission.reviewedAt = new Date();
      await submission.save({ session: dbSession });
    });
  } finally {
    await dbSession.endSession();
  }

  await notify({
    userId: submission.submittedBy.toString(),
    type: "success",
    title: "Submission disetujui",
    message: `Nilai ${submission.reportedValue} untuk periode ${submission.periodLabel} ${submission.periodYear} telah disetujui dan menjadi nilai final.`,
    link: "/input-data",
  });
  await agenda.now(SYNC_READMODEL_JOB, {}); // DDT 6.3 — pemicu langsung, bukan menunggu jadwal 15 menit
  revalidatePath("/rekonsiliasi");
  return { ok: true, data: undefined };
}

export async function listApprovedFinalValues() {
  const FinalValueModel = await getFinalValueModel();
  return FinalValueModel.find({})
    .sort({ approvedAt: -1 })
    .limit(50)
    .populate("indicatorId", "label")
    .lean();
}

/**
 * F-08 — Override, single-tier (PRD 5.3, keputusan v10.2). Risiko
 * self-approval diterima sebagai trade-off (PRD Section 8, Open Issue #8);
 * satu-satunya penghalang teknis adalah validasi alasan ≥500 karakter
 * (overrideFinalValueSchema) DAN keharusan setiap override tercatat permanen
 * di AuditLog lewat transaksi yang sama dengan perubahan FinalValue.
 */
export async function overrideFinalValue(input: OverrideFinalValueInput): Promise<ActionResult> {
  const session = await auth();
  if (!requireBapperida(session?.user.role)) {
    return { ok: false, error: "Hanya Bapperida yang dapat melakukan override." };
  }

  const parsed = overrideFinalValueSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const { finalValueId, newValue, reason } = parsed.data;

  const connection = await connectCore();
  const dbSession = await connection.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const FinalValueModel = await getFinalValueModel(connection);
      const AuditLogModel = await getAuditLogModel(connection);

      const finalValue = await FinalValueModel.findById(finalValueId).session(dbSession);
      if (!finalValue) throw new Error("Final value tidak ditemukan.");

      const previousValue = finalValue.value;
      finalValue.value = newValue;
      await finalValue.save({ session: dbSession });

      await AuditLogModel.create(
        [
          {
            finalValueId: finalValue._id,
            action: "override",
            previousValue,
            newValue,
            reason,
            performedBy: session!.user.id,
            performedAt: new Date(),
          },
        ],
        { session: dbSession }
      );
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Override gagal." };
  } finally {
    await dbSession.endSession();
  }

  await agenda.now(SYNC_READMODEL_JOB, {});
  revalidatePath("/rekonsiliasi");
  return { ok: true, data: undefined };
}

export async function listAuditLog(finalValueId: string) {
  const AuditLogModel = await getAuditLogModel();
  return AuditLogModel.find({ finalValueId }).sort({ performedAt: -1 }).lean();
}

/* ------------------------------ F-05 Cross-Cutting ------------------------------
 * PRD 5.3 (v10.2): rekonsiliasi awal (Sprint 3-4) diasumsikan single-owner per
 * indikator. F-05 memperluas ini TANPA mengubah kunci unik FinalValue
 * (indicatorId+workUnitId+periodYear+periodLabel tetap sama) — setiap OPD
 * kontributor tetap punya FinalValue miliknya sendiri. Yang ditambahkan F-05:
 * (1) visibilitas — Bapperida bisa lihat submission OPD lain untuk indikator
 * cross-cutting yang sama saat me-review salah satunya, supaya bisa menilai
 * konsistensi angka antar OPD sebelum approve; (2) rollup — jumlah seluruh
 * FinalValue lintas OPD untuk kebutuhan pelaporan gabungan.
 * ---------------------------------------------------------------------------- */

export async function listSiblingSubmissions(
  indicatorId: string,
  periodYear: number,
  periodLabel: string,
  excludeSubmissionId: string
) {
  const IndicatorModel = await getIndicatorModel();
  const indicator = await IndicatorModel.findById(indicatorId).select("crossCuttingWorkUnitIds").lean();
  if (!indicator || (indicator.crossCuttingWorkUnitIds ?? []).length === 0) {
    return { isCrossCutting: false, siblings: [] };
  }

  const SubmissionModel = await getSubmissionModel();
  const siblings = await SubmissionModel.find({
    indicatorId,
    periodYear,
    periodLabel,
    _id: { $ne: excludeSubmissionId },
  })
    .populate("workUnitId", "name")
    .lean();

  return { isCrossCutting: true, siblings };
}

export async function getCrossCuttingRollup(indicatorId: string, periodYear: number, periodLabel: string) {
  const FinalValueModel = await getFinalValueModel();
  const values = await FinalValueModel.find({ indicatorId, periodYear, periodLabel })
    .populate("workUnitId", "name")
    .lean();

  const total = values.reduce((sum, v) => sum + (parseNumeric(v.value) ?? 0), 0);
  return { values, total, contributingWorkUnits: values.length };
}
