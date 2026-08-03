import { z } from "zod";

/** DDT v2.0 Section 2.9 — `urusan` (teks bebas) diganti `bidangUrusanIds` (maks 3, PRD 5.9). */
export const createOrgUnitSchema = z.object({
  name: z.string().trim().min(3, "Nama OPD minimal 3 karakter"),
  sipdCode: z.string().trim().min(1, "Kode SIPD wajib diisi"),
  bidangUrusanIds: z
    .array(z.string())
    .min(1, "Minimal satu Bidang Urusan")
    .max(3, "Maksimal 3 Bidang Urusan per Perangkat Daerah"),
  isExternal: z.boolean().default(false),
});
export type CreateOrgUnitInput = z.infer<typeof createOrgUnitSchema>;
