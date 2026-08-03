import { z } from "zod";

/**
 * DDT v2.0 Section 2.3/3.1 — menggantikan createSubmissionSchema (v1.0).
 * `evidenceLink` opsional di level Zod karena wajib hanya untuk
 * sourceType="manual" — ditegakkan di Server Action (butuh baca
 * Indicator.variableSources untuk tahu sourceType, tidak bisa di sini).
 */
export const createVariableRealizationSchema = z.object({
  variableId: z.string(),
  indicatorId: z.string(),
  workUnitId: z.string(),
  periodYear: z.number().int().min(2020).max(2100),
  periodLabel: z.string().trim().min(1),
  reportedValue: z.string().trim().min(1, "Nilai realisasi wajib diisi"),
  evidenceLink: z.string().trim().url("Link bukti harus berupa URL yang valid").nullable().default(null),
});
export type CreateVariableRealizationInput = z.infer<typeof createVariableRealizationSchema>;

/** DDT v2.0 Section 3.4 — konfirmasi ulang nilai oleh PD saat hasil ekstraksi tidak cocok. */
export const confirmVariableRealizationSchema = z.object({
  realizationId: z.string(),
  confirmedValue: z.string().trim().min(1, "Nilai konfirmasi wajib diisi"),
});
export type ConfirmVariableRealizationInput = z.infer<typeof confirmVariableRealizationSchema>;

export const reviewVariableRealizationSchema = z
  .object({
    realizationId: z.string(),
    decision: z.enum(["disetujui", "ditolak"]),
    rejectionNote: z.string().trim().optional(),
  })
  .refine((data) => data.decision !== "ditolak" || (data.rejectionNote?.length ?? 0) > 0, {
    message: "Alasan penolakan wajib diisi.",
    path: ["rejectionNote"],
  });
export type ReviewVariableRealizationInput = z.infer<typeof reviewVariableRealizationSchema>;

/**
 * F-08 — Override Nilai Final, single-tier (PRD 5.3, keputusan v10.2).
 * Batas 500 karakter adalah aturan bisnis eksplisit dari PRD — dan HARUS
 * divalidasi ulang di Server Action (bukan hanya di form client), karena
 * inilah satu-satunya penghalang teknis terhadap risiko self-approval yang
 * diterima Bapperida (PRD Section 8, Open Issue #8). DDT v2.0 — sekarang
 * mengacu ke VariableFinalValue, bukan FinalValue level-indikator.
 */
export const overrideVariableFinalValueSchema = z.object({
  variableFinalValueId: z.string(),
  newValue: z.string().trim().min(1, "Nilai baru wajib diisi"),
  reason: z.string().trim().min(500, "Alasan resmi wajib minimal 500 karakter (PRD 5.3)."),
});
export type OverrideVariableFinalValueInput = z.infer<typeof overrideVariableFinalValueSchema>;
