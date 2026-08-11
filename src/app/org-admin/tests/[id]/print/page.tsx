import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { ExamPaperSheet, type ExamPaperSection } from "@/components/exam-paper-sheet";
import { PrintToolbar } from "@/app/teacher/tests/[id]/print/print-toolbar";

export default async function OrgAdminTestPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId as string;
  const { id } = await params;

  const test = await prisma.test.findFirst({
    where: { id, organizationId },
    include: {
      teacher: { select: { name: true } },
      organization: {
        select: {
          name: true,
          logoUrl: true,
          address: true,
          phone: true,
        },
      },
      subject: {
        select: {
          name: true,
          class: {
            select: {
              name: true,
              board: { select: { name: true } },
            },
          },
        },
      },
      questions: {
        orderBy: { order: "asc" },
        include: { question: true },
      },
    },
  });

  if (!test) notFound();

  const grouped = new Map<string, typeof test.questions>();
  for (const row of test.questions) {
    const type = row.question.type;
    const list = grouped.get(type) ?? [];
    list.push(row);
    grouped.set(type, list);
  }

  const order = ["MCQ", "SHORT", "LONG"] as const;
  const titles = {
    MCQ: "Multiple Choice Questions",
    SHORT: "Short Questions",
    LONG: "Long Questions",
  };

  const sections: ExamPaperSection[] = order
    .filter((t) => grouped.has(t))
    .map((type) => {
      const rows = grouped.get(type)!;
      const marksEach = rows[0]?.marks ?? 1;
      return {
        type,
        title: titles[type],
        marksEach,
        questions: rows.map((r) => ({
          id: r.question.id,
          text: r.question.text,
          textUrdu: r.question.textUrdu,
          optionA: r.question.optionA,
          optionB: r.question.optionB,
          optionC: r.question.optionC,
          optionD: r.question.optionD,
        })),
      };
    });

  return (
    <div className="print-page">
      <PrintToolbar
        backHref={`/org-admin/tests`}
        listHref="/org-admin/tests"
      />
      <ExamPaperSheet
        meta={{
          title: test.title,
          boardName: test.subject?.class?.board?.name,
          className: test.subject?.class?.name,
          subjectName: test.subject?.name,
          classSection: test.classSection,
          examDate: test.examDate?.toISOString() ?? null,
          durationMinutes: test.durationMinutes,
          totalMarks: test.totalMarks,
          preparedBy: test.preparedBy ?? test.teacher.name,
          instructions: test.instructions,
          paperCode: test.paperCode,
          examLabel: test.examLabel,
          syllabusNote: test.syllabusNote,
          organization: test.organization,
        }}
        sections={sections}
        medium="BOTH"
      />
      <p className="print-screen-hint no-print">
        Tip: In the browser print dialog, choose "Save as PDF" to export a PDF.{" "}
        <Link href="/org-admin/tests" className="text-brand underline">
          Back to tests
        </Link>
      </p>
    </div>
  );
}
