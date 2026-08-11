import { PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole, requireActiveOrganizationId } from "@/lib/rbac";
import { SavedPapersTable } from "./saved-papers-table";

export default async function TeacherTestsPage() {
  const session = await requireRole(["TEACHER"]);
  const organizationId = await requireActiveOrganizationId(session.user.id);

  const tests = await prisma.test.findMany({
    where: {
      teacherId: session.user.id,
      organizationId,
    },
    orderBy: { createdAt: "desc" },
    include: {
      subject: {
        select: {
          name: true,
          class: { select: { name: true } },
        },
      },
      questions: { select: { question: { select: { type: true } } } },
      _count: { select: { questions: true } },
    },
  });

  function deriveTestType(questions: Array<{ question: { type: string } }>) {
    const types = new Set(questions.map((q) => q.question.type));
    if (types.size === 0) return "—";
    if (types.size === 1) {
      const t = [...types][0];
      if (t === "MCQ") return "MCQ Only";
      if (t === "SHORT") return "Short Only";
      if (t === "LONG") return "Long Only";
    }
    return "Mixed";
  }

  const papers = tests.map((test) => ({
    id: test.id,
    title: test.title,
    status: "FINAL" as const,
    classSection: test.classSection,
    className: test.subject?.class?.name ?? null,
    subjectName: test.subject?.name ?? null,
    testType: test.testType || deriveTestType(test.questions),
    examDate: test.examDate ? test.examDate.toISOString() : null,
    createdAt: test.createdAt.toISOString(),
    questionCount: test._count.questions,
    totalMarks: test.totalMarks,
    preparedBy: test.preparedBy,
  }));

  return (
    <PageStack wide>
      <SavedPapersTable papers={papers} />
    </PageStack>
  );
}
