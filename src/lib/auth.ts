import type { NextRequest } from "next/server";
import { auth } from "@/auth";

export async function requireAdmin(request?: NextRequest) {
  void request;
  const session = await auth();
  return session?.user?.role === "ADMIN" ? session.user : null;
}
