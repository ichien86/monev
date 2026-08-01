import { z } from "zod";

// Field opsional dari <input> HTML selalu terkirim sebagai string kosong ""
// (bukan undefined) saat dikosongkan -- normalkan ke null supaya tidak
// ditolak validasi min(1) yang seharusnya cuma berlaku kalau diisi.
const optionalText = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

export const createVariableSchema = z.object({
  name: z.string().trim().min(3, "Nama variabel minimal 3 karakter"),
  code: optionalText,
  unit: optionalText,
  source: optionalText,
  description: optionalText,
});
export type CreateVariableInput = z.infer<typeof createVariableSchema>;
