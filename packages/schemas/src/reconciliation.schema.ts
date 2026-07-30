import { z } from "zod";

/**
 * F-04 — Input & Validasi Bukti (PRD 5.2). Validasi teknis (aksesibilitas link,
 * format dokumen) dilakukan async oleh sistem (lihat DDT 6.1) — skema ini hanya
 * menegakkan bentuk input yang wajib ada sebelum submission dibuat.
 */
export const createSubmissionSchema = z.object({
  indicatorId: z.string(),
  workUnitId: z.string(),
  periodYear: z.number().int().min(2020).max(2100),
  periodLabel: z.string().trim().min(1),
  reportedValue: z.string().trim().min(1, "Nilai realisasi wajib diisi"),
  evidenceLink: z.string().trim().url("Link bukti harus berupa URL yang valid"),
});
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const reviewSubmissionSchema = z.object({
  submissionId: z.string(),
  decision: z.enum(["disetujui", "ditolak_bapperida"]),
  rejectionNote: z.string().trim().optional(),
}).refine(
  (data) => data.decision !== "ditolak_bapperida" || (data.rejectionNote?.length ?? 0) > 0,
  { message: "Alasan penolakan wajib diisi.", path: ["rejectionNote"] }
);
export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;

/**
 * F-08 — Override Nilai Final, single-tier (PRD 5.3, keputusan v10.2).
 * Batas 500 karakter adalah aturan bisnis eksplisit dari PRD — dan HARUS
 * divalidasi ulang di Server Action (bukan hanya di form client), karena
 * inilah satu-satunya penghalang teknis terhadap risiko self-approval yang
 * diterima Bapperida (PRD Section 8, Open Issue #8).
 */
export const overrideFinalValueSchema = z.object({
  finalValueId: z.string(),
  newValue: z.string().trim().min(1, "Nilai baru wajib diisi"),
  reason: z
    .string()
    .trim()
    .min(500, "Alasan resmi wajib minimal 500 karakter (PRD 5.3)."),
});
export type OverrideFinalValueInput = z.infer<typeof overrideFinalValueSchema>;
