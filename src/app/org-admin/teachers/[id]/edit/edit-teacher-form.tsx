"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { expandAssignmentGroups } from "@/lib/teacher-assignments";
import { updateTeacher } from "../../actions";
import {
  TeacherAssignmentsEditor,
  newAssignmentDraft,
  type AssignmentDraft,
  type BoardOption,
  type ClassOption,
  type SectionOption,
  type SubjectOption,
} from "../../teacher-assignments-editor";

type InitialTeacher = {
  id: string;
  name: string;
  email: string;
  assignments: Array<{
    boardId: string;
    classId: string;
    sectionId: string;
    subjectName: string;
  }>;
};

export function EditTeacherForm({
  teacher,
  boards,
  classes,
  sections,
  subjects,
  takenSections = [],
}: {
  teacher: InitialTeacher;
  boards: BoardOption[];
  classes: ClassOption[];
  sections: SectionOption[];
  subjects: SubjectOption[];
  takenSections?: Array<{
    sectionId: string;
    subjectName: string;
    teacherName: string;
  }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(teacher.name);
  const [assignments, setAssignments] = useState<AssignmentDraft[]>(
    teacher.assignments.length > 0
      ? teacher.assignments.map((row) =>
          newAssignmentDraft({
            boardIds: [row.boardId],
            classIds: [row.classId],
            sectionIds: [row.sectionId],
            subjectName: row.subjectName,
          }),
        )
      : [newAssignmentDraft()],
  );

  function onSubmit() {
    if (name.trim().length < 2) {
      toast.error("Enter the teacher's full name.");
      return;
    }
    if (name.trim().length > 120) {
      toast.error("Teacher name must be 120 characters or fewer.");
      return;
    }

    try {
      const expanded = expandAssignmentGroups(
        assignments.map((row) => ({
          classIds: row.classIds,
          sectionIds: row.sectionIds,
          subjectName: row.subjectName,
        })),
        { sections, subjects, classes },
        { allowEmpty: true },
      );

      const formData = new FormData();
      formData.set("id", teacher.id);
      formData.set("name", name.trim());
      formData.set("assignments", JSON.stringify(expanded));

      startTransition(async () => {
        const result = await updateTeacher(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Teacher updated successfully.");
        router.push(`/org-admin/teachers/${teacher.id}`);
        router.refresh();
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "These assignments are not valid.",
      );
    }
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          Full name <span className="text-red-500">*</span>
        </span>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Email</span>
        <Input value={teacher.email} disabled className="h-11 opacity-70" />
      </label>

      <TeacherAssignmentsEditor
        boards={boards}
        classes={classes}
        sections={sections}
        subjects={subjects}
        takenSections={takenSections}
        rows={assignments}
        onChange={setAssignments}
        allowEmpty
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/org-admin/teachers/${teacher.id}`}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <Button type="button" onClick={onSubmit} disabled={pending}>
          {pending ? "Saving…" : "Save permissions"}
        </Button>
      </div>
    </div>
  );
}
