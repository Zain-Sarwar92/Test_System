import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, resolveUserRole } from "@/lib/rbac";
import { assertOrgModule } from "@/lib/org-modules";
import { readAssessmentSheetBytes } from "@/lib/assessment-sheet-storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sheetId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveUserRole(session);
  if (role !== "ORG_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true, isActive: true },
  });
  if (!dbUser?.isActive || !dbUser.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await assertOrgModule(dbUser.organizationId, "RESULTS");

  const { sheetId } = await context.params;
  const sheet = await prisma.assessmentSheet.findFirst({
    where: { id: sheetId, assessment: { organizationId: dbUser.organizationId } },
    select: { imagePath: true },
  });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
