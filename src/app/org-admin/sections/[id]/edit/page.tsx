import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { SectionForm } from "../../section-form";

export default async function EditSectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { id } = await params;

  if (!organizationId) {
    notFound();
  }

  const [section, boards] = await Promise.all([
    prisma.section.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        classId: true,
        class: { select: { boardId: true } },
      },
    }),
    prisma.board.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        classes: {
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  if (!section) {
    notFound();
  }

  const classes = boards.flatMap((board) =>
    board.classes.map((klass) => ({
      id: klass.id,
      name: klass.name,
      boardId: board.id,
      boardName: board.name,
    })),
  );

  return (
    <PageStack>
      <div className="mx-auto flex w-full max-w-lg flex-col items-center">
        <div className="mb-5 w-full text-center">
          <p className="page-kicker">Academic Setup</p>
          <h2 className="page-title mt-1">Edit Section</h2>
          <div className="mt-3 flex justify-center">
            <Link href="/org-admin/sections">
              <Button variant="secondary" size="sm">
                Back to Sections
              </Button>
            </Link>
          </div>
        </div>

        <div className="fade-up w-full rounded-[1.25rem] border border-[rgba(15,40,70,0.1)] bg-card p-6 shadow-[0_10px_30px_rgba(15,40,70,0.06)] sm:p-8">
          <SectionForm
            mode="edit"
            initial={{
              id: section.id,
              name: section.name,
              classId: section.classId,
              boardId: section.class.boardId,
            }}
            boards={boards.map((board) => ({
              id: board.id,
              name: board.name,
            }))}
            classes={classes}
          />
        </div>
      </div>
    </PageStack>
  );
}
