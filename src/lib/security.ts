import type { NextRequest } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function enforceSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const expected = process.env.NEXTAUTH_URL;
  if (!expected) return true;

  return new URL(origin).origin === new URL(expected).origin;
}

export function rateLimit(request: NextRequest, limit = 30, windowMs = 60_000) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  current.count += 1;
  return current.count <= limit;
}
