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

async function ensureBootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!email || !passwordHash) return null;

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) return existing;

  return prisma.admin.create({
    data: {
      email,
      name: "The Dead Coders Society Admin",
      passwordHash,
    },
  });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
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
        console.log("========== LOGIN ATTEMPT ==========");

        const parsed = credentialsSchema.safeParse(rawCredentials);

        console.log("STEP 1 - VALIDATION:", parsed.success);

        if (!parsed.success) {
          console.log("FAILED: Invalid email/password format");
          return null;
        }

        console.log("EMAIL ENTERED:", parsed.data.email);

        try {
          await ensureBootstrapAdmin();
          console.log("STEP 2 - Bootstrap admin completed");
        } catch (error) {
          console.error("BOOTSTRAP ERROR:", error);
          return null;
        }

        const admin = await prisma.admin.findUnique({
          where: { email: parsed.data.email },
        });

        console.log("STEP 3 - ADMIN FOUND:", !!admin);

        if (!admin) {
          console.log("FAILED: Admin not found");
          return null;
        }

        console.log("ADMIN EMAIL IN DB:", admin.email);
        console.log(
          "PASSWORD HASH PREFIX:",
          admin.passwordHash?.substring(0, 7)
        );

        const valid = await compare(
          parsed.data.password,
          admin.passwordHash
        );

        console.log("STEP 4 - PASSWORD VALID:", valid);

        if (!valid) {
          console.log("FAILED: Password mismatch");
          return null;
        }

        console.log("STEP 5 - LOGIN SUCCESS");

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
