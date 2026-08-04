"use server";

import { auth } from "@/auth";
import {
  getVariableRealizationModel,
  getScheduleModel,
  getIndicatorModel,
  getVariableModel,
} from "@simonev/db";
import { createVariableRealizationSchema, type CreateVariableRealizationInput } from "@simonev/schemas";
import type { ActionResult } from "@/lib/action-result";
import { agenda } from "@/worker/agenda";
import { VALIDATE_EVIDENCE_JOB } from "@/worker/jobs/validateEvidence.job";

/**
 * DDT v2.0 Section 2.3/3.1 — menggantikan createSubmission (v1.0). Alur:
 * 1. Cek indikator ini memang tanggung jawab PD (owner ATAU cross-cutting, F-05).
 * 2. Cek variabel ini sourceType="manual" (satu_data/api tidak boleh dientri manual).
 * 3. Cek F-03: periode yang bersangkutan belum terkunci.
 * 4. Simpan realisasi berstatus awal "validasi_link".
 * 5. Enqueue job Agenda `validate-evidence` — TIDAK diproses di sini
 *    (lihat DDT 6.1: realisasi tidak boleh menunggu validasi eksternal).
 */
export async function createVariableRealization(
  input: CreateVariableRealizationInput
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (session?.user.role !== "pd_opd" || !session.user.workUnitId) {
    return { ok: false, error: "Hanya operator PD yang dapat mengirim realisasi." };
  }

  const parsed = createVariableRealizationSchema.safeParse({
    ...input,
    workUnitId: session.user.workUnitId,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const data = parsed.data;

  const IndicatorModel = await getIndicatorModel();
  const indicator = await IndicatorModel.findById(data.indicatorId).lean();
  if (!indicator) return { ok: false, error: "Indikator tidak ditemukan." };

  const isOwner = indicator.ownerWorkUnitId?.toString() === data.workUnitId;
  const isCrossCutting = (indicator.crossCutting?.workUnitIds ?? []).some(
    (id) => id.toString() === data.workUnitId
  );
  if (!isOwner && !isCrossCutting) {
    return { ok: false, error: "Anda tidak berwenang melapor untuk indikator ini." };
  }

  const formulaEntry = indicator.formula.find((f) => f.variableId.toString() === data.variableId);
  if (!formulaEntry) {
    return { ok: false, error: "Variabel ini bukan bagian dari formula indikator tersebut." };
  }

  // F-05 Tipe Terpisah, mode "ditunjuk" (DDT v2.0 3.3) — hanya OPD yang
  // ditunjuk boleh melapor untuk variabel ini; PD lain ditolak di level
  // validasi, bukan ikut agregasi.
  const splitEntry = indicator.crossCutting?.splitConfig?.find(
    (s) => s.variableId.toString() === data.variableId
  );
  if (splitEntry?.mode === "ditunjuk" && splitEntry.designatedWorkUnitId?.toString() !== data.workUnitId) {
    return {
      ok: false,
      error: "Variabel ini hanya boleh dilaporkan oleh PD yang ditunjuk (F-05 Tipe Terpisah).",
    };
  }
  const sourceEntry = indicator.variableSources?.find((s) => s.variableId.toString() === data.variableId);
  const sourceType = sourceEntry?.sourceType ?? "manual";
  if (sourceType !== "manual") {
    return {
      ok: false,
      error: "Variabel ini sumber datanya otomatis (Satu Data/API) — tidak dientri manual.",
    };
  }
  if (!data.evidenceLink) {
    return { ok: false, error: "Link bukti wajib diisi." };
  }

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
      error: "Periode pelaporan ini sudah terkunci (F-03) dan tidak dapat menerima realisasi baru.",
    };
  }

  const VariableRealizationModel = await getVariableRealizationModel();

  const existingActive = await VariableRealizationModel.findOne({
    variableId: data.variableId,
    indicatorId: data.indicatorId,
    workUnitId: data.workUnitId,
    periodYear: data.periodYear,
    periodLabel: data.periodLabel,
    status: { $ne: "ditolak" },
  }).lean();
  if (existingActive) {
    return {
      ok: false,
      error: "Sudah ada realisasi aktif untuk variabel dan periode ini.",
    };
  }

  const created = await VariableRealizationModel.create({
    ...data,
    sourceType: "manual",
    submittedBy: session.user.id,
    status: "validasi_link",
  });

  await agenda.now(VALIDATE_EVIDENCE_JOB, { realizationId: created._id.toString() });

  return { ok: true, data: { id: created._id.toString() } };
}

/**
 * Daftar (Indikator, Variabel) yang boleh dilaporkan PD ini secara manual —
 * gabungan indikator yang dia MILIKI (ownerWorkUnitId) ATAU cross-cutting
 * yang mencantumkan dia sebagai kontributor (F-05), difilter hanya variabel
 * bersumber "manual" (satu_data/api ditarik otomatis, bukan dientri PD).
 */
export async function listReportableVariables() {
  const session = await auth();
  if (!session?.user.workUnitId) return [];

  const IndicatorModel = await getIndicatorModel();
  const indicators = await IndicatorModel.find({
    tier: "SASARAN_PROGRAM",
    isActive: true,
    $or: [
      { ownerWorkUnitId: session.user.workUnitId },
      { "crossCutting.workUnitIds": session.user.workUnitId },
    ],
  })
    .select("label formula variableSources")
    .lean();

  const variableIds = Array.from(
    new Set(indicators.flatMap((i) => i.formula.map((f) => f.variableId.toString())))
  );
  const VariableModel = await getVariableModel();
  const variables = await VariableModel.find({ _id: { $in: variableIds } }).select("name unit").lean();
  const variableById = new Map(variables.map((v) => [v._id.toString(), v]));

  const options: { indicatorId: string; indicatorLabel: string; variableId: string; variableName: string }[] = [];
  for (const indicator of indicators) {
    for (const entry of indicator.formula) {
      const sourceType =
        indicator.variableSources?.find((s) => s.variableId.toString() === entry.variableId.toString())
          ?.sourceType ?? "manual";
      if (sourceType !== "manual") continue;
      const variable = variableById.get(entry.variableId.toString());
      if (!variable) continue;
      options.push({
        indicatorId: indicator._id.toString(),
        indicatorLabel: indicator.label,
        variableId: entry.variableId.toString(),
        variableName: `${variable.name} (${variable.unit})`,
      });
    }
  }
  return options;
}

export async function listMyRealizations() {
  const session = await auth();
  if (!session?.user.workUnitId) return [];

  const VariableRealizationModel = await getVariableRealizationModel();
  return VariableRealizationModel.find({ workUnitId: session.user.workUnitId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("variableId", "name")
    .populate("indicatorId", "label")
    .lean();
}

/**
 * DDT v2.0 Section 3.4 — jalan keluar untuk status "menunggu_konfirmasi_pd"
 * (ekstraksi dokumen TIDAK menemukan angka yang cocok dengan reportedValue).
 * Sebelum ini ditambahkan, status tersebut adalah jalan buntu: badge-nya
 * sudah berbunyi "Menunggu Konfirmasi Anda" tapi tidak ada aksi apa pun yang
 * bisa memicu transisinya, DAN createVariableRealization menolak kiriman
 * baru untuk variabel+periode yang sama selama status realisasi lama bukan
 * "ditolak" — jadi PD terkunci permanen dari variabel+periode itu begitu
 * ekstraksi salah mendeteksi mismatch (termasuk mismatch PALSU akibat
 * flakiness pdf-parse, lihat document-extraction.ts). PD menegaskan nilainya
 * tetap benar walau tidak match otomatis; realisasi lanjut ke antrean review
 * substansi Admin Perencana (perlakuan sama seperti ditandai_gagal_ekstrak).
 */
export async function confirmMismatchedRealization(realizationId: string): Promise<ActionResult> {
  const session = await auth();
  if (session?.user.role !== "pd_opd" || !session.user.workUnitId) {
    return { ok: false, error: "Hanya operator PD yang dapat mengonfirmasi realisasi." };
  }

  const VariableRealizationModel = await getVariableRealizationModel();
  const realization = await VariableRealizationModel.findOne({
    _id: realizationId,
    workUnitId: session.user.workUnitId,
  });
  if (!realization || realization.status !== "menunggu_konfirmasi_pd") {
    return { ok: false, error: "Realisasi tidak ditemukan atau tidak sedang menunggu konfirmasi." };
  }

  realization.status = "menunggu_admin_perencana";
  await realization.save();

  return { ok: true, data: undefined };
}
