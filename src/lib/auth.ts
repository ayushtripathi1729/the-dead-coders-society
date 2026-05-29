import type { NextRequest } from "next/server";
import { auth } from "@/auth";

export async function requireAdmin(request?: NextRequest) {
  void request;
  const session = await auth();
  if (process.env.NODE_ENV !== "production") {
    console.info("[admin-auth] session validation", { ok: session?.user?.role === "ADMIN" });
  }
  return session?.user?.role === "ADMIN" ? session.user : null;
}
