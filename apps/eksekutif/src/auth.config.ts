import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@simonev/db";

/**
 * Sama seperti apps/ops (lihat catatan lengkap di sana): konfigurasi ini
 * Edge-safe, dipakai middleware untuk membaca sesi saja.
 *
 * Perbedaan penting dari apps/ops: aplikasi ini SECARA ARSITEKTUR tidak
 * pernah menulis data (DDT Section 4.A) — middleware di sini bahkan menolak
 * apa pun selain method GET, bukan hanya membatasi berdasarkan role.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    session({ session, token }) {
      session.user.role = token.role as UserRole;
      return session;
    },
  },
} satisfies NextAuthConfig;
