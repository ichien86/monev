import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { getUserModel } from "@simonev/db";
import { loginSchema } from "@simonev/schemas";
import { authConfig } from "@/auth.config";

/**
 * CATATAN PENGECUALIAN TERHADAP DDT Section 2: koleksi `users` sengaja tetap
 * di `simonev_core` (satu sumber kebenaran untuk seluruh akun, dikelola
 * Admin Sistem lewat SIMONEV Ops) — bukan diduplikasi ke `simonev_readmodel`.
 * Login di sini SATU-SATUNYA titik di mana Eksekutif membaca `simonev_core`,
 * dan itu pun hanya query `findOne` sesaat saat autentikasi, bukan pada
 * setiap page view. Ini tidak melanggar rasionalisasi pemisahan baca/tulis
 * (performa & permukaan keamanan dashboard) karena tidak membaca data bisnis
 * (indikator/submission/tagging) sama sekali — hanya kredensial login.
 *
 * Login di aplikasi ini SENGAJA hanya berhasil untuk role "pimpinan"
 * (DDT Section 7 — Pimpinan Daerah: view-only, seluruh route). Pengguna
 * dengan role lain yang mencoba login di sini akan ditolak walau kredensial
 * benar — mereka seharusnya memakai SIMONEV Ops, bukan Eksekutif.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata Sandi", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const UserModel = await getUserModel();
        const user = await UserModel.findOne({ email, isActive: true, role: "pimpinan" }).select(
          "+passwordHash"
        );
        if (!user) return null;

        const passwordValid = await argon2.verify(user.passwordHash, password);
        if (!passwordValid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
