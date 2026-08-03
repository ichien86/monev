"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  connectCore,
  getVariableRealizationModel,
  getVariableFinalValueModel,
  getAuditLogModel,
  getIndicatorModel,
} from "@simonev/db";
import {
  reviewVariableRealizationSchema,
  overrideVariableFinalValueSchema,
  type ReviewVariableRealizationInput,
  type OverrideVariableFinalValueInput,
} from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";
import { agenda } from "@/worker/agenda";
import { RECOMPUTE_INDICATOR_VALUE_JOB } from "@/worker/jobs/recomputeIndicatorValue.job";
import { notify } from "@/lib/notify";
import { parseNumeric } from "@/lib/capaian";

function requireAdminPerencana(role: string | undefined) {
  // Peran "Admin Perencana" (PRD v10.3) memakai role teknis `bapperida` yang
  // sama persis — lihat catatan di escalateStaleReviews.job.ts.
  return role === "bapperida";
}

export async function listPendingReview() {
  const VariableRealizationModel = await getVariableRealizationModel();
  return VariableRealizationModel.find({
    status: { $in: ["menunggu_admin_perencana", "ditandai_gagal_ekstrak"] },
  })
    .sort({ createdAt: 1 })
    .populate("variableId", "name unit")
    .populate("indicatorId", "label")
    .populate("workUnitId", "name")
    .lean();
}

/**
 * F-08 — review substansi Admin Perencana (PRD 5.3, DDT v2.0 Section 3.1/3.3).
 * DDT v2.0 — beroperasi di level VariableRealization/VariableFinalValue.
 * Untuk variabel cross-cutting Tipe Berbagi mode "dijumlahkan" (F-05, DDT
 * v2.0 3.3), approve memicu agregasi ULANG dari seluruh realisasi disetujui
 * milik OPD kontributor — karena VariableFinalValue global per
 * (variableId, periode), BUKAN per OPD seperti FinalValue v1.0.
 */
export async function reviewVariableRealization(input: ReviewVariableRealizationInput): Promise<ActionResult> {
  const session = await auth();
  if (!requireAdminPerencana(session?.user.role)) {
    return { ok: false, error: "Hanya Admin Perencana yang dapat mereview realisasi." };
  }

  const parsed = reviewVariableRealizationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const { realizationId, decision, rejectionNote } = parsed.data;

  const VariableRealizationModel = await getVariableRealizationModel();
  const realization = await VariableRealizationModel.findById(realizationId);
  if (!realization || !["menunggu_admin_perencana", "ditandai_gagal_ekstrak"].includes(realization.status)) {
    return { ok: false, error: "Realisasi tidak ditemukan atau sudah diproses." };
  }

  if (decision === "ditolak") {
    realization.status = "ditolak";
    realization.reviewedBy = session!.user.id as any;
    realization.reviewedAt = new Date();
    realization.rejectionNote = rejectionNote ?? null;
    await realization.save();
    await notify({
      userId: realization.submittedBy.toString(),
      type: "warning",
      title: "Realisasi ditolak Admin Perencana",
      message: `Periode ${realization.periodLabel} ${realization.periodYear}: ${rejectionNote ?? "Tanpa catatan."}`,
      link: "/input-data",
    });
    revalidatePath("/rekonsiliasi");
    return { ok: true, data: undefined };
  }

  const IndicatorModel = await getIndicatorModel();
  const indicator = await IndicatorModel.findById(realization.indicatorId).lean();
  const splitEntry = indicator?.crossCutting?.splitConfig?.find(
    (s) => s.variableId.toString() === realization.variableId.toString()
  );
  const isSummed = splitEntry?.mode === "dijumlahkan";

  const connection = await connectCore();
  const dbSession = await connection.startSession();
  let finalValueForNotify = "";
  try {
    await dbSession.withTransaction(async () => {
      const FinalValueModel = await getVariableFinalValueModel(connection);
      const AuditLogModel = await getAuditLogModel(connection);
      const RealizationModel = await getVariableRealizationModel(connection);

      realization.status = "disetujui";
      realization.reviewedBy = session!.user.id as any;
      realization.reviewedAt = new Date();
      await realization.save({ session: dbSession });

      let newValue: string;
      if (isSummed && indicator) {
        const contributingWorkUnitIds = indicator.crossCutting?.workUnitIds ?? [];
        const approved = await RealizationModel.find({
          variableId: realization.variableId,
          periodYear: realization.periodYear,
          periodLabel: realization.periodLabel,
          workUnitId: { $in: contributingWorkUnitIds },
          status: "disetujui",
        })
          .session(dbSession)
          .lean();
        const sum = approved.reduce((total, r) => total + (parseNumeric(r.reportedValue) ?? 0), 0);
        newValue = String(sum);
      } else {
        newValue = realization.reportedValue;
      }
      finalValueForNotify = newValue;

      const existing = await FinalValueModel.findOne({
        variableId: realization.variableId,
        periodYear: realization.periodYear,
        periodLabel: realization.periodLabel,
      }).session(dbSession);
      const previousValue = existing?.value ?? null;

      const finalValue = await FinalValueModel.findOneAndUpdate(
        {
          variableId: realization.variableId,
          periodYear: realization.periodYear,
          periodLabel: realization.periodLabel,
        },
        {
          variableId: realization.variableId,
          periodYear: realization.periodYear,
          periodLabel: realization.periodLabel,
          value: newValue,
          sourceRealizationId: realization._id,
          approvedBy: session!.user.id,
          approvedAt: new Date(),
          isLocked: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, session: dbSession }
      );

      await AuditLogModel.create(
        [
          {
            variableFinalValueId: finalValue._id,
            action: "approve",
            previousValue,
            newValue,
            reason: null,
            performedBy: session!.user.id,
            performedAt: new Date(),
          },
        ],
        { session: dbSession }
      );
    });
  } finally {
    await dbSession.endSession();
  }

  await notify({
    userId: realization.submittedBy.toString(),
    type: "success",
    title: "Realisasi disetujui",
    message: `Nilai ${finalValueForNotify} untuk periode ${realization.periodLabel} ${realization.periodYear} telah disetujui dan menjadi nilai final variabel.`,
    link: "/input-data",
  });
  await agenda.now(RECOMPUTE_INDICATOR_VALUE_JOB, { variableId: realization.variableId.toString() });
  revalidatePath("/rekonsiliasi");
  return { ok: true, data: undefined };
}

export async function listApprovedFinalValues() {
  const FinalValueModel = await getVariableFinalValueModel();
  return FinalValueModel.find({})
    .sort({ approvedAt: -1 })
    .limit(50)
    .populate("variableId", "name unit")
    .lean();
}

/**
 * F-08 — Override, single-tier (PRD 5.3, keputusan v10.2). DDT v2.0 —
 * sekarang mengacu ke VariableFinalValue (global per variabel+periode),
 * bukan FinalValue level-indikator per-OPD.
 */
export async function overrideVariableFinalValue(input: OverrideVariableFinalValueInput): Promise<ActionResult> {
  const session = await auth();
  if (!requireAdminPerencana(session?.user.role)) {
    return { ok: false, error: "Hanya Admin Perencana yang dapat melakukan override." };
  }

  const parsed = overrideVariableFinalValueSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const { variableFinalValueId, newValue, reason } = parsed.data;

  const connection = await connectCore();
  const dbSession = await connection.startSession();
  let variableId = "";
  try {
    await dbSession.withTransaction(async () => {
      const FinalValueModel = await getVariableFinalValueModel(connection);
      const AuditLogModel = await getAuditLogModel(connection);

      const finalValue = await FinalValueModel.findById(variableFinalValueId).session(dbSession);
      if (!finalValue) throw new Error("Final value tidak ditemukan.");
      variableId = finalValue.variableId.toString();

      const previousValue = finalValue.value;
      finalValue.value = newValue;
      await finalValue.save({ session: dbSession });

      await AuditLogModel.create(
        [
          {
            variableFinalValueId: finalValue._id,
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

  await agenda.now(RECOMPUTE_INDICATOR_VALUE_JOB, { variableId });
  revalidatePath("/rekonsiliasi");
  return { ok: true, data: undefined };
}

export async function listAuditLog(variableFinalValueId: string) {
  const AuditLogModel = await getAuditLogModel();
  return AuditLogModel.find({ variableFinalValueId }).sort({ performedAt: -1 }).lean();
}

/* ------------------------------ F-05 Cross-Cutting ------------------------------
 * DDT v2.0 Section 3.3 — sebelum approve, Admin Perencana bisa melihat
 * realisasi OPD lain untuk variabel & periode cross-cutting yang sama,
 * supaya bisa menilai konsistensi angka antar OPD.
 * ---------------------------------------------------------------------------- */

export async function listSiblingRealizations(
  variableId: string,
  periodYear: number,
  periodLabel: string,
  excludeRealizationId: string
) {
  const IndicatorModel = await getIndicatorModel();
  const indicator = await IndicatorModel.findOne({ "formula.variableId": variableId }).lean();
  if (!indicator || !indicator.crossCutting?.type) {
    return { isCrossCutting: false, siblings: [] };
  }

  const VariableRealizationModel = await getVariableRealizationModel();
  const siblings = await VariableRealizationModel.find({
    variableId,
    periodYear,
    periodLabel,
    _id: { $ne: excludeRealizationId },
  })
    .populate("workUnitId", "name")
    .lean();

  return { isCrossCutting: true, siblings };
}
