import { z } from "zod";

/** DDT v2.0 Section 2.12 — scope "entri_split_tagging" dihapus, dua scope baru ditambah. */
export const createScheduleSchema = z.object({
  scope: z.enum(["pelaporan_indikator", "penentuan_target", "penutupan_tahun"]),
  refId: z.string(),
  periodYear: z.number().int().min(2020).max(2100),
  periodLabel: z.string().trim().min(1),
  deadlineAt: z.string().datetime().or(z.string().min(1)), // input datetime-local tidak selalu ISO penuh
});
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
