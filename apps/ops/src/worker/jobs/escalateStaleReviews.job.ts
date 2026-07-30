import type Agenda from "agenda";
import { getSubmissionModel, getUserModel } from "@simonev/db";
import { notify } from "@/lib/notify";

export const ESCALATE_STALE_REVIEWS_JOB = "escalate-stale-reviews";

/**
 * F-06 — Manajemen Eskalasi Cerdas (PRD Section 3 F-06). Aturan eskalasi
 * yang diimplementasikan (default yang masuk akal, dapat disesuaikan):
 * submission berstatus `menunggu_bapperida` lebih dari AMBANG_HARI hari
 * dieskalasi — dikirim notifikasi ke SELURUH akun Bapperida (bukan hanya
 * satu penanggung jawab tunggal, karena PRD tidak mendefinisikan hierarki
 * eskalasi berjenjang di luar peran Bapperida itu sendiri — lihat juga
 * keputusan v10.2 yang menghapus approval berjenjang di F-08 untuk alasan
 * yang sama: kesederhanaan struktur organisasi yang dimodelkan sistem ini).
 *
 * Setiap submission hanya dieskalasi SEKALI (ditandai lewat `escalatedAt`
 * pada submission itu sendiri) — bukan berulang setiap hari job ini jalan,
 * supaya tidak membanjiri Bapperida dengan notifikasi duplikat untuk item
 * yang sama.
 */
const AMBANG_HARI = 5;

export function defineEscalateStaleReviewsJob(agenda: Agenda) {
  agenda.define(ESCALATE_STALE_REVIEWS_JOB, async () => {
    const SubmissionModel = await getSubmissionModel();
    const UserModel = await getUserModel();

    const threshold = new Date(Date.now() - AMBANG_HARI * 24 * 60 * 60 * 1000);
    const stale = await SubmissionModel.find({
      status: "menunggu_bapperida",
      createdAt: { $lte: threshold },
      escalatedAt: null,
    })
      .populate("indicatorId", "label")
      .populate("workUnitId", "name")
      .lean();

    if (stale.length === 0) return;

    const bapperidaUsers = await UserModel.find({ role: "bapperida", isActive: true }).select("_id").lean();

    for (const submission of stale) {
      for (const user of bapperidaUsers) {
        await notify({
          userId: user._id.toString(),
          type: "warning",
          title: "Eskalasi: submission menunggu terlalu lama",
          message: `${(submission.indicatorId as any)?.label ?? "?"} dari ${(submission.workUnitId as any)?.name ?? "?"} sudah menunggu review lebih dari ${AMBANG_HARI} hari.`,
          link: "/rekonsiliasi",
        });
      }
      await SubmissionModel.updateOne({ _id: submission._id }, { $set: { escalatedAt: new Date() } });
    }

    console.log(`[${ESCALATE_STALE_REVIEWS_JOB}] Mengeskalasi ${stale.length} submission.`);
  });
}
