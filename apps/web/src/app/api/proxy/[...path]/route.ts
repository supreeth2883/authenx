import { NextRequest, NextResponse } from "next/server";

// Server-side URL: inside Docker use internal network; in prod/Render, use the public URL.
const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

/**
 * Catch-all proxy: /api/proxy/[...path]
 *
 * Forwards requests to the cloud-api backend, injecting the JWT
 * from the web-domain cookie as an Authorization header.
 *
 * This avoids cross-origin cookie issues when web and API are on
 * different domains (e.g. Render free tier).
 */
async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const target = path.join("/");

  // Build the upstream URL, preserving query params
  const url = new URL(`/${target}`, API_URL);
  url.search = request.nextUrl.search;

  // Read JWT from the web-domain cookie
  const token = request.cookies.get("token")?.value;

  // Forward headers (Content-Type, etc.)
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Forward body for POST/PUT/PATCH
  let body: string | null = null;
  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    body = await request.text();
  }

  try {
    const upstream = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
    });

    const data = await upstream.text();
    return new NextResponse(data, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "API proxy error" },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
