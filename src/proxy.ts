import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_PATHS = ["/login", "/register", "/api/auth"];
const PUBLIC_ASSETS = ["/manifest.webmanifest", "/sw.js", "/offline.html"];

function matchesPath(pathname: string, paths: string[]): boolean {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("__session")?.value;

  const isAuthPath = matchesPath(pathname, AUTH_PATHS);
  const isPublicAsset = PUBLIC_ASSETS.includes(pathname);

  if (!sessionCookie && !isAuthPath && !isPublicAsset) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (sessionCookie && isAuthPath && pathname !== "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
