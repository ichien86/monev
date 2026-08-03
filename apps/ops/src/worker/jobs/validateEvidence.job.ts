import type Agenda from "agenda";
import type { Job } from "agenda";
import { getVariableRealizationModel } from "@simonev/db";
import { validateEvidenceLink } from "@/lib/evidence-validation";
import { notify } from "@/lib/notify";
import { VALIDATE_EXTRACTION_JOB } from "./validateExtraction.job";

export const VALIDATE_EVIDENCE_JOB = "validate-evidence";

type ValidateEvidenceData = { realizationId: string };

/**
 * DDT v2.0 Section 3.1/3.4 — alur lengkap: realisasi masuk berstatus
 * `validasi_link` → job ini jalan (cek link+format) → lolos lanjut ke job
 * `validate-extraction` (DDT 3.4, khusus sourceType="manual") → hasil
 * ekstraksi menentukan realisasi lanjut ke `menunggu_admin_perencana` atau
 * kembali ke PD (`menunggu_konfirmasi_pd`). Tidak lolos link/format →
 * `ditolak` langsung di sini, tanpa lanjut ke ekstraksi.
 */
export function defineValidateEvidenceJob(agenda: Agenda) {
  agenda.define(VALIDATE_EVIDENCE_JOB, async (job: Job<ValidateEvidenceData>) => {
    const { realizationId } = job.attrs.data;
    const VariableRealizationModel = await getVariableRealizationModel();
    const realization = await VariableRealizationModel.findById(realizationId);
    if (!realization) {
      console.warn(`[${VALIDATE_EVIDENCE_JOB}] Realisasi ${realizationId} tidak ditemukan, dilewati.`);
      return;
    }

    // Hanya realisasi manual (evidenceLink terisi) yang lewat jalur ini —
    // sourceType satu_data/api langsung final lewat job pull-external-sources
    // (DDT v2.0 3.5), tidak pernah masuk antrean validate-evidence.
    if (realization.sourceType !== "manual" || !realization.evidenceLink) {
      console.warn(`[${VALIDATE_EVIDENCE_JOB}] Realisasi ${realizationId} bukan sourceType manual, dilewati.`);
      return;
    }

    const result = await validateEvidenceLink(realization.evidenceLink);

    if (!result.accessible) {
      realization.status = "ditolak";
      realization.systemValidation = {
        linkAccessible: false,
        formatValid: false,
        extractedValue: null,
        extractionMatched: null,
        failureReason: result.failureReason,
      };
      realization.rejectionNote = result.failureReason;
      await realization.save();
      await notify({
        userId: realization.submittedBy.toString(),
        type: "warning",
        title: "Realisasi ditolak sistem",
        message: `Link bukti untuk periode ${realization.periodLabel} ${realization.periodYear} tidak dapat diakses: ${result.failureReason}`,
        link: "/input-data",
      });
      return;
    }

    if (!result.formatValid) {
      realization.status = "ditolak";
      realization.systemValidation = {
        linkAccessible: true,
        formatValid: false,
        extractedValue: null,
        extractionMatched: null,
        failureReason: result.failureReason,
      };
      realization.rejectionNote = result.failureReason ?? null;
      await realization.save();
      await notify({
        userId: realization.submittedBy.toString(),
        type: "warning",
        title: "Realisasi ditolak sistem",
        message: `Format dokumen bukti untuk periode ${realization.periodLabel} ${realization.periodYear} tidak didukung: ${result.failureReason}`,
        link: "/input-data",
      });
      return;
    }

    realization.status = "validasi_ekstraksi";
    realization.systemValidation = {
      linkAccessible: true,
      formatValid: true,
      extractedValue: null,
      extractionMatched: null,
      failureReason: null,
    };
    await realization.save();

    await agenda.now(VALIDATE_EXTRACTION_JOB, { realizationId: realization._id.toString() });
  });
}
