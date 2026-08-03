import type { DefaultSession } from "next-auth";
import type { UserRole } from "@simonev/db";

declare module "next-auth" {
  interface User {
    role: UserRole;
    username: string;
  }
  interface Session {
    user: { role: UserRole; username: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    username: string;
  }
}
