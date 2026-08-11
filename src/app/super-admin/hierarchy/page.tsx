import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { HierarchyManager } from "./hierarchy-manager";

export default async function HierarchyPage() {
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
                    include: {
                      _count: { select: { questions: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const payload = boards.map((board) => ({
    id: board.id,
    name: board.name,
    classes: board.classes.map((klass) => ({
      id: klass.id,
      name: klass.name,
      subjects: klass.subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        chapters: subject.chapters.map((chapter) => ({
          id: chapter.id,
          name: chapter.name,
          order: chapter.order,
          topics: chapter.topics.map((topic) => ({
            id: topic.id,
            name: topic.name,
            order: topic.order,
            questionCount: topic._count.questions,
          })),
        })),
      })),
    })),
  }));

  return (
    <PageStack>
      <PageHeader
        kicker="Curriculum"
        title="Board → Topic hierarchy"
        description="Manage boards, classes, subjects, chapters, and topics used across the global question bank."
      />
      <HierarchyManager boards={payload} />
    </PageStack>
  );
}
