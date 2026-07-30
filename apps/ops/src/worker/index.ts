import "dotenv/config";
import { agenda } from "./agenda";
import { LOCK_OVERDUE_PERIODS_JOB, defineLockOverduePeriodsJob } from "./jobs/lockPeriod.job";
import { SYNC_READMODEL_JOB, defineSyncReadmodelJob } from "./jobs/syncReadmodel.job";
import { VALIDATE_EVIDENCE_JOB, defineValidateEvidenceJob } from "./jobs/validateEvidence.job";
import { SCHEDULE_REMINDER_JOB, defineScheduleReminderJob } from "./jobs/scheduleReminder.job";
import { ESCALATE_STALE_REVIEWS_JOB, defineEscalateStaleReviewsJob } from "./jobs/escalateStaleReviews.job";

/**
 * Proses Node terpisah dari server Next.js (dijalankan lewat `npm run worker`,
 * lihat DDT Section 2 diagram — kontainer `agenda-worker`). Memisahkan proses
 * ini dari request-handling Next.js supaya job yang berjalan lama (impor SIPD,
 * validasi bukti) tidak pernah memblokir permintaan HTTP pengguna.
 */
async function main() {
  defineLockOverduePeriodsJob(agenda);
  defineSyncReadmodelJob(agenda);
  defineValidateEvidenceJob(agenda);
  defineScheduleReminderJob(agenda);
  defineEscalateStaleReviewsJob(agenda);

  await agenda.start();

  // F-03: cek periode yang perlu dikunci setiap jam.
  await agenda.every("1 hour", LOCK_OVERDUE_PERIODS_JOB);

  // DDT 6.3: sinkronisasi read-model tiap 15 menit — plus dipicu langsung
  // dari Server Action F-08 setelah approve/override (agenda.now(...)),
  // bukan hanya menunggu jadwal ini.
  await agenda.every("15 minutes", SYNC_READMODEL_JOB);

  // F-03+F-12: cek jadwal mendekati tenggat sekali sehari (01:00 UTC = 08:00 WIB).
  await agenda.every("0 1 * * *", SCHEDULE_REMINDER_JOB);

  // F-06: cek submission yang menunggu review terlalu lama, sekali sehari
  // (02:00 UTC = 09:00 WIB, sengaja berjarak dari job reminder di atas).
  await agenda.every("0 2 * * *", ESCALATE_STALE_REVIEWS_JOB);

  // VALIDATE_EVIDENCE_JOB tidak dijadwalkan berkala — selalu dipicu langsung
  // (agenda.now) oleh Server Action createSubmission (F-04) begitu submission
  // baru dibuat. Didaftarkan di sini supaya worker tahu cara memprosesnya.

  console.log("SIMONEV Ops worker berjalan. Job terdaftar:", [
    LOCK_OVERDUE_PERIODS_JOB,
    SYNC_READMODEL_JOB,
    VALIDATE_EVIDENCE_JOB,
    SCHEDULE_REMINDER_JOB,
    ESCALATE_STALE_REVIEWS_JOB,
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
