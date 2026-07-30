import { z } from "zod";

export const createScheduleSchema = z.object({
  scope: z.enum(["pelaporan_indikator", "entri_split_tagging"]),
  refId: z.string(),
  periodYear: z.number().int().min(2020).max(2100),
  periodLabel: z.string().trim().min(1),
  deadlineAt: z.string().datetime().or(z.string().min(1)), // input datetime-local tidak selalu ISO penuh
});
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
