"use client";

import { useMemo, useState } from "react";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { formatPkr } from "@/lib/fee-format";
import { submitStudentFee } from "../actions";

export type QuickCollectDue = {
  feeName: string;
  periodKey: string;
  periodLabel: string;
  status: "Unpaid" | "Partial";
  due: number;
};

export type QuickCollectStudent = {
  id: string;
  name: string;
  fatherName: string;
  rollNumber: string;
  phone: string;
  monthlyFee: string | null;
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  boardName: string;
  pendingDues: QuickCollectDue[];
};

export type QuickCollectClass = {
  id: string;
  name: string;
  boardName: string;
};

export type QuickCollectSection = {
  id: string;
  name: string;
  classId: string;
  className: string;
};

export type QuickCollectFeeHead = {
  name: string;
  defaultAmount: string | null;
  frequency: string;
};

export function QuickCollectForm({
  students = [],
  classes = [],
  sections = [],
  feeHeads = [],
  today,
  currentPeriod,
  initialStudentId = "",
}: {
  students?: QuickCollectStudent[];
  classes?: QuickCollectClass[];
  sections?: QuickCollectSection[];
  feeHeads?: QuickCollectFeeHead[];
  today: string;
  currentPeriod: string;
  initialStudentId?: string;
}) {
  const defaultFee =
    feeHeads.find((h) => h.name === "Monthly Fee")?.name ?? feeHeads[0]?.name ?? "";

  const initial = initialStudentId
    ? students.find((s) => s.id === initialStudentId)
    : undefined;

  const [rollNumber, setRollNumber] = useState(initial?.rollNumber ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [fatherName, setFatherName] = useState(initial?.fatherName ?? "");
  const [classId, setClassId] = useState(initial?.classId ?? "");
  const [sectionId, setSectionId] = useState(initial?.sectionId ?? "");
  const [studentId, setStudentId] = useState(initial?.id ?? "");
  const [lookupError, setLookupError] = useState("");
  const [feeLabel, setFeeLabel] = useState(defaultFee);
  const [amount, setAmount] = useState(() => {
    if (defaultFee === "Monthly Fee" && initial?.monthlyFee) return initial.monthlyFee;
    return feeHeads.find((h) => h.name === defaultFee)?.defaultAmount ?? "";
  });
  const [periodKey, setPeriodKey] = useState(currentPeriod);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const student = studentId ? byId.get(studentId) : undefined;

  const classOptions = useMemo(
    () =>
      classes.map((klass) => ({
        value: klass.id,
        label: klass.name,
        hint: klass.boardName,
      })),
    [classes],
  );

  const sectionOptions = useMemo(
    () =>
      sections
        .filter((section) => Boolean(classId) && section.classId === classId)
        .map((section) => ({
          value: section.id,
          label: section.name,
          hint: section.className,
        })),
    [sections, classId],
  );

  const feeOptions = useMemo(
    () =>
      feeHeads.map((head) => ({
        value: head.name,
        label: head.name,
        hint: head.frequency,
      })),
    [feeHeads],
  );

  function fillAmount(next: QuickCollectStudent | undefined, fee: string) {
    if (fee === "Monthly Fee" && next?.monthlyFee) {
      setAmount(next.monthlyFee);
      return;
    }
    setAmount(feeHeads.find((h) => h.name === fee)?.defaultAmount ?? "");
  }

  function clearIdentity(keepRoll = true) {
    setStudentId("");
    if (!keepRoll) setRollNumber("");
    setName("");
    setFatherName("");
  }

  function applyStudent(next: QuickCollectStudent | undefined, fee = feeLabel) {
    if (!next) {
      clearIdentity(true);
      return;
    }
    setStudentId(next.id);
    setRollNumber(next.rollNumber);
    setName(next.name);
    setFatherName(next.fatherName);
    setClassId(next.classId);
    setSectionId(next.sectionId);
    setLookupError("");
    fillAmount(next, fee);
  }

  function lookupByRoll(
    rawRoll: string,
    selectedClassId: string,
    selectedSectionId: string,
  ) {
    const roll = rawRoll.trim();
    if (!roll) {
      clearIdentity(true);
      setLookupError("");
      return;
    }

    let pool = students;
    if (selectedSectionId) {
      pool = students.filter((s) => s.sectionId === selectedSectionId);
    } else if (selectedClassId) {
      pool = students.filter((s) => s.classId === selectedClassId);
    }

    const matches = pool.filter(
      (s) => s.rollNumber.toLowerCase() === roll.toLowerCase(),
    );

    if (matches.length === 1) {
      applyStudent(matches[0]);
      return;
    }
    if (matches.length > 1) {
      clearIdentity(true);
      setLookupError("Same roll kai jagah — Class / Section select karo.");
      return;
    }
    clearIdentity(true);
    setLookupError(
      selectedSectionId || selectedClassId
        ? "Is Class / Section mein ye roll nahi mila."
        : "Roll number nahi mila.",
    );
  }

  function onRollChange(value: string) {
    setRollNumber(value);
    lookupByRoll(value, classId, sectionId);
  }

  function onClassChange(nextClassId: string) {
    setClassId(nextClassId);
    const nextSectionStillValid = sections.some(
      (section) => section.id === sectionId && section.classId === nextClassId,
    );
    const nextSectionId = nextSectionStillValid ? sectionId : "";
    if (!nextSectionStillValid) setSectionId("");
    if (rollNumber.trim()) {
      lookupByRoll(rollNumber, nextClassId, nextSectionId);
    } else {
      clearIdentity(true);
      setLookupError("");
    }
  }

  function onSectionChange(nextSectionId: string) {
    setSectionId(nextSectionId);
    const section = sections.find((row) => row.id === nextSectionId);
    if (section) setClassId(section.classId);
    if (rollNumber.trim()) {
      lookupByRoll(rollNumber, section?.classId ?? classId, nextSectionId);
    } else {
      clearIdentity(true);
      setLookupError("");
    }
  }

  function pickFee(nameValue: string) {
    setFeeLabel(nameValue);
    fillAmount(student, nameValue);
  }

  function useDue(due: QuickCollectDue) {
    setFeeLabel(due.feeName);
    setPeriodKey(due.periodKey === "ONCE" ? currentPeriod : due.periodKey);
    setAmount(String(due.due));
  }

  const pendingTotal =
    student?.pendingDues?.reduce((sum, row) => sum + row.due, 0) ?? 0;

  return (
    <div className="fade-up grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[1.25rem] border border-line bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="org-dash-icon org-dash-icon-tone-fees shrink-0">
            <Banknote className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Collect fee</h3>
            <p className="mt-1 text-sm text-muted">
              Roll pehle — name / father / class / section autofill.
            </p>
          </div>
        </div>

        <form action={submitStudentFee} className="mt-6 space-y-5">
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="feeLabel" value={feeLabel} />
          <input type="hidden" name="returnTo" value="/org-admin/fees/collect" />
          {student ? (
            <>
              <input type="hidden" name="returnClassId" value={student.classId} />
              <input type="hidden" name="returnSectionId" value={student.sectionId} />
              <input type="hidden" name="returnFeeName" value={feeLabel} />
            </>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Roll number *
              </span>
              <Input
                value={rollNumber}
                onChange={(event) => onRollChange(event.target.value)}
                placeholder="e.g. 901"
                autoFocus
                className="h-11"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Name
              </span>
              <Input value={name} readOnly placeholder="Autofill" className="h-11 bg-mist/40" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Father name
              </span>
              <Input
                value={fatherName}
                readOnly
                placeholder="Autofill"
                className="h-11 bg-mist/40"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Class
              </span>
              <SearchSelect
                value={classId}
                options={classOptions}
                onChange={onClassChange}
                placeholder="Select class"
                searchPlaceholder="Search class…"
                emptyText="No class found"
                ariaLabel="Class"
                className="h-11 w-full"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Section
              </span>
              <SearchSelect
                value={sectionId}
                options={sectionOptions}
                onChange={onSectionChange}
                placeholder={classId ? "Select section" : "Pehle class select karo"}
                searchPlaceholder="Search section…"
                emptyText={classId ? "No section in this class" : "Select a class first"}
                disabled={!classId}
                ariaLabel="Section"
                className="h-11 w-full"
              />
            </label>
          </div>

          {lookupError ? (
            <p className="rounded-lg border border-line bg-mist/50 px-3 py-2 text-sm text-ink">
              {lookupError}
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Fee type *
            </span>
            <SearchSelect
              value={feeLabel}
              options={feeOptions}
              onChange={pickFee}
              placeholder="Select fee type"
              searchPlaceholder="Search fee…"
              emptyText="No fee type"
              ariaLabel="Fee type"
              className="h-11 w-full"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Amount (PKR) *
            </span>
            <Input
              name="amount"
              required
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-14 text-2xl font-semibold tracking-tight"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Month *
              </span>
              <Input
                name="periodKey"
                type="month"
                required
                value={periodKey}
                onChange={(event) => setPeriodKey(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Date *
              </span>
              <Input name="paidAt" type="date" required defaultValue={today} />
            </label>
            <MethodField />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Note
            </span>
            <Input name="note" maxLength={500} placeholder="Optional" />
          </label>

          <Button type="submit" className="w-full" disabled={!studentId || !feeLabel}>
            Submit fee
          </Button>
        </form>
      </section>

      <aside className="org-dash-card tone-surface-fees flex flex-col p-5 sm:p-6">
        {!student ? (
          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <p className="org-dash-card-label">Dues panel</p>
            <p className="mt-3 max-w-xs text-sm text-muted">
              Roll number enter karo — yahan student aur pending dues dikhengi.
            </p>
          </div>
        ) : (
          <>
            <p className="org-dash-card-label">Student</p>
            <h2 className="org-dash-card-value mt-1 text-3xl leading-tight">{student.name}</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2">
                <dt className="text-muted">Roll</dt>
                <dd className="font-semibold text-ink">{student.rollNumber}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2">
                <dt className="text-muted">Father</dt>
                <dd className="text-right font-semibold text-ink">{student.fatherName}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2">
                <dt className="text-muted">Phone</dt>
                <dd className="font-semibold text-ink">{student.phone || "—"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2">
                <dt className="text-muted">Class / Sec</dt>
                <dd className="text-right font-semibold text-ink">
                  {student.className} · {student.sectionName}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2">
                <dt className="text-muted">Monthly fee</dt>
                <dd className="font-semibold text-ink">
                  {student.monthlyFee ? formatPkr(student.monthlyFee) : "Not set"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Total pending</dt>
                <dd className="font-semibold text-ink">
                  {pendingTotal > 0 ? formatPkr(pendingTotal) : "Clear"}
                </dd>
              </div>
            </dl>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Pending dues
              </p>
              {!(student.pendingDues?.length) ? (
                <p className="mt-2 text-sm text-muted">Is student pe koi unpaid charge nahi.</p>
              ) : (
                <ul className="mt-3 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                  {student.pendingDues.map((due) => (
                    <li key={`${due.feeName}:${due.periodKey}`}>
                      <button
                        type="button"
                        onClick={() => useDue(due)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-card/80 px-3 py-2.5 text-left transition hover:border-brand/40"
                      >
                        <span>
                          <span className="block text-sm font-semibold text-ink">
                            {due.feeName}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {due.periodLabel} · {due.status}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-brand">
                          {formatPkr(due.due)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {(student.pendingDues?.length ?? 0) > 0 ? (
                <p className="mt-2 text-xs text-muted">
                  Due pe click → fee type / month / amount form mein fill.
                </p>
              ) : null}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function MethodField() {
  const [method, setMethod] = useState("CASH");
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        Method *
      </span>
      <input type="hidden" name="method" value={method} />
      <SearchSelect
        value={method}
        options={[
          { value: "CASH", label: "Cash" },
          { value: "BANK_TRANSFER", label: "Bank transfer" },
          { value: "CARD", label: "Card" },
          { value: "OTHER", label: "Other" },
        ]}
        onChange={setMethod}
        placeholder="Method"
        ariaLabel="Method"
        className="h-11 w-full"
      />
    </label>
  );
}
