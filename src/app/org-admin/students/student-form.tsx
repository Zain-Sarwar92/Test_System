"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSearchSelect } from "@/components/ui/multi-search-select";
import { SearchSelect } from "@/components/ui/search-select";
import { createStudent, getNextRollNumber, updateStudent } from "./actions";
import { electiveOptionsForClass, type StudentStream } from "@/lib/subject-stream";

type Field = {
  id: string;
  label: string;
  type: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";
  options: string[];
  isRequired: boolean;
};

type Section = {
  id: string;
  name: string;
  classId: string;
  className: string;
  boardId: string;
  boardName: string;
};

type ClassSubject = {
  id: string;
  name: string;
  classId: string;
  track?: "COMMON" | "SCIENCE" | "ARTS" | null;
  electiveGroup?: string | null;
};

type InitialStudent = {
  id: string;
  rollNumber: string;
  name: string;
  fatherName: string;
  phone: string;
  sectionId: string;
  stream: StudentStream;
  electiveSubjectId: string | null;
  electiveChoiceIds?: string[];
  values: Record<string, string>;
};

export function StudentForm({
  sections,
  classSubjects,
  fields,
  initial,
  defaultClassId,
  defaultSectionId,
}: {
  sections: Section[];
  classSubjects: ClassSubject[];
  fields: Field[];
  initial?: InitialStudent;
  defaultClassId?: string;
  defaultSectionId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const presetSection = sections.find(
    (section) => section.id === (initial?.sectionId ?? defaultSectionId),
  ) ?? sections.find((section) => section.classId === defaultClassId);
  const [boardId, setBoardId] = useState(presetSection?.boardId ?? "");
  const [classId, setClassId] = useState(presetSection?.classId ?? defaultClassId ?? "");
  const [sectionId, setSectionId] = useState(initial?.sectionId ?? defaultSectionId ?? "");
  const [rollNumber, setRollNumber] = useState(initial?.rollNumber ?? "");
  const [rollHint, setRollHint] = useState("");
  const [stream, setStream] = useState<StudentStream>(initial?.stream ?? "SCIENCE");
  const [electiveSubjectIds, setElectiveSubjectIds] = useState<string[]>(() => {
    if (initial?.electiveChoiceIds?.length) return initial.electiveChoiceIds;
    return initial?.electiveSubjectId ? [initial.electiveSubjectId] : [];
  });

  const boardOptions = useMemo(
    () => [
      ...new Map(
        sections.map((section) => [
          section.boardId,
          { value: section.boardId, label: section.boardName },
        ]),
      ).values(),
    ],
    [sections],
  );
  const classOptions = useMemo(
    () => [
      ...new Map(
        sections
          .filter((section) => section.boardId === boardId)
          .map((section) => [
            section.classId,
            { value: section.classId, label: section.className },
          ]),
      ).values(),
    ],
    [sections, boardId],
  );
  const sectionOptions = useMemo(
    () =>
      sections
        .filter((section) => section.classId === classId)
        .map((section) => ({ value: section.id, label: section.name })),
    [sections, classId],
  );
  const electives = useMemo(
    () =>
      electiveOptionsForClass(
        classSubjects.filter((subject) => subject.classId === classId),
        stream,
      ),
    [classSubjects, classId, stream],
  );
  const electiveOptions = useMemo(
    () => electives.map((subject) => ({ value: subject.id, label: subject.name })),
    [electives],
  );
  const primaryElectiveId = useMemo(
    () =>
      stream === "SCIENCE"
        ? (electiveSubjectIds.find((id) => electives.some((s) => s.id === id)) ?? "")
        : "",
    [electiveSubjectIds, electives, stream],
  );
  const streamOptions = useMemo(
    () => [
      { value: "SCIENCE", label: "Science" },
      { value: "ARTS", label: "Arts" },
    ],
    [],
  );

  useEffect(() => {
    setElectiveSubjectIds((current) => {
      const allowed = new Set(electiveOptions.map((option) => option.value));
      const next = current.filter((id) => allowed.has(id));
      return next.length === current.length ? current : next;
    });
  }, [electiveOptions]);

  useEffect(() => {
    if (initial) return;
    if (!sectionId) {
      setRollNumber("");
      setRollHint("");
      return;
    }

    let cancelled = false;
    setRollHint("Checking this section’s last roll number…");
    getNextRollNumber(sectionId)
      .then((result) => {
        if (cancelled) return;
        if (!result.hasStudents) {
          setRollNumber("");
          setRollHint("First student in this section — enter the starting roll number.");
          return;
        }
        setRollNumber(result.nextRollNumber);
        setRollHint(
          result.nextRollNumber
            ? "Auto-filled: last roll number in this section + 1."
            : "Could not increment the last roll number. Enter the next one.",
        );
      })
      .catch(() => {
        if (cancelled) return;
        setRollHint("Enter the roll number for this student.");
      });

    return () => {
      cancelled = true;
    };
  }, [sectionId, initial]);

  function submit(formData: FormData) {
    setError(null);
    if (!boardId) {
      setError("Select a board.");
      return;
    }
    if (!classId) {
      setError("Select a class.");
      return;
    }
    if (!sectionId) {
      setError("Select a section.");
      return;
    }
    if (stream === "SCIENCE" && electives.length > 0) {
      const sciencePicks = electiveSubjectIds.filter((id) =>
        electives.some((subject) => subject.id === id),
      );
      if (sciencePicks.length !== 1) {
        setError(
          `Select one elective (${electives.map((s) => s.name).join(" or ")}).`,
        );
        return;
      }
    }
    startTransition(async () => {
      const result = initial
        ? await updateStudent(formData)
        : await createStudent(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/org-admin/students/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-5">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="stream" value={stream} />
      <input
        type="hidden"
        name="electiveSubjectId"
        value={stream === "SCIENCE" ? primaryElectiveId : ""}
      />
      {electiveSubjectIds.map((id) => (
        <input key={id} type="hidden" name="electiveSubjectIds" value={id} />
      ))}

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            Board <span className="text-red-500">*</span>
          </span>
          <SearchSelect
            value={boardId}
            options={boardOptions}
            onChange={(value) => {
              setBoardId(value);
              setClassId("");
              setSectionId("");
            }}
            placeholder="Select board"
            searchPlaceholder="Search board…"
            ariaLabel="Board"
            className="h-11 w-full"
          />
        </div>
        <div className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            Class <span className="text-red-500">*</span>
          </span>
          <SearchSelect
            value={classId}
            options={classOptions}
            onChange={(value) => {
              setClassId(value);
              setSectionId("");
              setElectiveSubjectIds([]);
            }}
            placeholder={boardId ? "Select class" : "Select board first"}
            searchPlaceholder="Search class…"
            emptyText={boardId ? "No classes for this board" : "Select a board first"}
            disabled={!boardId}
            ariaLabel="Class"
            className="h-11 w-full"
          />
        </div>
        <div className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            Section <span className="text-red-500">*</span>
          </span>
          <SearchSelect
            value={sectionId}
            options={sectionOptions}
            onChange={setSectionId}
            placeholder={classId ? "Select section" : "Select class first"}
            searchPlaceholder="Search section…"
            emptyText={classId ? "No sections for this class" : "Select a class first"}
            disabled={!classId}
            ariaLabel="Section"
            className="h-11 w-full"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            Group / Stream <span className="text-red-500">*</span>
          </span>
          <SearchSelect
            value={stream}
            options={streamOptions}
            onChange={(value) => {
              setStream(value as StudentStream);
              setElectiveSubjectIds([]);
            }}
            placeholder="Select stream"
            searchPlaceholder="Search stream…"
            ariaLabel="Group / Stream"
            className="h-11 w-full"
          />
        </div>
        {electiveOptions.length > 0 ? (
          <div className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">
              Elective
              {stream === "SCIENCE" ? <span className="text-red-500"> *</span> : null}
            </span>
            <MultiSearchSelect
              values={electiveSubjectIds}
              options={electiveOptions}
              onChange={(next) => {
                if (stream === "SCIENCE" && next.length > 1) {
                  setElectiveSubjectIds([next[next.length - 1]!]);
                  return;
                }
                setElectiveSubjectIds(next);
              }}
              placeholder={
                stream === "SCIENCE" ? "Select Biology or Computer" : "Select Arts electives"
              }
              searchPlaceholder="Search elective…"
              ariaLabel="Elective subject"
              className="h-11 w-full"
            />
            {stream === "ARTS" ? (
              <span className="mt-1.5 block text-xs text-muted">
                You can select multiple Arts electives.
              </span>
            ) : (
              <span className="mt-1.5 block text-xs text-muted">
                Choose only one: Biology or Computer.
              </span>
            )}
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            Roll number <span className="text-red-500">*</span>
          </span>
          <Input
            name="rollNumber"
            value={rollNumber}
            onChange={(event) => setRollNumber(event.target.value)}
            required
            maxLength={50}
            placeholder={initial ? undefined : sectionId ? "Will auto-fill after the first student" : "Select a section first"}
            readOnly={!initial && !sectionId}
          />
          {!initial && rollHint ? (
            <span className="mt-1.5 block text-xs text-muted">{rollHint}</span>
          ) : null}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            Student name <span className="text-red-500">*</span>
          </span>
          <Input name="name" defaultValue={initial?.name} required maxLength={120} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            Father name <span className="text-red-500">*</span>
          </span>
          <Input name="fatherName" defaultValue={initial?.fatherName} required maxLength={120} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            Phone <span className="text-red-500">*</span>
          </span>
          <Input name="phone" type="tel" defaultValue={initial?.phone} required maxLength={40} />
        </label>
      </div>

      {fields.length ? (
        <div className="border-t border-[rgba(15,40,70,0.08)] pt-5">
          <h3 className="mb-4 font-display text-lg font-semibold text-ink">Additional details</h3>
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map((field) => {
              const fieldName = `custom_${field.id}`;
              const initialValue = initial?.values[field.id] ?? "";
              if (field.type === "BOOLEAN" || field.type === "SELECT") {
                const options =
                  field.type === "BOOLEAN"
                    ? [
                        { value: "true", label: "Yes" },
                        { value: "false", label: "No" },
                      ]
                    : field.options.map((option) => ({
                        value: option,
                        label: option,
                      }));
                return (
                  <CustomSelectField
                    key={field.id}
                    name={fieldName}
                    label={field.label}
                    required={field.isRequired}
                    options={options}
                    initialValue={initialValue}
                  />
                );
              }
              return (
                <label key={field.id} className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink">
                    {field.label}{" "}
                    {field.isRequired ? <span className="text-red-500">*</span> : null}
                  </span>
                  <Input
                    name={fieldName}
                    type={
                      field.type === "NUMBER"
                        ? "number"
                        : field.type === "DATE"
                          ? "date"
                          : "text"
                    }
                    step={field.type === "NUMBER" ? "any" : undefined}
                    defaultValue={initialValue}
                    required={field.isRequired}
                  />
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Link
          href={
            initial
              ? `/org-admin/students/${initial.id}`
              : defaultSectionId && classId
                ? `/org-admin/students?classId=${classId}&sectionId=${defaultSectionId}`
                : classId
                  ? `/org-admin/students?classId=${classId}`
                  : "/org-admin/students"
          }
        >
          <Button type="button" variant="outline">Cancel</Button>
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save Student" : "Add Student"}
        </Button>
      </div>
    </form>
  );
}

function CustomSelectField({
  name,
  label,
  required,
  options,
  initialValue,
}: {
  name: string;
  label: string;
  required: boolean;
  options: Array<{ value: string; label: string }>;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      <input type="hidden" name={name} value={value} required={required} />
      <SearchSelect
        value={value}
        options={options}
        onChange={setValue}
        placeholder="Select"
        searchPlaceholder={`Search ${label.toLowerCase()}…`}
        ariaLabel={label}
        className="h-11 w-full"
      />
    </div>
  );
}
