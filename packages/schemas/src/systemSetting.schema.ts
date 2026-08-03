import { z } from "zod";

/** DDT v2.0 Section 2.11 — Tahun Aktif (PRD 5.5.1), diatur Admin Sistem. */
export const setTahunAktifSchema = z.object({
  value: z.number().int().min(2020).max(2100),
});
export type SetTahunAktifInput = z.infer<typeof setTahunAktifSchema>;
