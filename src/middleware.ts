import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "absensi-karyawan-super-secret-key-neon-dark-mode-2026";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lewati static assets dan api routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  console.log(`[MIDDLEWARE] Path: ${pathname} | Token exists: ${!!token}`);

  // Jika mencoba mengakses rute dashboard tanpa login
  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      console.log(`[MIDDLEWARE] No token found for dashboard route ${pathname}. Redirecting to /login`);
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    try {
      // Verifikasi token JWT menggunakan jose (karena middleware berjalan di runtime Edge di mana jsonwebtoken standard tidak didukung)
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      console.log(`[MIDDLEWARE] Token verified for: ${payload.name} (Role: ${payload.role})`);

      // Proteksi rute admin
      if (pathname.startsWith("/dashboard/admin")) {
        if (payload.role !== "ADMIN") {
          console.log(`[MIDDLEWARE] Unauthorized access attempt to admin route ${pathname} by ${payload.name}. Redirecting to /dashboard`);
          const unauthorizedUrl = new URL("/dashboard", request.url);
          return NextResponse.redirect(unauthorizedUrl);
        }
      }
    } catch (error: any) {
      console.error(`[MIDDLEWARE] JWT verification failed for ${pathname}:`, error.message);
      // Token tidak valid atau kedaluwarsa, hapus cookie dan redirect ke login
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("session");
      return response;
    }
  }

  // Default root path redirect to login if not logged in
  if (pathname === "/") {
    console.log("[MIDDLEWARE] Accessing /, redirecting to /login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
