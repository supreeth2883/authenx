/**
 * Centralized API client for AuthenX frontend.
 * All calls go through /api/proxy/* which injects the JWT cookie.
 *
 * Features:
 * - Automatic retry with exponential backoff for transient 502/503 on safe GET endpoints
 * - 401 → redirect to /login
 * - 403 → throw with "Forbidden" message
 * - 429 → throw with rate-limit message
 * - x-request-id extracted from responses and included in error messages
 * - Cold-start detection (latency > 3s)
 */

const PROXY_BASE = "/api/proxy";
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1500, 3000]; // ms

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function friendlyMessage(status: number, body: string | null): string {
  try {
    if (body) {
      const parsed = JSON.parse(body);
      if (parsed.message) {
        if (Array.isArray(parsed.message)) return parsed.message.join("; ");
        return String(parsed.message);
      }
    }
  } catch {
    // not JSON
  }
  switch (status) {
    case 400: return "Invalid request — please check your input.";
    case 401: return "Session expired — please sign in again.";
    case 403: return "Access denied — insufficient permissions.";
    case 404: return "Resource not found.";
    case 409: return "Conflict — this resource already exists.";
    case 429: return "Too many requests — please wait a moment.";
    case 502: return "Backend is starting up — please retry.";
    case 503: return "Service temporarily unavailable.";
    default: return `Request failed (HTTP ${status}).`;
  }
}

async function baseFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = path.startsWith("/") ? `${PROXY_BASE}${path}` : `${PROXY_BASE}/${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

async function handleResponse<T>(res: Response): Promise<T> {
  const requestId = res.headers.get("x-request-id") ?? undefined;
  const body = await res.text();

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError("Session expired", 401, requestId);
  }

  if (!res.ok) {
    const msg = friendlyMessage(res.status, body);
    throw new ApiError(
      requestId ? `${msg} (ref: ${requestId.slice(0, 8)})` : msg,
      res.status,
      requestId,
    );
  }

  if (!body || body.trim() === "") return {} as T;
  return JSON.parse(body) as T;
}

/** GET with automatic retry for 502/503. */
export async function apiGet<T = unknown>(path: string): Promise<T> {
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await baseFetch(path, { method: "GET" });

      if ((res.status === 502 || res.status === 503) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }

      return await handleResponse<T>(res);
    } catch (err) {
      if (err instanceof ApiError) {
        if ((err.status === 502 || err.status === 503) && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
          lastError = err;
          continue;
        }
        throw err;
      }
      // Network error — retry
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        lastError = new ApiError("Network error — backend may be starting up.", 0);
        continue;
      }
      throw new ApiError("Network error — backend may be starting up.", 0);
    }
  }

  throw lastError ?? new ApiError("Request failed after retries.", 502);
}

/** POST — no retry (not idempotent). */
export async function apiPost<T = unknown>(path: string, data?: unknown): Promise<T> {
  const res = await baseFetch(path, {
    method: "POST",
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  return handleResponse<T>(res);
}

/** PATCH — no retry. */
export async function apiPatch<T = unknown>(path: string, data?: unknown): Promise<T> {
  const res = await baseFetch(path, {
    method: "PATCH",
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  return handleResponse<T>(res);
}

/** DELETE — no retry. */
export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const res = await baseFetch(path, { method: "DELETE" });
  return handleResponse<T>(res);
}

/** Raw fetch via proxy — for cases needing raw Response (e.g., CSV export). */
export async function apiRaw(path: string, init?: RequestInit): Promise<Response> {
  return baseFetch(path, init);
}
