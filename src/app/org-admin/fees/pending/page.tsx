import Link from "next/link";
import { ChevronRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { ensureDefaultFeeHeads } from "@/lib/ensure-fee-heads";
import { formatPkr } from "@/lib/fee-format";
import { ONE_TIME_PERIOD_KEY } from "@/lib/fee-head-rules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function formatPeriodLabel(periodKey: string) {
  if (periodKey === ONE_TIME_PERIOD_KEY) return "One-time";
  const [year, month] = periodKey.split("-").map(Number);
  if (!year || !month) return periodKey;
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

type Props = {
  searchParams: Promise<{
    feeName?: string;
    classId?: string;
    sectionId?: string;
    q?: string;
  }>;
};

export default async function AllPendingFeesPage({ searchParams }: Props) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");

  await ensureDefaultFeeHeads(organizationId);
  const filters = await searchParams;
  const feeName = (filters.feeName ?? "").trim();
  const classId = (filters.classId ?? "").trim();
  const sectionId = (filters.sectionId ?? "").trim();
  const q = (filters.q ?? "").trim();

  const [feeHeads, classes, sections, charges] = await Promise.all([
    prisma.feeHead.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.class.findMany({
      where: { sections: { some: { organizationId } } },
      orderBy: [{ board: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.section.findMany({
      where: {
        organizationId,
        ...(classId ? { classId } : {}),
      },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        classId: true,
        class: { select: { name: true } },
      },
    }),
    prisma.feeCharge.findMany({
      where: {
        organizationId,
        status: { in: ["UNPAID", "PARTIAL"] },
        student: {
          isActive: true,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { rollNumber: { contains: q, mode: "insensitive" } },
                  { fatherName: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(sectionId
            ? { sectionId }
            : classId
              ? { section: { classId } }
              : {}),
        },
        ...(feeName ? { feeHead: { name: feeName } } : {}),
      },
      orderBy: [{ periodKey: "asc" }, { student: { rollNumber: "asc" } }],
      select: {
        id: true,
        periodKey: true,
        amount: true,
        status: true,
        feeHead: { select: { name: true } },
        allocations: { select: { amount: true } },
        student: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
            fatherName: true,
            sectionId: true,
            section: {
              select: {
                id: true,
                name: true,
                classId: true,
                class: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      take: 500,
    }),
  ]);

  const rows = charges.map((charge) => {
    const paid = charge.allocations.reduce((sum, row) => sum + Number(row.amount), 0);
    const due = Math.max(Number(charge.amount) - paid, 0);
    return {
      ...charge,
      paid,
      due,
      collectHref: `/org-admin/fees?classId=${charge.student.section.classId}&sectionId=${charge.student.sectionId}&feeName=${encodeURIComponent(charge.feeHead.name)}&period=${charge.periodKey === ONE_TIME_PERIOD_KEY ? new Date().toISOString().slice(0, 7) : charge.periodKey}&view=pending&studentId=${charge.student.id}`,
    };
  });

  const totalDue = rows.reduce((sum, row) => sum + row.due, 0);
  const byFee = new Map<string, { count: number; due: number }>();
  for (const row of rows) {
    const key = row.feeHead.name;
    const prev = byFee.get(key) ?? { count: 0, due: 0 };
    byFee.set(key, { count: prev.count + 1, due: prev.due + row.due });
  }

  const href = (extra?: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = {
      feeName: feeName || undefined,
      classId: classId || undefined,
      sectionId: sectionId || undefined,
      q: q || undefined,
      ...extra,
    };
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `/org-admin/fees/pending?${qs}` : "/org-admin/fees/pending";
  };

  const printHref = (() => {
    const params = new URLSearchParams();
    if (feeName) params.set("feeName", feeName);
    if (classId) params.set("classId", classId);
    if (sectionId) params.set("sectionId", sectionId);
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs ? `/org-admin/fees/pending/print?${qs}` : "/org-admin/fees/pending/print";
  })();

  return (
    <PageStack wide>
      <PageHeader
        kicker="Finance"
        title="All pending fees"
        description=""
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {rows.length > 0 ? (
              <Link href={printHref} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="secondary">
                  <Printer className="h-3.5 w-3.5" />
                  Print unpaid list
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="secondary" disabled>
                <Printer className="h-3.5 w-3.5" />
                Print unpaid list
              </Button>
            )}
            <Link href="/org-admin/fees" className="text-sm font-semibold text-brand hover:underline">
              ← Fees hub
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="org-dash-card tone-surface-fees p-4">
          <p className="org-dash-card-label">Pending rows</p>
          <p className="org-dash-card-value mt-1 text-2xl">{rows.length}</p>
        </div>
        <div className="org-dash-card tone-surface-students p-4">
          <p className="org-dash-card-label">Total outstanding</p>
          <p className="org-dash-card-value mt-1 text-2xl">{formatPkr(totalDue)}</p>
        </div>
        {[...byFee.entries()].slice(0, 2).map(([name, stats]) => (
          <div key={name} className="org-dash-card tone-surface-tests p-4">
            <p className="org-dash-card-label">{name}</p>
            <p className="org-dash-card-value mt-1 text-2xl">{stats.count}</p>
            <p className="org-dash-card-hint mt-1">{formatPkr(stats.due)}</p>
          </div>
        ))}
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-[1.15rem] border border-line bg-card p-4"
      >
        <label className="min-w-[10rem] flex-1">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Fee type
          </span>
          <select name="feeName" defaultValue={feeName} className="field-control h-11 w-full">
            <option value="">All types</option>
            {feeHeads.map((head) => (
              <option key={head.id} value={head.name}>
                {head.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[10rem] flex-1">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Class
          </span>
          <select name="classId" defaultValue={classId} className="field-control h-11 w-full">
            <option value="">All classes</option>
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[10rem] flex-1">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Section
          </span>
          <select name="sectionId" defaultValue={sectionId} className="field-control h-11 w-full">
            <option value="">All sections</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.class.name} · {section.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-[1.2]">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Search student
          </span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Name / roll / father"
            className="field-control h-11 w-full"
          />
        </label>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {(feeName || classId || sectionId || q) && (
          <Link href="/org-admin/fees/pending" className="text-sm font-semibold text-muted hover:text-brand">
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <Card>
          <CardTitle>No pending dues</CardTitle>
          <CardDescription>
            Is filter pe koi unpaid / partial charge nahi. Test Dues tab dikhengi jab unke
            charges banenge (collect ya generate).
          </CardDescription>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[1.15rem] border border-line bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-mist/40 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Student</th>
                <th className="px-3 py-2.5 font-semibold">Class / Sec</th>
                <th className="px-3 py-2.5 font-semibold">Fee</th>
                <th className="px-3 py-2.5 font-semibold">Period</th>
                <th className="px-3 py-2.5 font-semibold">Due</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line/70 last:border-0">
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-ink">{row.student.name}</p>
                    <p className="text-xs text-muted">
                      Roll {row.student.rollNumber} · {row.student.fatherName}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">
                    {row.student.section.class.name} · {row.student.section.name}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-ink">{row.feeHead.name}</td>
                  <td className="px-3 py-2.5">{formatPeriodLabel(row.periodKey)}</td>
                  <td className="px-3 py-2.5 font-semibold text-ink">{formatPkr(row.due)}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={
                        row.status === "PARTIAL" ? "status-chip-warn" : "status-chip"
                      }
                    >
                      {row.status === "PARTIAL" ? "Partial" : "Unpaid"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={row.collectHref}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
                    >
                      Collect
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {charges.length >= 500 ? (
            <p className="border-t border-line px-3 py-2 text-xs text-muted">
              Showing first 500 rows — filters se narrow karein.
            </p>
          ) : null}
        </div>
      )}

      {[...byFee.entries()].length > 2 ? (
        <div className="flex flex-wrap gap-2">
          {[...byFee.entries()].map(([name, stats]) => (
            <Link
              key={name}
              href={href({ feeName: name, classId: classId || undefined, sectionId: undefined })}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/40 hover:text-brand"
            >
              {name}: {stats.count} · {formatPkr(stats.due)}
            </Link>
          ))}
        </div>
      ) : null}
    </PageStack>
  );
}
