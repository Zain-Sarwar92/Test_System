import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { customSession } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

function normalizeAppUrl(url?: string) {
  return url?.replace(/\/+$/, "");
}

function devLocalOrigins(): string[] {
  if (process.env.NODE_ENV === "production") return [];

  const port = process.env.PORT ?? "5001";
  return [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `http://[::1]:${port}`,
  ];
}

function extraTrustedOrigins(): string[] {
  const raw = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => normalizeAppUrl(v.trim()))
    .filter((v): v is string => typeof v === "string" && v.length > 0 && !v.includes("*"));
}

const authBaseUrl = normalizeAppUrl(
  process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL,
);

const trustedOrigins = [
  ...new Set(
    [
      authBaseUrl,
      normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL),
      normalizeAppUrl(process.env.APP_URL),
      ...devLocalOrigins(),
      ...extraTrustedOrigins(),
      process.env.VERCEL_ENV === "production" &&
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined,
    ].filter((v): v is string => Boolean(v)),
  ),
];

export const auth = betterAuth({
  baseURL: authBaseUrl,
  trustedOrigins,
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