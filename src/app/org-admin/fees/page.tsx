import Link from "next/link";
import { ChevronRight, GraduationCap, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, PageStack } from "@/components/page-header";
import { HubCrumb } from "@/components/hub-crumb";
import { ensureDefaultFeeHeads } from "@/lib/ensure-fee-heads";
import {
  feeHeadDueInPeriod,
  feeHeadFrequencyLabel,
  feeHeadMonthsLabel,
  ONE_TIME_PERIOD_KEY,
} from "@/lib/fee-head-rules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { FlashMessage } from "./components";
import { StudentFeeDesk } from "./student-fee-desk";

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function shiftPeriod(periodKey: string, monthsBack: number) {
  const [year, month] = periodKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - monthsBack, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatPeriodLabel(periodKey: string) {
  if (periodKey === ONE_TIME_PERIOD_KEY) return "One-time";
  const [year, month] = periodKey.split("-").map(Number);
  if (!year || !month) return periodKey;
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

function buildMonthHistory(input: {
  frequency: string;
  applicableMonths: number[];
  currentPeriod: string;
  /** YYYY-MM — months before this are not shown as unpaid. */
  enrolledFromPeriod: string;
  charges: Array<{
    periodKey: string;
    status: string;
    amount: { toFixed?: (n: number) => string } | string | number;
    allocations: Array<{ amount: { toString(): string } | number }>;
  }>;
}) {
  if (input.frequency === "ONE_TIME") {
    const charge = input.charges.find((c) => c.periodKey === ONE_TIME_PERIOD_KEY) ?? input.charges[0];
    const status =
      charge?.status === "PAID"
        ? ("paid" as const)
        : charge?.status === "PARTIAL"
          ? ("partial" as const)
          : ("unpaid" as const);
    return [
      {
        periodKey: ONE_TIME_PERIOD_KEY,
        label: "One-time",
        status,
        isCurrent: true,
      },
    ];
  }

  const byPeriod = new Map(input.charges.map((c) => [c.periodKey, c]));
  const rows = [];
  for (let i = 0; i < 6; i += 1) {
    const periodKey = shiftPeriod(input.currentPeriod, i);
    if (periodKey < input.enrolledFromPeriod) continue;

    const due = feeHeadDueInPeriod(
      {
        frequency: input.frequency as "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME",
        applicableMonths: input.applicableMonths,
      },
      periodKey,
    );
    const charge = byPeriod.get(periodKey);
    let status: "paid" | "partial" | "unpaid" | "not_due" = "unpaid";
    if (!due) status = "not_due";
    else if (charge?.status === "PAID") status = "paid";
    else if (charge?.status === "PARTIAL") status = "partial";
    else status = "unpaid";
    rows.push({
      periodKey,
      label: formatPeriodLabel(periodKey),
      status,
      isCurrent: i === 0,
    });
  }
  return rows;
}

const HUB_TONES = ["students", "teachers", "tests", "sections"] as const;
const HIDDEN_FEE_TYPES = new Set(["Monthly Tuition"]);

type Props = {
  searchParams: Promise<{
    classId?: string;
    sectionId?: string;
    feeName?: string;
    studentId?: string;
    q?: string;
    period?: string;
    view?: string;
    success?: string;
    error?: string;
  }>;
};

export default async function FeesHubPage({ searchParams }: Props) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");

  await ensureDefaultFeeHeads(organizationId);

  const filters = await searchParams;
  const query = filters.q?.trim() ?? "";
  const requestedClassId = filters.classId?.trim() ?? "";
  const requestedSectionId = filters.sectionId?.trim() ?? "";
  const requestedStudentId = filters.studentId?.trim() ?? "";
  const requestedFeeName = filters.feeName?.trim() ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod = today.slice(0, 7);
  const period =
    filters.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(filters.period)
      ? filters.period
      : currentPeriod;
  const view =
    filters.view === "paid" || filters.view === "pending" || filters.view === "all"
      ? filters.view
      : "all";

  const [sections, feeHeads] = await Promise.all([
    prisma.section.findMany({
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
    }),
    prisma.feeHead.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        frequency: true,
        applicableMonths: true,
        defaultAmount: true,
      },
    }),
  ]);

  const activeFeeHeads = feeHeads.filter((head) => !HIDDEN_FEE_TYPES.has(head.name));

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

  const requestedSection = requestedSectionId
    ? sections.find((section) => section.id === requestedSectionId)
    : undefined;
  const classId = requestedClassId || requestedSection?.class.id || "";
  const selectedClass = classes.find((klass) => klass.id === classId);
  const classSections = selectedClass
    ? sections.filter((section) => section.class.id === selectedClass.id)
    : [];
  const selectedSection = classSections.find((section) => section.id === requestedSectionId);
  const selectedFeeHead = selectedSection
    ? activeFeeHeads.find((head) => head.name === requestedFeeName)
    : undefined;
  const selectedFeeName = selectedFeeHead?.name ?? "";
  const feeDue = selectedFeeHead ? feeHeadDueInPeriod(selectedFeeHead, period) : true;

  const listReady = Boolean(selectedSection && selectedFeeHead);

  const [students, selectedStudent] = await Promise.all([
    listReady
      ? prisma.student.findMany({
          where: {
            organizationId,
            sectionId: selectedSection!.id,
            isActive: true,
            ...(query
              ? {
                  OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { rollNumber: { contains: query, mode: "insensitive" } },
                    { fatherName: { contains: query, mode: "insensitive" } },
                    { phone: { contains: query } },
                  ],
                }
              : {}),
          },
          orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            rollNumber: true,
            fatherName: true,
            feeCharges: {
              where: {
                organizationId,
                feeHeadId: selectedFeeHead!.id,
                ...(selectedFeeHead!.frequency === "ONE_TIME" ? {} : { periodKey: period }),
              },
              select: {
                status: true,
                amount: true,
                allocations: { select: { amount: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    selectedSection && requestedStudentId && selectedFeeHead
      ? prisma.student.findFirst({
          where: {
            id: requestedStudentId,
            organizationId,
            sectionId: selectedSection.id,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            rollNumber: true,
            fatherName: true,
            monthlyFee: true,
            createdAt: true,
            feeCharges: {
              where: {
                organizationId,
                feeHeadId: selectedFeeHead.id,
              },
              orderBy: { periodKey: "desc" },
              take: 24,
              select: {
                periodKey: true,
                status: true,
                amount: true,
                allocations: { select: { amount: true } },
              },
            },
            feePayments: {
              where: { organizationId },
              orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
              take: 12,
              select: {
                id: true,
                receiptNumber: true,
                amount: true,
                paidAt: true,
                method: true,
                allocations: {
                  select: {
                    charge: {
                      select: {
                        periodKey: true,
                        feeHead: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const studentsWithStatus = students.map((student) => {
    if (!feeDue) {
      return { ...student, paidTotal: 0, status: "not_due" as const };
    }
    const charge = student.feeCharges[0];
    const paidTotal = charge
      ? charge.allocations.reduce((sum, row) => sum + Number(row.amount), 0)
      : 0;

    const status: "pending" | "partial" | "paid" | "not_due" =
      charge?.status === "PAID"
        ? "paid"
        : charge?.status === "PARTIAL" || paidTotal > 0
          ? "partial"
          : "pending";

    return { ...student, paidTotal, status };
  });

  const visibleStudents = studentsWithStatus.filter((student) => {
    if (view === "all") return true;
    if (view === "paid") return student.status === "paid";
    return student.status === "pending" || student.status === "partial";
  });

  const pendingCount = studentsWithStatus.filter(
    (s) => s.status === "pending" || s.status === "partial",
  ).length;
  const paidCount = studentsWithStatus.filter((s) => s.status === "paid").length;

  const hubHref = (extra?: Record<string, string>) => {
    const params = new URLSearchParams({
      classId: selectedClass!.id,
      ...(selectedSection ? { sectionId: selectedSection.id } : {}),
      ...(selectedFeeName ? { feeName: selectedFeeName } : {}),
      period,
      view,
      ...extra,
    });
    return `/org-admin/fees?${params.toString()}`;
  };

  const defaultCollectAmount =
    selectedFeeName === "Monthly Fee"
      ? null
      : (selectedFeeHead?.defaultAmount?.toFixed(2) ?? null);

  const monthHistory =
    selectedStudent && selectedFeeHead
      ? buildMonthHistory({
          frequency: selectedFeeHead.frequency,
          applicableMonths: selectedFeeHead.applicableMonths,
          currentPeriod,
          enrolledFromPeriod: selectedStudent.createdAt.toISOString().slice(0, 7),
          charges: selectedStudent.feeCharges,
        })
      : [];

  return (
    <PageStack wide>
      <PageHeader
        kicker="Finance"
        title={
          selectedStudent
            ? selectedStudent.name
            : selectedFeeName
              ? selectedFeeName
              : selectedSection
                ? `${selectedClass?.name} · ${selectedSection.name}`
                : selectedClass
                  ? selectedClass.name
                  : "Fees"
        }
        description={
          selectedStudent
            ? `${selectedClass?.name} · ${selectedSection?.name} · ${selectedFeeName}`
            : selectedFeeName && selectedFeeHead
              ? `${selectedClass?.name} · ${selectedSection?.name} · ${feeHeadFrequencyLabel(selectedFeeHead.frequency)} · ${period}`
              : selectedSection
                ? ""
                : selectedClass
                  ? ``
                  : ""
        }
        actions={
          !selectedClass ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/org-admin/fees/collect">
                <Button size="sm">
                  <Receipt className="h-3.5 w-3.5" />
                  Collect fee
                </Button>
              </Link>
              <Link href="/org-admin/fees/pending">
                <Button size="sm" variant="secondary">
                  All pending
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />
      <FlashMessage success={filters.success} error={filters.error} />

      {!selectedClass && sections.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/org-admin/fees/collect"
            className="org-dash-card tone-surface-fees flex items-center justify-between gap-3 p-4 transition hover:-translate-y-0.5"
          >
            <div>
              <p className="org-dash-card-label">Quick pay</p>
              <h3 className="org-dash-card-value mt-1 text-xl">Collect fee</h3>
              <p className="org-dash-card-hint mt-1">
                Form open → student select → details side pe
              </p>
            </div>
            <span className="org-dash-icon org-dash-icon-tone-fees">
              <Receipt className="h-4 w-4" />
            </span>
          </Link>
          <Link
            href="/org-admin/fees/pending"
            className="org-dash-card tone-surface-tests flex items-center justify-between gap-3 p-4 transition hover:-translate-y-0.5"
          >
            <div>
              <p className="org-dash-card-label">Outstanding</p>
              <h3 className="org-dash-card-value mt-1 text-xl">All pending</h3>
              <p className="org-dash-card-hint mt-1">
                Monthly Fee, Test Dues, Admission — unpaid list
              </p>
            </div>
            <span className="org-dash-icon org-dash-icon-tone-tests">
              <Receipt className="h-4 w-4" />
            </span>
          </Link>
        </div>
      ) : null}
      {selectedClass ? (
        <HubCrumb>
          <Link href="/org-admin/fees" className="font-medium text-brand hover:underline">
            Classes
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted" />
          {selectedSection ? (
            <>
              <Link
                href={`/org-admin/fees?classId=${selectedClass.id}`}
                className="font-medium text-brand hover:underline"
              >
                {selectedClass.name}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-muted" />
              {selectedFeeName ? (
                <>
                  <Link
                    href={`/org-admin/fees?classId=${selectedClass.id}&sectionId=${selectedSection.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {selectedSection.name}
                  </Link>
                  <ChevronRight className="h-3.5 w-3.5 text-muted" />
                  {selectedStudent ? (
                    <>
                      <Link href={hubHref()} className="font-medium text-brand hover:underline">
                        {selectedFeeName}
                      </Link>
                      <ChevronRight className="h-3.5 w-3.5 text-muted" />
                      <span className="font-semibold text-ink">{selectedStudent.name}</span>
                    </>
                  ) : (
                    <span className="font-semibold text-ink">{selectedFeeName}</span>
                  )}
                </>
              ) : (
                <span className="font-semibold text-ink">{selectedSection.name}</span>
              )}
            </>
          ) : (
            <span className="font-semibold text-ink">{selectedClass.name}</span>
          )}
        </HubCrumb>
      ) : null}

      {!selectedClass ? (
        sections.length === 0 ? (
          <Card>
            <CardTitle>No classes with sections yet</CardTitle>
            <CardDescription>
              Create a section first, then manage fees under that class and section.
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
                href={`/org-admin/fees?classId=${klass.id}`}
                className={`org-dash-card tone-surface-${HUB_TONES[index % HUB_TONES.length]} chart-card p-5 transition-transform duration-300 hover:-translate-y-1`}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="org-dash-card-label">{klass.boardName}</p>
                    <h3 className="org-dash-card-value mt-1 text-2xl">{klass.name}</h3>
                  </div>
                  <span
                    className={`org-dash-icon org-dash-icon-tone-${HUB_TONES[index % HUB_TONES.length]}`}
                  >
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
        )
      ) : !selectedSection ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classSections.map((section, index) => (
            <Link
              key={section.id}
              href={`/org-admin/fees?classId=${selectedClass.id}&sectionId=${section.id}`}
              className={`org-dash-card tone-surface-${HUB_TONES[index % HUB_TONES.length]} chart-card p-5 transition-transform duration-300 hover:-translate-y-1`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="org-dash-card-label">Section</p>
                  <h3 className="org-dash-card-value mt-1 text-2xl">{section.name}</h3>
                </div>
                <span
                  className={`org-dash-icon org-dash-icon-tone-${HUB_TONES[index % HUB_TONES.length]}`}
                >
                  <Users className="h-4 w-4" />
                </span>
              </div>
              <p className="org-dash-card-hint mt-4">
                {plural(section._count.students, "student")}
              </p>
              <p className="mt-3 text-sm font-medium text-brand">
                Choose fee type
                <ChevronRight className="ml-0.5 inline h-4 w-4 align-text-bottom" />
              </p>
            </Link>
          ))}
          {!classSections.length ? (
            <Card>
              <CardTitle>No sections in this class</CardTitle>
              <CardDescription>Add a section before collecting fees here.</CardDescription>
            </Card>
          ) : null}
        </div>
      ) : !selectedFeeName ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeFeeHeads.map((head, index) => (
            <Link
              key={head.id}
              href={`/org-admin/fees?classId=${selectedClass.id}&sectionId=${selectedSection.id}&feeName=${encodeURIComponent(head.name)}&period=${period}&view=all`}
              className={`org-dash-card tone-surface-${HUB_TONES[index % HUB_TONES.length]} chart-card p-5 transition-transform duration-300 hover:-translate-y-1`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="org-dash-card-label">{feeHeadFrequencyLabel(head.frequency)}</p>
                  <h3 className="org-dash-card-value mt-1 text-2xl leading-tight">{head.name}</h3>
                </div>
                <span
                  className={`org-dash-icon org-dash-icon-tone-${HUB_TONES[index % HUB_TONES.length]}`}
                >
                  <Receipt className="h-4 w-4" />
                </span>
              </div>
              <p className="org-dash-card-hint mt-4">{feeHeadMonthsLabel(head.applicableMonths)}</p>
              <p className="mt-3 text-sm font-medium text-brand">
                Open student list
                <ChevronRight className="ml-0.5 inline h-4 w-4 align-text-bottom" />
              </p>
            </Link>
          ))}
        </div>
      ) : selectedStudent ? (
        <StudentFeeDesk
          student={{
            id: selectedStudent.id,
            name: selectedStudent.name,
            rollNumber: selectedStudent.rollNumber,
            fatherName: selectedStudent.fatherName,
            monthlyFee: selectedStudent.monthlyFee?.toFixed(2) ?? null,
          }}
          classId={selectedClass.id}
          sectionId={selectedSection.id}
          feeLabel={selectedFeeName}
          defaultAmount={defaultCollectAmount}
          feeDue={feeDue}
          frequencyLabel={feeHeadFrequencyLabel(selectedFeeHead!.frequency)}
          backHref={hubHref(query ? { q: query } : {})}
          today={today}
          currentPeriod={currentPeriod}
          monthHistory={monthHistory}
          payments={selectedStudent.feePayments.map((payment) => ({
            id: payment.id,
            receiptNumber: payment.receiptNumber,
            amount: payment.amount.toFixed(2),
            paidAt: payment.paidAt.toLocaleDateString("en-PK"),
            method: payment.method.replaceAll("_", " "),
            label:
              payment.allocations
                .map((row) => `${row.charge.feeHead.name} (${row.charge.periodKey})`)
                .join(", ") || "Fee",
          }))}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line p-4 md:p-5">
            <CardTitle>
              {selectedFeeName} · {period}
            </CardTitle>
            <CardDescription>
              {feeDue
                ? ""
                : `Is month ${selectedFeeName} due nahi (${feeHeadMonthsLabel(selectedFeeHead!.applicableMonths)}).`}
            </CardDescription>
            <form method="get" className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <input type="hidden" name="classId" value={selectedClass.id} />
              <input type="hidden" name="sectionId" value={selectedSection.id} />
              <input type="hidden" name="feeName" value={selectedFeeName} />
              <Input
                name="q"
                defaultValue={query}
                placeholder="Search name / roll / father / phone…"
              />
              <Input name="period" type="month" defaultValue={period} aria-label="Month" />
              <select
                name="view"
                defaultValue={view}
                className="field-control h-11 w-full"
                aria-label="Status"
              >
                <option value="pending">Pending ({pendingCount})</option>
                <option value="paid">Paid ({paidCount})</option>
                <option value="all">All ({studentsWithStatus.length})</option>
              </select>
              <Button type="submit" variant="secondary">
                Apply
              </Button>
            </form>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="status-chip">Pending / partial: {pendingCount}</span>
                <span className="status-chip status-chip-ok">Paid: {paidCount}</span>
              </div>
              <Link
                href={`/org-admin/fees/pending-print?sectionId=${selectedSection.id}&period=${period}&feeName=${encodeURIComponent(selectedFeeName)}`}
              >
                <Button size="sm" variant="outline">
                  Print pending list
                </Button>
              </Link>
            </div>
          </div>
          <div className="divide-y divide-line">
            {visibleStudents.map((student) => (
              <Link
                key={student.id}
                href={hubHref({
                  studentId: student.id,
                  ...(query ? { q: query } : {}),
                })}
                className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-mist/40 md:px-5"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{student.name}</p>
                  <p className="truncate text-xs text-muted">
                    Roll {student.rollNumber} · Father: {student.fatherName}
                  </p>
                </div>
                <span
                  className={
                    student.status === "paid" || student.status === "not_due"
                      ? "shrink-0 text-sm font-semibold text-muted"
                      : "shrink-0 text-sm font-semibold text-brand"
                  }
                >
                  {student.status === "paid"
                    ? "Paid"
                    : student.status === "not_due"
                      ? "Not due"
                      : "Take fee →"}
                </span>
              </Link>
            ))}
            {!visibleStudents.length ? (
              <p className="px-5 py-10 text-center text-sm text-muted">
                {query
                  ? "No students match this search."
                  : view === "pending"
                    ? `Is month (${period}) is type pe koi pending student nahi.`
                    : view === "paid"
                      ? `Is month is type pe abhi koi paid student nahi.`
                      : (
                        <>
                          Is section mein student nahi.{" "}
                          <Link
                            href={`/org-admin/students/new?sectionId=${selectedSection.id}`}
                            className="font-semibold text-brand hover:underline"
                          >
                            Add student
                          </Link>
                        </>
                      )}
              </p>
            ) : null}
          </div>
        </Card>
      )}
    </PageStack>
  );
}
