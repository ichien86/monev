import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import type { UserRole } from "@simonev/db";

/**
 * PENTING: middleware ini SENGAJA tidak mengimpor "@/auth" (yang memuat
 * Credentials provider + argon2 + mongoose) karena middleware Next.js
 * berjalan di Edge Runtime — lihat catatan lengkap di auth.config.ts.
 * Instance NextAuth di sini hanya dipakai untuk membaca sesi dari cookie,
 * bukan untuk proses login.
 */
const { auth } = NextAuth(authConfig);

/**
 * RBAC per-route (DDT Section 7). Ini lapisan pertama; setiap Server Action
 * sensitif TETAP memeriksa ulang role dari session di server (lihat
 * pohon-kinerja/actions.ts) — middleware saja tidak cukup untuk aksi seperti
 * override (PRD 5.3), karena middleware bisa terlewat pada request non-navigasi.
 */
const ROUTE_ROLES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/pohon-kinerja", roles: ["bapperida", "admin_sistem", "pd_opd"] },
  { prefix: "/variabel", roles: ["bapperida", "admin_sistem"] },
  { prefix: "/org-unit", roles: ["admin_sistem"] },
  { prefix: "/input-data", roles: ["pd_opd"] },
  { prefix: "/rekonsiliasi", roles: ["bapperida"] },
  { prefix: "/tagging", roles: ["bapperida", "admin_sistem", "pd_opd"] },
  { prefix: "/jadwal", roles: ["bapperida", "admin_sistem"] },
  { prefix: "/simulasi", roles: ["bapperida", "admin_sistem"] },
  { prefix: "/laporan", roles: ["bapperida", "admin_sistem", "pd_opd"] },
  { prefix: "/pengaturan", roles: ["admin_sistem"] },
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const session = req.auth;
  if (!session?.user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const rule = ROUTE_ROLES.find((r) => pathname.startsWith(r.prefix));
  if (rule && !rule.roles.includes(session.user.role)) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
