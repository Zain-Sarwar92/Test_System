"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ORG_DESK_COOKIE, type OrgDeskMode, paperDeskHome } from "@/lib/org-desk-mode";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

async function expectedUnlockPin(organizationId: string | null | undefined) {
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { deskUnlockPin: true },
    });
    const orgPin = org?.deskUnlockPin?.trim();
    if (orgPin) return orgPin;
  }
  return (process.env.ORG_FULL_ADMIN_PIN ?? "4321").trim();
}

export async function setOrgDeskMode(input: {
  mode: OrgDeskMode;
  unlockPin?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRole(["ORG_ADMIN"]);
  const mode = input.mode;

  if (mode === "full") {
    const pin = (input.unlockPin ?? "").trim();
    if (!pin) {
      return { ok: false as const, error: "Full admin PIN enter karo." };
    }
    const expected = await expectedUnlockPin(session.user.organizationId);
    if (pin !== expected) {
      return { ok: false as const, error: "Galat PIN." };
    }
  }

  const jar = await cookies();
  jar.set(ORG_DESK_COOKIE, mode, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 180,
  });
  revalidatePath("/org-admin", "layout");
  redirect(mode === "paper" ? paperDeskHome() : "/org-admin");
}
