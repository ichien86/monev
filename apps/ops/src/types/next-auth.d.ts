import type { DefaultSession } from "next-auth";
import type { UserRole } from "@simonev/db";

declare module "next-auth" {
  interface User {
    role: UserRole;
    workUnitId: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: UserRole;
      workUnitId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    workUnitId: string | null;
  }
}
