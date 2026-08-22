import { NextResponse } from "next/server";
import { trustedOrigins } from "@/lib/auth";
import { getSession, type AppSession } from "@/lib/rbac";

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Soft “browser UI” lock for /api org routes.
 * - Requires a valid Better Auth session cookie
 * - Requires same-origin fetch metadata and/or a trusted Origin/Referer
 *
 * Honest limit: Postman with a stolen session cookie can still call the API.
 * Goal: block anonymous / scripted hits without a browser session.
 */
export function assertBrowserApiOrigin(request: Request): NextResponse | null {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "same-site") {
    return null;
  }

  // `<img src>` / navigation sometimes omit Origin; allow trusted Referer.
  const origin =
    normalizeOrigin(request.headers.get("origin")) ??
    normalizeOrigin(request.headers.get("referer"));

  if (origin && trustedOrigins.includes(origin)) {
    return null;
  }

  // Dev: allow missing Origin when Sec-Fetch-Site is missing (some tools),
  // but still require session below — production stays strict.
  if (process.env.NODE_ENV !== "production" && !fetchSite && !origin) {
    return null;
  }

  return NextResponse.json(
    { error: "Forbidden: browser origin required" },
    { status: 403 },
  );
}

export async function requireBrowserApiSession(
  request: Request,
): Promise<{ session: AppSession } | { response: NextResponse }> {
  const originBlock = assertBrowserApiOrigin(request);
  if (originBlock) return { response: originBlock };

  const session = await getSession();
  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { session };
}
