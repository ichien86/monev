import { z } from "zod";

/** DDT v2.0 Section 2.1 — master data Variable, dipakai lintas Indicator. */
export const createVariableSchema = z.object({
  name: z.string().trim().min(3, "Nama variabel minimal 3 karakter"),
  unit: z.string().trim().min(1, "Satuan wajib diisi"),
});
export type CreateVariableInput = z.infer<typeof createVariableSchema>;

export const updateVariableSchema = createVariableSchema.extend({
  id: z.string(),
  isActive: z.boolean(),
});
export type UpdateVariableInput = z.infer<typeof updateVariableSchema>;
