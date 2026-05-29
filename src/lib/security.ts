import type { NextRequest } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function requestOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || request.nextUrl.protocol.replace(":", "") || "https";
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  return normalizeOrigin(host ? `${proto}://${host}` : request.nextUrl.origin);
}

function configuredOrigins(request: NextRequest) {
  const origins = new Set<string>();
  const add = (value?: string | null) => {
    const origin = normalizeOrigin(value);
    if (origin) origins.add(origin);
  };

  add(requestOrigin(request));
  add("http://localhost:3000");
  add("http://127.0.0.1:3000");
  add(process.env.NEXTAUTH_URL);
  add(process.env.AUTH_URL);
  add(process.env.NEXT_PUBLIC_SITE_URL);
  add(process.env.SITE_URL);
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_BRANCH_URL);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);

  for (const origin of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
    add(origin.trim());
  }

  return origins;
}

export function enforceSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const requestHeaderOrigin = normalizeOrigin(origin);
  if (!requestHeaderOrigin) return false;

  return configuredOrigins(request).has(requestHeaderOrigin);
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
