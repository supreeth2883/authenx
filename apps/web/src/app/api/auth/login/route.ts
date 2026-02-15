import { NextRequest, NextResponse } from "next/server";

// Server-side URL: inside Docker use internal network; in prod/Render, use the public URL.
// API_URL (server-only) takes priority over NEXT_PUBLIC_API_URL (client-side, baked at build).
const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

/**
 * POST /api/auth/login
 *
 * Proxies login to the cloud-api, then sets an HttpOnly cookie
 * on the WEB domain so Next.js middleware can read it.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const apiRes = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      return NextResponse.json(data, { status: apiRes.status });
    }

    // Set cookie on the web domain (same-origin — always works)
    const isProd = process.env.NODE_ENV === "production";
    const response = NextResponse.json(data, { status: 200 });

    response.cookies.set("token", data.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch {
    return NextResponse.json(
      { message: "Login proxy error" },
      { status: 502 }
    );
  }
}
