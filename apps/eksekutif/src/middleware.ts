import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Dua lapis pembatas (DDT Section 4.A): (1) method selain GET ditolak di
 * level ini — bukan cuma di UI — karena aplikasi ini secara arsitektur
 * memang tidak boleh punya kemampuan tulis sama sekali; (2) role selain
 * "pimpinan" ditolak walau berhasil autentikasi (jaga-jaga jika suatu saat
 * ada role lain ditambahkan ke koleksi users).
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new NextResponse("Method Not Allowed — aplikasi ini bersifat view-only.", { status: 405 });
  }

  const session = req.auth;
  if (!session?.user || session.user.role !== "pimpinan") {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
