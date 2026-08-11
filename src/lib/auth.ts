import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { customSession } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // public signup off — admin/invite creates users
    autoSignIn: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Org switch ke baad stale organizationId na rahe
    cookieCache: {
      enabled: false,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "TEACHER",
        input: false,
      },
      organizationId: {
        type: "string",
        required: false,
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  plugins: [
    customSession(async ({ user, session }) => {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          role: true,
          organizationId: true,
          isActive: true,
        },
      });

      return {
        session,
        user: {
          ...user,
          role: dbUser?.role ?? "TEACHER",
          organizationId: dbUser?.organizationId ?? null,
          isActive: dbUser?.isActive ?? true,
        },
      };
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;