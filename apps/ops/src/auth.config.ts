import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@simonev/db";

/**
 * Konfigurasi "Edge-safe" — TIDAK memuat provider Credentials (yang butuh
 * argon2 + mongoose, keduanya bergantung pada Node.js API asli seperti
 * node:crypto dan tidak berjalan di Edge Runtime tempat middleware.ts
 * dieksekusi Next.js secara default).
 *
 * `middleware.ts` membuat instance NextAuth terpisah dari objek ini —
 * hanya untuk MEMBACA sesi (JWT dari cookie), bukan untuk login sesungguhnya.
 * Login sesungguhnya (yang menyentuh database & argon2) hanya terjadi di
 * `auth.ts`, yang dipakai Route Handler & Server Action (Node runtime).
 *
 * Referensi pola: https://authjs.dev/guides/edge-compatibility
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // Diisi penuh di auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.workUnitId = user.workUnitId;
      }
      return token;
    },
    session({ session, token }) {
      // NextAuth secara bawaan menyimpan id user di token.sub (claim standar
      // JWT), tapi TIDAK otomatis menyalinnya ke session.user.id — harus
      // eksplisit di sini agar Server Action bisa tahu siapa yang login
      // (dipakai mis. sebagai submittedBy di F-04).
      if (token.sub) session.user.id = token.sub;
      session.user.role = token.role as UserRole;
      session.user.workUnitId = (token.workUnitId as string | null) ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
