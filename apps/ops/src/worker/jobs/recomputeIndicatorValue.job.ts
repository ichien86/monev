import type Agenda from "agenda";
import type { Job } from "agenda";
import { getIndicatorModel } from "@simonev/db";
import { SYNC_READMODEL_JOB } from "./syncReadmodel.job";

export const RECOMPUTE_INDICATOR_VALUE_JOB = "recompute-indicator-value";

type RecomputeIndicatorValueData = { variableId: string };

/**
 * DDT v2.0 Section 3.1 langkah 5 — dipicu `agenda.now()` setiap kali
 * VariableFinalValue berubah (approve/override F-08, atau tarikan otomatis
 * F-05.2/3.5). Mencari seluruh Indicator yang memakai variabel ini di
 * formulanya, lalu memicu penghitungan ulang.
 *
 * Penyederhanaan yang didokumentasikan eksplisit: sistem ini tidak
 * menyimpan cache nilai per-indikator terpisah — satu-satunya tempat nilai
 * indikator "dimatangkan" untuk tampilan adalah ReadmodelSnapshot (DDT
 * Section 6.3). Job ini karena itu memicu ulang sync-readmodel, bukan
 * menulis field cache baru di Indicator — cukup untuk skala data proyek
 * ini, dan menghindari dua sumber kebenaran (cache indikator vs snapshot).
 */
export function defineRecomputeIndicatorValueJob(agenda: Agenda) {
  agenda.define(RECOMPUTE_INDICATOR_VALUE_JOB, async (job: Job<RecomputeIndicatorValueData>) => {
    const { variableId } = job.attrs.data;
    const IndicatorModel = await getIndicatorModel();
    const affected = await IndicatorModel.countDocuments({
      "formula.variableId": variableId,
      isActive: true,
    });
    if (affected === 0) return;

    console.log(
      `[${RECOMPUTE_INDICATOR_VALUE_JOB}] ${affected} indikator terdampak oleh variabel ${variableId}.`
    );
    await agenda.now(SYNC_READMODEL_JOB, {});
  });
}
