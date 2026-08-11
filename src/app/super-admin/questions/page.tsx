import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { AddQuestionForm } from "./add-question-form";

export default async function SuperAdminQuestionsPage() {
  await requireRole(["SUPER_ADMIN"]);

  const boards = await prisma.board.findMany({
    orderBy: { name: "asc" },
    include: {
      classes: {
        orderBy: { name: "asc" },
        include: {
          subjects: {
            orderBy: { name: "asc" },
            include: {
              chapters: {
                orderBy: [{ order: "asc" }, { name: "asc" }],
                include: {
                  topics: {
                    orderBy: [{ order: "asc" }, { name: "asc" }],
                    select: { id: true, name: true, order: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return <AddQuestionForm boards={boards} />;
}
