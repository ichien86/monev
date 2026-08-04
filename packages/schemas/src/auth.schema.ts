import { z } from "zod";

/** DDT v2.0 Section 2.10/4.1 — autentikasi berbasis username (PRD 2.1), menggantikan login-by-email v1.0. */
export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Username wajib diisi"),
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
});
export type LoginInput = z.infer<typeof loginSchema>;
