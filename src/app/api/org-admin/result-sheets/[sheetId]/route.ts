import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBrowserApiSession } from "@/lib/api-guard";
import { sealedJson } from "@/lib/api-envelope";
import { resolveUserRole } from "@/lib/rbac";
import { assertOrgModule } from "@/lib/org-modules";
import { readAssessmentSheetBytes } from "@/lib/assessment-sheet-storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ sheetId: string }> },
) {
  const gate = await requireBrowserApiSession(request);
  if ("response" in gate) {
    // Prefer sealed JSON errors when client asks for JSON; plain for <img> loads.
    const wantsJson = request.headers.get("accept")?.includes("application/json");
    if (wantsJson) {
      return sealedJson(
        { error: gate.response.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: gate.response.status },
      );
    }
    return gate.response;
  }

  const role = await resolveUserRole(gate.session);
  if (role !== "ORG_ADMIN") {
    return sealedJson({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: gate.session.user.id },
    select: { organizationId: true, isActive: true },
  });
  if (!dbUser?.isActive || !dbUser.organizationId) {
    return sealedJson({ error: "Unauthorized" }, { status: 401 });
  }

  await assertOrgModule(dbUser.organizationId, "RESULTS");

  const { sheetId } = await context.params;
  const sheet = await prisma.assessmentSheet.findFirst({
    where: { id: sheetId, assessment: { organizationId: dbUser.organizationId } },
    select: { imagePath: true },
  });
  if (!sheet) {
    return sealedJson({ error: "Not found" }, { status: 404 });
  }

  try {
    const { bytes, mimeType } = await readAssessmentSheetBytes(sheet.imagePath);
    return new NextResponse(Uint8Array.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return sealedJson({ error: "File missing" }, { status: 404 });
  }
}
