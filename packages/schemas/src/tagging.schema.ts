import { z } from "zod";

export const createThemeSchema = z.object({
  name: z.string().trim().min(3, "Nama tema minimal 3 karakter"),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Format warna harus hex, contoh: #4A6FA5"),
});
export type CreateThemeInput = z.infer<typeof createThemeSchema>;

/**
 * DDT v2.0 Section 2.6/3.6 — parser impor Laporan Realisasi granularitas
 * Rekening, mengisi `pagu`+`realisasi` sekaligus. Menggantikan impor SIPD
 * level-Program (v1.0). Kolom Fungsi/Sub Fungsi diabaikan (tidak dipetakan);
 * Sub-SKPD dipetakan ke `ownerWorkUnitSipdCode` PD induknya (Kode SKPD).
 */
export const budgetStructureRowSchema = z.object({
  level: z.enum(["program", "kegiatan", "subkegiatan", "rekening"]),
  sipdCode: z.string().trim().min(1),
  parentSipdCode: z.string().trim().nullable(),
  name: z.string().trim().min(1),
  pagu: z.number().nonnegative(),
  realisasi: z.number().nonnegative().default(0),
  ownerWorkUnitSipdCode: z.string().trim().nullable().optional(),
});
export type BudgetStructureRow = z.infer<typeof budgetStructureRowSchema>;

export const importBudgetStructureSchema = z.object({
  budgetYear: z.number().int().min(2020).max(2100),
  rows: z.array(budgetStructureRowSchema).min(1, "Minimal satu baris data"),
});
export type ImportBudgetStructureInput = z.infer<typeof importBudgetStructureSchema>;

export const createTaggingSchema = z.object({
  themeId: z.string(),
  budgetStructureId: z.string(),
  budgetYear: z.number().int().min(2020).max(2100),
  coverage: z.enum(["penuh", "sebagian"]),
});
export type CreateTaggingInput = z.infer<typeof createTaggingSchema>;

/**
 * DDT v2.0 Section 2.7 — menggantikan enterSplitCoverageSchema (persentase
 * tunggal, v1.0). Untuk coverage="sebagian": daftar rekening + nominal
 * Rupiah per rekening (PRD 5.7.3).
 */
export const partialAllocationEntrySchema = z.object({
  rekeningStructureId: z.string(),
  amountRupiah: z.number().nonnegative(),
});

export const setPartialAllocationsSchema = z.object({
  taggingId: z.string(),
  allocations: z.array(partialAllocationEntrySchema).min(1, "Minimal satu alokasi rekening"),
});
export type SetPartialAllocationsInput = z.infer<typeof setPartialAllocationsSchema>;
