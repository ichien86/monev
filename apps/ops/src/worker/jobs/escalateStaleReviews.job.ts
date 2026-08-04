import type Agenda from "agenda";
import { getVariableRealizationModel, getUserModel, getVariableModel, getOrgUnitModel } from "@simonev/db";
import { notify } from "@/lib/notify";

export const ESCALATE_STALE_REVIEWS_JOB = "escalate-stale-reviews";

/**
 * F-06 — Manajemen Eskalasi Cerdas (PRD Section 3 F-06). DDT v2.0 — beroperasi
 * di level VariableRealization berstatus `menunggu_admin_perencana` (dan
 * `ditandai_gagal_ekstrak`, yang tetap masuk antrean review meski ekstraksi
 * gagal — DDT v2.0 Section 3.4), menggantikan Submission `menunggu_bapperida`
 * versi v1.0.
 *
 * Peran "Admin Perencana" di PRD v10.3 memakai role teknis `bapperida` yang
 * sama persis (belum ada perubahan daftar role di DDT v2.0 Section 4) — jadi
 * notifikasi tetap dikirim ke seluruh akun role `bapperida`, bukan hierarki
 * berjenjang, konsisten dengan keputusan v10.2 yang menghapus approval
 * berjenjang di F-08.
 *
 * Setiap realisasi hanya dieskalasi SEKALI (ditandai lewat `escalatedAt`).
 */
const AMBANG_HARI = 5;

export function defineEscalateStaleReviewsJob(agenda: Agenda) {
  agenda.define(ESCALATE_STALE_REVIEWS_JOB, async () => {
    const VariableRealizationModel = await getVariableRealizationModel();
    const UserModel = await getUserModel();
    // Perlu didaftarkan eksplisit di sini -- .populate() di bawah butuh skema
    // Indicator & OrgUnit sudah terdaftar di koneksi, dan job ini tidak boleh
    // bergantung pada job LAIN (mis. sync-readmodel) yang kebetulan sudah
    // mendaftarkannya lebih dulu sebagai efek samping.
    await getVariableModel();
    await getOrgUnitModel();

    const threshold = new Date(Date.now() - AMBANG_HARI * 24 * 60 * 60 * 1000);
    const stale = await VariableRealizationModel.find({
      status: { $in: ["menunggu_admin_perencana", "ditandai_gagal_ekstrak"] },
      createdAt: { $lte: threshold },
      escalatedAt: null,
    })
      .populate("variableId", "name")
      .populate("workUnitId", "name")
      .lean();

    if (stale.length === 0) return;

    const adminPerencanaUsers = await UserModel.find({ role: "bapperida", isActive: true })
      .select("_id")
      .lean();

    for (const realization of stale) {
      for (const user of adminPerencanaUsers) {
        await notify({
          userId: user._id.toString(),
          type: "warning",
          title: "Eskalasi: realisasi menunggu terlalu lama",
          message: `${(realization.variableId as any)?.name ?? "?"} dari ${(realization.workUnitId as any)?.name ?? "?"} sudah menunggu review lebih dari ${AMBANG_HARI} hari.`,
          link: "/rekonsiliasi",
        });
      }
      await VariableRealizationModel.updateOne(
        { _id: realization._id },
        { $set: { escalatedAt: new Date() } }
      );
    }

    console.log(`[${ESCALATE_STALE_REVIEWS_JOB}] Mengeskalasi ${stale.length} realisasi.`);
  });
}
