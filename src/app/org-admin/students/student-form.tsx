"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSearchSelect } from "@/components/ui/multi-search-select";
import { SearchSelect } from "@/components/ui/search-select";
import { createStudent, getNextRollNumber, updateStudent } from "./actions";
import {
  STUDY_GROUP_OPTIONS,
  electiveOptionsForClass,
  isHigherSecondaryClass,
  streamFromStudyGroup,
  type StudentStream,
  type StudyGroup,
} from "@/lib/subject-stream";
import { toast } from "@/components/ui/toast";

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
  studyGroup?: string | null;
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
  const presetSection = sections.find(
    (section) => section.id === (initial?.sectionId ?? defaultSectionId),
  ) ?? sections.find((section) => section.classId === defaultClassId);
  const [boardId, setBoardId] = useState(presetSection?.boardId ?? "");
  const [classId, setClassId] = useState(presetSection?.classId ?? defaultClassId ?? "");
  const [sectionId, setSectionId] = useState(initial?.sectionId ?? defaultSectionId ?? "");
  const [rollNumber, setRollNumber] = useState(initial?.rollNumber ?? "");
  const [rollHint, setRollHint] = useState("");
  const [stream, setStream] = useState<StudentStream>(initial?.stream ?? "SCIENCE");
  const [studyGroup, setStudyGroup] = useState<StudyGroup | "">(
    (initial?.studyGroup as StudyGroup | undefined) ?? "",
  );
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
  const selectedClassName = useMemo(
    () => classOptions.find((option) => option.value === classId)?.label ?? "",
    [classOptions, classId],
  );
  const seniorClass = isHigherSecondaryClass(selectedClassName);
  const electives = useMemo(
    () =>
      electiveOptionsForClass(
        classSubjects.filter((subject) => subject.classId === classId),
        seniorClass ? undefined : stream,
      ),
    [classSubjects, classId, stream, seniorClass],
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
    () =>
      seniorClass
        ? STUDY_GROUP_OPTIONS
        : [
            { value: "SCIENCE", label: "Science" },
            { value: "ARTS", label: "Arts" },
          ],
    [seniorClass],
  );

  function resetClassDownstream() {
    setSectionId("");
    setElectiveSubjectIds([]);
    setStudyGroup("");
  }

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
        if (result.nextRollNumber) {
          setRollHint("Auto-filled: last roll number in this section + 1.");
          toast.success("Roll number auto-filled from the last student in this section.");
        } else {
          setRollHint("Could not increment the last roll number. Enter the next one.");
          toast.warning("Could not auto-fill the roll number. Enter it manually.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRollHint("Enter the roll number for this student.");
        toast.warning("Could not load the next roll number. Enter it manually.");
      });

    return () => {
      cancelled = true;
    };
  }, [sectionId, initial]);

  function validateStudentForm(formData: FormData): string | null {
    const studentName = String(formData.get("name") ?? "").trim();
    const fatherName = String(formData.get("fatherName") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const roll = rollNumber.trim();

    if (!boardId) return "Select a board.";
    if (!classId) return "Select a class.";
    if (!sectionId) return "Select a section.";
    if (!roll) return "Enter the student's roll number.";
    if (roll.length > 50) return "Roll number must be 50 characters or fewer.";
    if (studentName.length < 2) return "Enter the student's full name.";
    if (studentName.length > 120) return "Student name must be 120 characters or fewer.";
    if (fatherName.length < 2) return "Enter the father's name.";
    if (fatherName.length > 120) return "Father name must be 120 characters or fewer.";
    if ((phone.match(/\d/g)?.length ?? 0) < 10) {
      return "Enter a valid phone number with at least 10 digits.";
    }
    if (phone.length > 40) return "Phone number must be 40 characters or fewer.";
    if (seniorClass && !studyGroup) {
      return "Select a group (Pre-medical, Pre-engineering, ICS, or Arts).";
    }
    if (!seniorClass && stream === "SCIENCE" && electives.length > 0) {
      const sciencePicks = electiveSubjectIds.filter((id) =>
        electives.some((subject) => subject.id === id),
      );
      if (sciencePicks.length !== 1) {
        return `Select one Science elective (${electives.map((s) => s.name).join(" or ")}).`;
      }
    }
    for (const field of fields) {
      if (!field.isRequired) continue;
      if (!String(formData.get(`custom_${field.id}`) ?? "").trim()) {
        return `${field.label} is required.`;
      }
    }
    return null;
  }

  function submit(formData: FormData) {
    const error = validateStudentForm(formData);
    if (error) {
      toast.error(error);
      return;
    }

    startTransition(async () => {
      try {
        const result = initial
          ? await updateStudent(formData)
          : await createStudent(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          initial ? "Student updated successfully." : "Student added successfully.",
        );
        const sectionId = String(formData.get("sectionId") ?? "").trim();
        router.push(
          sectionId
            ? `/org-admin/students?sectionId=${encodeURIComponent(sectionId)}`
            : "/org-admin/students",
        );
        router.refresh();
      } catch {
        toast.error("Could not save the student. Try again.");
      }
    });
  }

  return (
    <form action={submit} className="space-y-5">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="stream" value={stream} />
      <input type="hidden" name="studyGroup" value={seniorClass ? studyGroup : ""} />
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
              resetClassDownstream();
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
              resetClassDownstream();
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
            value={seniorClass ? studyGroup : stream}
            options={streamOptions}
            onChange={(value) => {
              if (seniorClass) {
                const group = value as StudyGroup;
                setStudyGroup(group);
                setStream(streamFromStudyGroup(group));
              } else {
                setStream(value as StudentStream);
              }
              setElectiveSubjectIds([]);
            }}
            placeholder={seniorClass ? "Select group" : "Select stream"}
            searchPlaceholder={seniorClass ? "Search group…" : "Search stream…"}
            ariaLabel="Group / Stream"
            className="h-11 w-full"
          />
        </div>
        {electiveOptions.length > 0 ? (
          <div className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">
              Elective
              {!seniorClass && stream === "SCIENCE" ? (
                <span className="text-red-500"> *</span>
              ) : null}
            </span>
            <MultiSearchSelect
              values={electiveSubjectIds}
              options={electiveOptions}
              onChange={(next) => {
                if (!seniorClass && stream === "SCIENCE" && next.length > 1) {
                  setElectiveSubjectIds([next[next.length - 1]!]);
                  return;
                }
                setElectiveSubjectIds(next);
              }}
              placeholder={
                seniorClass
                  ? "Select electives"
                  : stream === "SCIENCE"
                    ? "Select Biology or Computer"
                    : "Select Arts electives"
              }
              searchPlaceholder="Search elective…"
              ariaLabel="Elective subject"
              className="h-11 w-full"
            />
            <span className="mt-1.5 block text-xs text-muted">
              {!seniorClass && stream === "SCIENCE"
                ? "Choose only one: Biology or Computer."
                : "Search, then tick the electives this student is taking."}
            </span>
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
          <Input name="name" defaultValue={initial?.name} maxLength={120} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            Father name <span className="text-red-500">*</span>
          </span>
          <Input name="fatherName" defaultValue={initial?.fatherName} maxLength={120} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            Phone <span className="text-red-500">*</span>
          </span>
          <Input name="phone" type="tel" defaultValue={initial?.phone} maxLength={40} />
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
                  />
                </label>
              );
            })}
          </div>
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
      <input type="hidden" name={name} value={value} />
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
