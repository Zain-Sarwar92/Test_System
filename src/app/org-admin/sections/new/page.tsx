import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { SectionForm } from "../section-form";

export default async function NewSectionPage() {
  await requireRole(["ORG_ADMIN"]);

  const boards = await prisma.board.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      classes: {
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });

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
          <h2 className="page-title mt-1">Add Section</h2>
          <p className="page-subtitle mx-auto mt-1 max-w-sm">
            Enter section name(s), then choose board and class.
          </p>
          <div className="mt-3 flex justify-center">
            <Link href="/org-admin/sections">
              <Button variant="secondary" size="sm">
                Back to Sections
              </Button>
            </Link>
          </div>
        </div>

        <div className="fade-up w-full rounded-[1.25rem] border border-[rgba(15,40,70,0.1)] bg-white p-6 shadow-[0_10px_30px_rgba(15,40,70,0.06)] sm:p-8">
          {boards.length === 0 || classes.length === 0 ? (
            <p className="text-sm text-muted">
              No boards/classes in the curriculum yet. Ask Super Admin to add them
              first.
            </p>
          ) : (
            <SectionForm
              mode="create"
              boards={boards.map((board) => ({
                id: board.id,
                name: board.name,
              }))}
              classes={classes}
            />
          )}
        </div>
      </div>
    </PageStack>
  );
}
