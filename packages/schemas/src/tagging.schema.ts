import { z } from "zod";

export const createThemeSchema = z.object({
  name: z.string().trim().min(3, "Nama tema minimal 3 karakter"),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Format warna harus hex, contoh: #4A6FA5"),
});
export type CreateThemeInput = z.infer<typeof createThemeSchema>;

export const budgetStructureRowSchema = z.object({
  level: z.enum(["program", "kegiatan", "subkegiatan"]),
  sipdCode: z.string().trim().min(1),
  parentSipdCode: z.string().trim().nullable(),
  name: z.string().trim().min(1),
  pagu: z.number().nonnegative(),
  ownerWorkUnitSipdCode: z.string().trim().nullable().optional(),
});
export type BudgetStructureRow = z.infer<typeof budgetStructureRowSchema>;

export const importBudgetStructureSchema = z.object({
  budgetYear: z.number().int().min(2020).max(2100),
  rows: z.array(budgetStructureRowSchema).min(1, "Minimal satu baris data"),
});
export type ImportBudgetStructureInput = z.infer<typeof importBudgetStructureSchema>;

/**
 * F-02 — pembuatan tagging (PRD 5.6). `coveragePercent` sengaja TIDAK
 * diminta di sini walau `coverage === "sebagian"` — proporsi baru dientri PD
 * saat realisasi (skema terpisah: enterSplitCoverageSchema), bukan saat
 * Bapperida pertama kali membuat tag.
 */
export const createTaggingSchema = z.object({
  themeId: z.string(),
  budgetStructureId: z.string(),
  budgetYear: z.number().int().min(2020).max(2100),
  coverage: z.enum(["penuh", "sebagian"]),
  requiresSubTagging: z.boolean().default(false),
});
export type CreateTaggingInput = z.infer<typeof createTaggingSchema>;

export const enterSplitCoverageSchema = z.object({
  taggingId: z.string(),
  coveragePercent: z.number().min(0).max(100),
});
export type EnterSplitCoverageInput = z.infer<typeof enterSplitCoverageSchema>;
