import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { getUserModel, type UserRole } from "@simonev/db";
import { loginSchema } from "@simonev/schemas";
import { authConfig } from "@/auth.config";

/**
 * Konfigurasi penuh — HANYA diimpor dari Route Handler (api/auth/[...nextauth])
 * dan dari Server Component/Server Action lain yang berjalan di Node runtime.
 * Jangan pernah diimpor dari middleware.ts (lihat auth.config.ts untuk alasannya).
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
        const user = await UserModel.findOne({ email, isActive: true }).select("+passwordHash");
        if (!user) return null;

        const passwordValid = await argon2.verify(user.passwordHash, password);
        if (!passwordValid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          workUnitId: user.workUnitId ? user.workUnitId.toString() : null,
        };
      },
    }),
  ],
});
