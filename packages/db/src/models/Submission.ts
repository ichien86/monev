import { Schema, type InferSchemaType, type Connection, type Model } from "mongoose";
import { connectCore } from "../connection";

/**
 * F-04 — Input & Validasi Bukti (PRD 5.2, DDT Section 5.2 & 6.1).
 * Unique key gabungan menegakkan PRD 5.4 langsung di level database:
 * satu indikator+PD+periode hanya boleh punya satu submission AKTIF
 * (submission yang ditolak tetap tersimpan sebagai riwayat, lihat status).
 */
export const SUBMISSION_STATUSES = [
  "validasi_link",
  "validasi_format",
  "ditolak_sistem",
  "menunggu_bapperida",
  "disetujui",
  "ditolak_bapperida",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

const submissionSchema = new Schema(
  {
    indicatorId: { type: Schema.Types.ObjectId, ref: "Indicator", required: true },
    workUnitId: { type: Schema.Types.ObjectId, ref: "OrgUnit", required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    periodYear: { type: Number, required: true },
    periodLabel: { type: String, required: true },

    reportedValue: { type: String, required: true },
    evidenceLink: { type: String, required: true },

    status: { type: String, enum: SUBMISSION_STATUSES, default: "validasi_link" },

    systemValidation: {
      linkAccessible: { type: Boolean, default: null },
      formatValid: { type: Boolean, default: null },
      checkedAt: { type: Date, default: null },
      failureReason: { type: String, default: null },
    },

    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionNote: { type: String, default: null },

    // F-06 — ditandai saat job escalate-stale-reviews mengeskalasi submission
    // ini (menunggu review > 5 hari). Null = belum pernah dieskalasi.
    escalatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/**
 * Unique key PARSIAL: hanya menegakkan keunikan untuk submission yang masih
 * "aktif" dalam alur (belum ditolak). Kalau submission ditolak (sistem atau
 * Bapperida), PD boleh mengirim submission baru untuk indikator+periode yang
 * sama — riwayat penolakan sebelumnya tetap tersimpan sebagai dokumen terpisah
 * (mendukung audit trail PRD 5.4), bukan ditimpa.
 */
submissionSchema.index(
  { indicatorId: 1, workUnitId: 1, periodYear: 1, periodLabel: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["validasi_link", "validasi_format", "menunggu_bapperida", "disetujui"] },
    },
  }
);
submissionSchema.index({ status: 1, createdAt: 1 });
submissionSchema.index({ workUnitId: 1, createdAt: -1 });

export type SubmissionDoc = InferSchemaType<typeof submissionSchema>;

export async function getSubmissionModel(conn?: Connection): Promise<Model<SubmissionDoc>> {
  const connection = conn ?? (await connectCore());
  return (
    (connection.models.Submission as Model<SubmissionDoc>) ??
    connection.model<SubmissionDoc>("Submission", submissionSchema)
  );
}
