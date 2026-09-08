import { redirect } from "next/navigation";
import { getOrgDeskMode, isPaperDeskPath, paperDeskHome } from "@/lib/org-desk-mode";

/** Call from blocked org-admin layouts when Paper desk mode is on. */
export async function assertFullOrgDesk(pathnameHint?: string) {
  const mode = await getOrgDeskMode();
  if (mode !== "paper") return;
  if (pathnameHint && isPaperDeskPath(pathnameHint)) return;
  redirect(paperDeskHome());
}
