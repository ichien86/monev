import { z } from "zod";

export const createOrgUnitSchema = z.object({
  name: z.string().trim().min(3, "Nama OPD minimal 3 karakter"),
  sipdCode: z.string().trim().min(1, "Kode SIPD wajib diisi"),
  urusan: z.array(z.string().trim().min(1)).min(1, "Minimal satu urusan"),
});
export type CreateOrgUnitInput = z.infer<typeof createOrgUnitSchema>;
