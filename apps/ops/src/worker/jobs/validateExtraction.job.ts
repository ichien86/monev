import type Agenda from "agenda";
import type { Job } from "agenda";
import { getVariableRealizationModel } from "@simonev/db";
import { extractValueFromDocument } from "@/lib/document-extraction";
import { notify } from "@/lib/notify";

export const VALIDATE_EXTRACTION_JOB = "validate-extraction";

type ValidateExtractionData = { realizationId: string };

/**
 * DDT v2.0 Section 3.4 — berjalan setelah validate-evidence (link+format)
 * lolos, khusus untuk sourceType="manual". Membandingkan angka dari
 * `reportedValue` terhadap teks hasil ekstraksi dokumen bukti.
 */
export function defineValidateExtractionJob(agenda: Agenda) {
  agenda.define(VALIDATE_EXTRACTION_JOB, async (job: Job<ValidateExtractionData>) => {
    const { realizationId } = job.attrs.data;
    const VariableRealizationModel = await getVariableRealizationModel();
    const realization = await VariableRealizationModel.findById(realizationId);
    if (!realization || realization.sourceType !== "manual" || !realization.evidenceLink) {
      console.warn(`[${VALIDATE_EXTRACTION_JOB}] Realisasi ${realizationId} tidak valid untuk ekstraksi, dilewati.`);
      return;
    }

    let outcome: Awaited<ReturnType<typeof extractValueFromDocument>>;
    try {
      const response = await fetch(realization.evidenceLink);
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      const buffer = Buffer.from(await response.arrayBuffer());
      outcome = await extractValueFromDocument(buffer, contentType, realization.reportedValue);
    } catch (error) {
      console.warn(`[${VALIDATE_EXTRACTION_JOB}] Gagal mengunduh/memproses dokumen:`, error);
      outcome = { outcome: "failed" };
    }

    const baseValidation = {
      linkAccessible: true,
      formatValid: true,
    };

    if (outcome.outcome === "matched") {
      realization.status = "menunggu_admin_perencana";
      realization.systemValidation = {
        ...baseValidation,
        extractedValue: outcome.extractedValue,
        extractionMatched: true,
        failureReason: null,
      };
      await realization.save();
      return;
    }

    if (outcome.outcome === "mismatch") {
      realization.status = "menunggu_konfirmasi_pd";
      realization.systemValidation = {
        ...baseValidation,
        extractedValue: outcome.extractedValue,
        extractionMatched: false,
        failureReason: "Nilai dalam dokumen tidak cocok dengan nilai yang dilaporkan.",
      };
      await realization.save();
      await notify({
        userId: realization.submittedBy.toString(),
        type: "warning",
        title: "Konfirmasi ulang nilai realisasi",
        message: `Sistem tidak menemukan kecocokan nilai ${realization.reportedValue} di dalam dokumen bukti untuk periode ${realization.periodLabel} ${realization.periodYear}. Mohon konfirmasi ulang.`,
        link: "/input-data",
      });
      return;
    }

    // outcome === "failed" — DDT v2.0 3.4: tetap lanjut ke antrean Admin
    // Perencana dengan flag, BUKAN diblokir tanpa batas waktu.
    realization.status = "ditandai_gagal_ekstrak";
    realization.systemValidation = {
      ...baseValidation,
      extractedValue: null,
      extractionMatched: null,
      failureReason: "Ekstraksi konten dokumen gagal total (format tidak terbaca / OCR gagal).",
    };
    await realization.save();
  });
}
