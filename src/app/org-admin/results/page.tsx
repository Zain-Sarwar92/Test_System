import Link from "next/link";
import { ChevronRight, FileSearch, GraduationCap } from "lucide-react";
import { PageHeader, PageStack } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

const HUB_TONES = ["students", "teachers", "tests", "sections"] as const;

export default async function ResultsClassesPage() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;

  const sections = organizationId
    ? await prisma.section.findMany({
        where: { organizationId },
        orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          class: {
            select: { id: true, name: true, board: { select: { name: true } } },
          },
          _count: { select: { students: true } },
        },
      })
    : [];

  const classes = [
    ...new Map(
      sections.map((section) => [
        section.class.id,
        {
          id: section.class.id,
          name: section.class.name,
          boardName: section.class.board.name,
          sectionCount: 0,
          studentCount: 0,
        },
      ]),
    ).values(),
  ]
    .map((klass) => {
      const classSections = sections.filter((section) => section.class.id === klass.id);
      return {
        ...klass,
        sectionCount: classSections.length,
        studentCount: classSections.reduce(
          (sum, section) => sum + section._count.students,
          0,
        ),
      };
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) ||
        a.boardName.localeCompare(b.boardName),
    );

  return (
    <PageStack wide>
      <PageHeader
        kicker="Academics"
        title="Result compilation"
        actions={
          <Link href="/org-admin/results/students">
            <Button size="sm">
              <FileSearch className="mr-1.5 h-4 w-4" />
              Student overall report
            </Button>
          </Link>
        }
      />

      <Link
        href="/org-admin/results/students"
        className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-line bg-card px-5 py-4 shadow-[var(--shadow-soft)] transition-colors hover:bg-[rgba(15,40,70,0.02)]"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="org-dash-icon org-dash-icon-tone-tests shrink-0">
            <FileSearch className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-ink">
              Find a student report
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Search name, roll, class, or section — open every test that
              student appeared in.
            </p>
          </div>
        </div>
        <span className="text-sm font-medium text-brand">
          Search
          <ChevronRight className="ml-0.5 inline h-4 w-4 align-text-bottom" />
        </span>
      </Link>

      {classes.length === 0 ? (
        <Card>
          <CardTitle>No sections yet</CardTitle>
          <CardDescription>
            Create a section first, then add students before compiling results.
          </CardDescription>
          <Link href="/org-admin/sections/new" className="mt-4 inline-block">
            <Button size="sm">Add Section</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((klass, index) => (
            <Link
              key={klass.id}
              href={`/org-admin/results/classes/${klass.id}`}
              className={`org-dash-card tone-surface-${HUB_TONES[index % HUB_TONES.length]} chart-card p-5 transition-transform duration-300 hover:-translate-y-1`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="org-dash-card-label">{klass.boardName}</p>
                  <h3 className="org-dash-card-value mt-1 text-2xl">{klass.name}</h3>
                </div>
                <span className={`org-dash-icon org-dash-icon-tone-${HUB_TONES[index % HUB_TONES.length]}`}>
                  <GraduationCap className="h-4 w-4" />
                </span>
              </div>
              <p className="org-dash-card-hint mt-4">
                {plural(klass.sectionCount, "section")} · {plural(klass.studentCount, "student")}
              </p>
              <p className="mt-3 text-sm font-medium text-brand">
                View sections
                <ChevronRight className="ml-0.5 inline h-4 w-4 align-text-bottom" />
              </p>
            </Link>
          ))}
        </div>
      )}
    </PageStack>
  );
}
