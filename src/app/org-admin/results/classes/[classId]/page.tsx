import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

const HUB_TONES = ["students", "teachers", "tests", "sections"] as const;

export default async function ResultClassSectionsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { classId } = await params;
  if (!organizationId) notFound();

  const klass = await prisma.class.findFirst({
    where: { id: classId, sections: { some: { organizationId } } },
    select: { id: true, name: true, board: { select: { name: true } } },
  });
  if (!klass) notFound();

  const sections = await prisma.section.findMany({
    where: { organizationId, classId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { students: true } },
    },
  });

  return (
    <PageStack wide>
      <PageHeader
        kicker={klass.board.name}
        title={`${klass.name} results`}
        actions={
          <ResultsBackLink href="/org-admin/results" />
        }
      />

      {sections.length === 0 ? (
        <Card>
          <CardTitle>No sections in this class</CardTitle>
          <CardDescription>Add a section before compiling results.</CardDescription>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((section, index) => (
            <Link
              key={section.id}
              href={`/org-admin/results/sections/${section.id}`}
              className={`org-dash-card tone-surface-${HUB_TONES[index % HUB_TONES.length]} chart-card p-5 transition-transform duration-300 hover:-translate-y-1`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="org-dash-card-label">Section</p>
                  <h3 className="org-dash-card-value mt-1 text-2xl">{section.name}</h3>
                </div>
                <span className={`org-dash-icon org-dash-icon-tone-${HUB_TONES[index % HUB_TONES.length]}`}>
                  <Users className="h-4 w-4" />
                </span>
              </div>
              <p className="org-dash-card-hint mt-4">
                {plural(section._count.students, "student")}
              </p>
              <p className="mt-3 text-sm font-medium text-brand">Open exams</p>
            </Link>
          ))}
        </div>
      )}
    </PageStack>
  );
}
