import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";
import { getSettings } from "@/lib/settings";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "admin";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "user" | "admin";
  }
}

interface AppJWT {
  userId?: string;
  role?: "user" | "admin";
  email?: string | null;
}

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function buildConfig(): Promise<NextAuthConfig> {
  const { google } = await getSettings();

  const providers: NextAuthConfig["providers"] = [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        };
      },
    }),
  ];

  if (google?.clientId && google?.clientSecret) {
    providers.push(
      Google({
        clientId: google.clientId,
        clientSecret: google.clientSecret,
      }),
    );
  }

  return {
    session: { strategy: "jwt" },
    trustHost: true,
    providers,
    pages: {
      signIn: "/auth/signin",
      error: "/auth/error",
    },
    callbacks: {
      async signIn({ user, account }) {
        // Credentials sign-in already validated the password against an
        // existing user row, so it's authorized.
        if (account?.provider === "credentials") return true;

        // Google sign-in: only existing users (created via setup or invite)
        // can sign in. We never auto-provision from Google.
        const email = user.email?.toLowerCase();
        if (!email) return false;
        const existing = await prisma.user.findUnique({ where: { email } });
        return existing != null;
      },
      async jwt({ token, user, trigger }) {
        const t = token as AppJWT & typeof token;
        if (user) {
          t.userId = user.id;
          t.role = (user as { role?: "user" | "admin" }).role ?? "user";
        }
        if (!t.userId && t.email) {
          const u = await prisma.user.findUnique({
            where: { email: t.email },
            select: { id: true, role: true },
          });
          if (u) {
            t.userId = u.id;
            t.role = u.role;
          }
        }
        if (trigger === "update" && t.userId) {
          const u = await prisma.user.findUnique({
            where: { id: t.userId },
            select: { role: true },
          });
          if (u) t.role = u.role;
        }
        return t;
      },
      async session({ session, token }) {
        const t = token as AppJWT;
        if (t.userId) {
          session.user.id = t.userId;
          session.user.role = t.role ?? "user";
        }
        return session;
      },
    },
    events: {
      async signIn({ user }) {
        if (!user.id) return;
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      },
    },
  };
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(buildConfig);

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}

export async function isFirstRun(): Promise<boolean> {
  const count = await prisma.user.count();
  return count === 0;
}
