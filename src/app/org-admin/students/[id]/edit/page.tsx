import { notFound } from "next/navigation";
import { PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { StudentForm } from "../../student-form";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { id } = await params;
  if (!organizationId) notFound();

  const [student, sectionRows, fieldRows, subjectRows] = await Promise.all([
    prisma.student.findFirst({
      where: { id, organizationId },
      include: {
        customValues: { select: { fieldId: true, value: true } },
        electiveChoices: { select: { subjectId: true } },
      },
    }),
    prisma.section.findMany({
      where: { organizationId },
      orderBy: [
        { class: { board: { name: "asc" } } },
        { class: { name: "asc" } },
        { name: "asc" },
      ],
      select: {
        id: true,
        name: true,
        class: {
          select: {
            id: true,
            name: true,
            board: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.studentFieldDefinition.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    prisma.subject.findMany({
      where: {
        class: { sections: { some: { organizationId } } },
      },
      select: {
        id: true,
        name: true,
        classId: true,
        track: true,
        electiveGroup: true,
      },
    }),
  ]);
  if (!student) notFound();

  return (
    <PageStack>
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5 text-center">
          <p className="page-kicker">Students</p>
          <h2 className="page-title mt-1">Edit Student</h2>
          <p className="page-subtitle mt-1">{student.name}</p>
        </div>
        <div className="fade-up rounded-[1.25rem] border border-[rgba(15,40,70,0.1)] bg-white p-6 shadow-[0_10px_30px_rgba(15,40,70,0.06)] sm:p-8">
          <StudentForm
            sections={sectionRows.map((section) => ({
              id: section.id,
              name: section.name,
              classId: section.class.id,
              className: section.class.name,
              boardId: section.class.board.id,
              boardName: section.class.board.name,
            }))}
            classSubjects={subjectRows}
            fields={fieldRows.map((field) => ({
              id: field.id,
              label: field.label,
              type: field.type,
              options: Array.isArray(field.options)
                ? field.options.filter(
                    (option): option is string => typeof option === "string",
                  )
                : [],
              isRequired: field.isRequired,
            }))}
            initial={{
              id: student.id,
              rollNumber: student.rollNumber,
              name: student.name,
              fatherName: student.fatherName,
              phone: student.phone,
              sectionId: student.sectionId,
              stream: student.stream,
              studyGroup: student.studyGroup,
              electiveSubjectId: student.electiveSubjectId,
              electiveChoiceIds: student.electiveChoices.map((row) => row.subjectId),
              values: Object.fromEntries(
                student.customValues.map((value) => [value.fieldId, value.value]),
              ),
            }}
          />
        </div>
      </div>
    </PageStack>
  );
}
