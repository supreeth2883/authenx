import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/_next", "/favicon.ico", "/api/"];

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

    // Role-based route protection
    if (pathname.startsWith("/admin") && role !== "COLLEGE_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/employer", request.url));
    }

    if (pathname.startsWith("/employer") && role !== "EMPLOYER" && role !== "COLLEGE_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/login", request.url));
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
