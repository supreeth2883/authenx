import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/verify", "/_next", "/favicon.ico", "/api/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for JWT token cookie
  const token = request.cookies.get("token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    const redirectTarget = request.nextUrl.search
      ? `${pathname}${request.nextUrl.search}`
      : pathname;
    loginUrl.searchParams.set("redirect", redirectTarget);
    return NextResponse.redirect(loginUrl);
  }

  // Decode JWT payload (without verification — verification happens on the API)
  try {
    const payloadBase64 = token.split(".")[1];
    const payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString()
    );
    const role: string = payload.role;

    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    // STRICT role-based route protection — each portal is isolated
    // /admin/* → SUPER_ADMIN only
    if (pathname.startsWith("/admin")) {
      if (role !== "SUPER_ADMIN") {
        const dest = role === "COLLEGE_ADMIN" ? "/college" : role === "EMPLOYER" ? "/employer" : "/login";
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }

    // /college/* → COLLEGE_ADMIN only
    if (pathname.startsWith("/college")) {
      if (role !== "COLLEGE_ADMIN") {
        const dest = role === "SUPER_ADMIN" ? "/admin" : role === "EMPLOYER" ? "/employer" : "/login";
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }

    // /employer/* → EMPLOYER only
    if (pathname.startsWith("/employer")) {
      if (role !== "EMPLOYER") {
        const dest = role === "SUPER_ADMIN" ? "/admin" : role === "COLLEGE_ADMIN" ? "/college" : "/login";
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }
  } catch {
    // Invalid token — redirect to login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
