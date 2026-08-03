import "dotenv/config";
import { agenda } from "./agenda";
import { LOCK_OVERDUE_PERIODS_JOB, defineLockOverduePeriodsJob } from "./jobs/lockPeriod.job";
import { SYNC_READMODEL_JOB, defineSyncReadmodelJob } from "./jobs/syncReadmodel.job";
import { VALIDATE_EVIDENCE_JOB, defineValidateEvidenceJob } from "./jobs/validateEvidence.job";
import { VALIDATE_EXTRACTION_JOB, defineValidateExtractionJob } from "./jobs/validateExtraction.job";
import { SCHEDULE_REMINDER_JOB, defineScheduleReminderJob } from "./jobs/scheduleReminder.job";
import { ESCALATE_STALE_REVIEWS_JOB, defineEscalateStaleReviewsJob } from "./jobs/escalateStaleReviews.job";
import { PULL_EXTERNAL_SOURCES_JOB, definePullExternalSourcesJob } from "./jobs/pullExternalSources.job";
import { RECOMPUTE_INDICATOR_VALUE_JOB, defineRecomputeIndicatorValueJob } from "./jobs/recomputeIndicatorValue.job";

/**
 * Proses Node terpisah dari server Next.js (dijalankan lewat `npm run worker`,
 * lihat DDT Section 2 diagram — kontainer `agenda-worker`). Memisahkan proses
 * ini dari request-handling Next.js supaya job yang berjalan lama (impor
 * realisasi, validasi bukti, OCR) tidak pernah memblokir permintaan HTTP
 * pengguna.
 */
async function main() {
  defineLockOverduePeriodsJob(agenda);
  defineSyncReadmodelJob(agenda);
  defineValidateEvidenceJob(agenda);
  defineValidateExtractionJob(agenda);
  defineScheduleReminderJob(agenda);
  defineEscalateStaleReviewsJob(agenda);
  definePullExternalSourcesJob(agenda);
  defineRecomputeIndicatorValueJob(agenda);

  await agenda.start();

  // F-03: cek periode yang perlu dikunci setiap jam.
  await agenda.every("1 hour", LOCK_OVERDUE_PERIODS_JOB);

  // DDT 6.3: sinkronisasi read-model tiap 15 menit — plus dipicu langsung
  // dari Server Action F-08 setelah approve/override (agenda.now(...)),
  // bukan hanya menunggu jadwal ini.
  await agenda.every("15 minutes", SYNC_READMODEL_JOB);

  // F-03+F-12: cek jadwal mendekati tenggat sekali sehari (01:00 UTC = 08:00 WIB).
  await agenda.every("0 1 * * *", SCHEDULE_REMINDER_JOB);

  // F-06: cek realisasi yang menunggu review terlalu lama, sekali sehari
  // (02:00 UTC = 09:00 WIB, sengaja berjarak dari job reminder di atas).
  await agenda.every("0 2 * * *", ESCALATE_STALE_REVIEWS_JOB);

  // DDT v2.0 3.5 — tarik sumber data otomatis sekali sehari (03:00 UTC =
  // 10:00 WIB). Penyederhanaan yang didokumentasikan eksplisit: belum
  // benar-benar mengikuti buka-tutup Jadwal Pengisian Realisasi per
  // indikator (lihat catatan di pullExternalSources.job.ts) — cron harian
  // tetap.
  await agenda.every("0 3 * * *", PULL_EXTERNAL_SOURCES_JOB);

  // VALIDATE_EVIDENCE_JOB, VALIDATE_EXTRACTION_JOB, dan
  // RECOMPUTE_INDICATOR_VALUE_JOB tidak dijadwalkan berkala — selalu dipicu
  // langsung (agenda.now) secara berantai dari Server Action/job lain
  // begitu peristiwanya terjadi. Didaftarkan di sini supaya worker tahu cara
  // memprosesnya.

  console.log("SIMONEV Ops worker berjalan. Job terdaftar:", [
    LOCK_OVERDUE_PERIODS_JOB,
    SYNC_READMODEL_JOB,
    VALIDATE_EVIDENCE_JOB,
    VALIDATE_EXTRACTION_JOB,
    SCHEDULE_REMINDER_JOB,
    ESCALATE_STALE_REVIEWS_JOB,
    PULL_EXTERNAL_SOURCES_JOB,
    RECOMPUTE_INDICATOR_VALUE_JOB,
  ]);
}

main().catch((error) => {
  console.error("Worker gagal start:", error);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await agenda.stop();
  process.exit(0);
});
