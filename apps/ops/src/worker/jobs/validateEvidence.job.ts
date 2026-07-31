import type Agenda from "agenda";
import type { Job } from "agenda";
import { getSubmissionModel } from "@simonev/db";
import { validateEvidenceLink } from "@/lib/evidence-validation";
import { notify } from "@/lib/notify";

export const VALIDATE_EVIDENCE_JOB = "validate-evidence";

type ValidateEvidenceData = { submissionId: string };

/**
 * F-04 — alur lengkap DDT Section 6.1: submission masuk berstatus
 * `validasi_link` → job ini jalan → hasil menentukan submission lanjut ke
 * `menunggu_bapperida` atau berhenti di `ditolak_sistem`. Tidak ada langkah
 * manusia di antara PD dan Bapperida (peran Walidata sudah dicabut, PRD v10.2).
 */
export function defineValidateEvidenceJob(agenda: Agenda) {
  agenda.define(VALIDATE_EVIDENCE_JOB, async (job: Job<ValidateEvidenceData>) => {
    const { submissionId } = job.attrs.data;
    const SubmissionModel = await getSubmissionModel();
    const submission = await SubmissionModel.findById(submissionId);
    if (!submission) {
      console.warn(`[${VALIDATE_EVIDENCE_JOB}] Submission ${submissionId} tidak ditemukan, dilewati.`);
      return;
    }

    const result = await validateEvidenceLink(submission.evidenceLink);

    if (!result.accessible) {
      submission.status = "ditolak_sistem";
      submission.systemValidation = {
        linkAccessible: false,
        formatValid: false,
        checkedAt: new Date(),
        failureReason: result.failureReason,
      };
      await submission.save();
      await notify({
        userId: submission.submittedBy.toString(),
        type: "warning",
        title: "Submission ditolak sistem",
        message: `Link bukti untuk periode ${submission.periodLabel} ${submission.periodYear} tidak dapat diakses: ${result.failureReason}`,
        link: "/input-data",
      });
      return;
    }

    submission.status = result.formatValid ? "menunggu_bapperida" : "ditolak_sistem";
    submission.systemValidation = {
      linkAccessible: true,
      formatValid: result.formatValid,
      checkedAt: new Date(),
      failureReason: result.formatValid ? null : result.failureReason,
    };
    await submission.save();

    if (!result.formatValid) {
      await notify({
        userId: submission.submittedBy.toString(),
        type: "warning",
        title: "Submission ditolak sistem",
        message: `Format dokumen bukti untuk periode ${submission.periodLabel} ${submission.periodYear} tidak didukung: ${result.failureReason}`,
        link: "/input-data",
      });
    }
  });
}
