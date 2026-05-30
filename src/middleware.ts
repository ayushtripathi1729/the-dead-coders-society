import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";

export async function middleware(request: NextRequest) {
  const isAdminRoute = request.nextUrl.pathname.startsWith("/controlroomadmin");
  const isApiAdminRoute = request.nextUrl.pathname.startsWith("/api/admin");
  const isAuthRoute = request.nextUrl.pathname.startsWith("/api/auth");
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
    cookieName: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}tdcs.session-token`,
  });
  const isSignedIn = token?.role === "ADMIN";

  if ((isAdminRoute || isApiAdminRoute) && !isSignedIn) {
    if (isApiAdminRoute) {
      return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
    }

    if (request.nextUrl.pathname !== "/controlroomadmin") {
      return NextResponse.redirect(new URL("/controlroomadmin", request.url));
    }
  }

  if (isApiAdminRoute && request.method !== "GET") {
    if (!enforceSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    if (!rateLimit(request, 40)) {
      return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
    }
  }

  if (isAuthRoute && request.method === "POST" && !rateLimit(request, 10)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/controlroomadmin/:path*", "/api/admin/:path*", "/api/auth/:path*"],
};
