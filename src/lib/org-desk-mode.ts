import { cookies } from "next/headers";

export const ORG_DESK_COOKIE = "org_desk_mode";
export type OrgDeskMode = "full" | "paper";

/** Paper desk: only test generate / saved tests (shared Org Admin login for teachers). */
export const PAPER_DESK_PREFIXES = [
  "/org-admin/generate",
  "/org-admin/tests",
  "/org-admin/profile",
] as const;

export function isPaperDeskPath(pathname: string) {
  if (pathname === "/org-admin") return true;
  return PAPER_DESK_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function getOrgDeskMode(): Promise<OrgDeskMode> {
  const jar = await cookies();
  return jar.get(ORG_DESK_COOKIE)?.value === "paper" ? "paper" : "full";
}

export function paperDeskHome() {
  return "/org-admin/generate";
}
