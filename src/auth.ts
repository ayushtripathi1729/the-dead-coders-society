import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function adminDiagnostic(message: string, metadata?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.info(`[admin-auth] ${message}`, metadata ?? "");
}

async function ensureBootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!email || !passwordHash) {
    adminDiagnostic("bootstrap skipped: ADMIN_EMAIL or ADMIN_PASSWORD_HASH is missing");
    return null;
  }

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) return existing;

  const admin = await prisma.admin.create({
    data: {
      email,
      name: "The Dead Coders Society Admin",
      passwordHash,
    },
  });
  adminDiagnostic("bootstrap admin created", { email });
  return admin;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 30 * 60 },
  pages: {
    signIn: "/controlroomadmin",
  },
  providers: [
    Credentials({
      name: "Admin credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          adminDiagnostic("login rejected: invalid credential shape");
          return null;
        }

        try {
          await ensureBootstrapAdmin();
        } catch (error) {
          adminDiagnostic("bootstrap failed", { error: error instanceof Error ? error.message : "unknown" });
          return null;
        }

        const admin = await prisma.admin.findUnique({
          where: { email: parsed.data.email },
        });

        if (!admin) {
          adminDiagnostic("login rejected: admin not found", { email: parsed.data.email });
          return null;
        }

        const valid = await compare(
          parsed.data.password,
          admin.passwordHash
        );

        if (!valid) {
          adminDiagnostic("login rejected: password mismatch", { email: parsed.data.email });
          return null;
        }

        adminDiagnostic("login accepted", { adminId: admin.id });

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name ?? "Control Room",
          role: "ADMIN",
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role ?? "ADMIN";
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = String(token.role ?? "");
      }
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}tdcs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
});
