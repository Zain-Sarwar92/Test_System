import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, PageStack } from "@/components/page-header";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { studentGroupDisplay } from "@/lib/subject-stream";

export default async function StudentResultsSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const q = ((await searchParams).q ?? "").trim();
  if (!organizationId) {
    return (
      <PageStack>
        <PageHeader title="Student overall report" />
        <Card>
          <CardTitle>Organization missing</CardTitle>
          <CardDescription>
            This admin account is not linked to a school.
          </CardDescription>
        </Card>
      </PageStack>
    );
  }

  const students =
    q.length >= 1
      ? await prisma.student.findMany({
          where: {
            organizationId,
            isActive: true,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { rollNumber: { contains: q, mode: "insensitive" } },
              { fatherName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              {
                section: {
                  name: { contains: q, mode: "insensitive" },
                },
              },
              {
                section: {
                  class: { name: { contains: q, mode: "insensitive" } },
                },
              },
            ],
          },
          orderBy: [
            { section: { class: { name: "asc" } } },
            { section: { name: "asc" } },
            { rollNumber: "asc" },
          ],
          take: 40,
          select: {
            id: true,
            name: true,
            fatherName: true,
            rollNumber: true,
            phone: true,
            stream: true,
            studyGroup: true,
            section: {
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
            _count: {
              select: {
                marks: {
                  where: {
                    OR: [
                      { isAbsent: true },
                      { obtainedMarks: { not: null } },
                    ],
                  },
                },
              },
            },
          },
        })
      : [];

  return (
    <PageStack wide>
      <PageHeader
        kicker="Result compilation"
        title="Student overall report"
        description="Search by name, roll, father, phone, class, or section — then open every test that student has marks in."
        actions={<ResultsBackLink href="/org-admin/results" />}
      />

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-[1.25rem] border border-line bg-card p-4 shadow-[var(--shadow-soft)]"
      >
        <label className="min-w-[16rem] flex-1 space-y-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            Find student
          </span>
          <Input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="e.g. Ahmed, 9A01, Class 9, Section A…"
            autoFocus
          />
        </label>
        <Button type="submit" size="sm">
          Search
        </Button>
        {q ? (
          <Link href="/org-admin/results/students">
            <Button type="button" variant="outline" size="sm">
              Clear
            </Button>
          </Link>
        ) : null}
      </form>

      {!q ? (
        <Card>
          <div className="flex items-start gap-3">
            <span className="org-dash-icon org-dash-icon-tone-tests">
              <FileSearch className="h-4 w-4" />
            </span>
            <div>
              <CardTitle>Enter a student detail</CardTitle>
              <CardDescription>
                Overall report includes every exam where this student has
                entered marks — month-wise summary and per-test breakdown.
              </CardDescription>
            </div>
          </div>
        </Card>
      ) : students.length === 0 ? (
        <Card>
          <CardTitle>No students found</CardTitle>
          <CardDescription>
            Nothing matched “{q}”. Try roll number or a shorter name.
          </CardDescription>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[1.25rem] border border-line bg-card shadow-[var(--shadow-soft)]">
          <div className="border-b border-line px-4 py-3 text-sm text-muted">
            {students.length}
            {students.length >= 40 ? "+" : ""} match
            {students.length === 1 ? "" : "es"} for “{q}”
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-[rgba(15,40,70,0.03)] text-left">
                <th className="px-4 py-3 font-semibold text-muted">Roll</th>
                <th className="px-4 py-3 font-semibold text-muted">Student</th>
                <th className="px-4 py-3 font-semibold text-muted">Class</th>
                <th className="px-4 py-3 font-semibold text-muted">Group</th>
                <th className="px-4 py-3 font-semibold text-muted">Marks</th>
                <th className="px-4 py-3 font-semibold text-muted" />
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr
                  key={student.id}
                  className="border-b border-line last:border-0 hover:bg-[rgba(15,40,70,0.02)]"
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {student.rollNumber}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{student.name}</p>
                    <p className="text-xs text-muted">
                      Father {student.fatherName}
                      {student.phone ? ` · ${student.phone}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {student.section.class.name} · {student.section.name}
                    <p className="text-xs text-muted">
                      {student.section.class.board.name}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {studentGroupDisplay(student)}
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {student._count.marks > 0
                      ? `${student._count.marks} rows`
                      : "None yet"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/org-admin/results/students/${student.id}`}>
                      <Button size="sm">Overall report</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageStack>
  );
}
