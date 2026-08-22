import { prisma } from "@/lib/prisma";
import { requireBrowserApiSession } from "@/lib/api-guard";
import { sealedJson } from "@/lib/api-envelope";
import { resolveUserRole } from "@/lib/rbac";

/**
 * Sealed JSON session probe for org-admin UI.
 * Network tab shows an envelope ({ v, iv, ct, k }), not plain role fields.
 */
export async function GET(request: Request) {
  const gate = await requireBrowserApiSession(request);
  if ("response" in gate) return gate.response;

  const role = await resolveUserRole(gate.session);
  const dbUser = await prisma.user.findUnique({
    where: { id: gate.session.user.id },
    select: { organizationId: true, isActive: true },
  });

  if (!dbUser?.isActive) {
    return sealedJson({ error: "Unauthorized" }, { status: 401 });
  }

  return sealedJson({
    ok: true,
    role,
    organizationId: dbUser.organizationId,
    userId: gate.session.user.id,
  });
}
