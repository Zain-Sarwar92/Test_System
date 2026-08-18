"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { createTeacher } from "../actions";
import { expandAssignmentGroups } from "@/lib/teacher-assignments";
import {
  TeacherAssignmentsEditor,
  newAssignmentDraft,
  type AssignmentDraft,
  type BoardOption,
  type ClassOption,
  type SectionOption,
  type SubjectOption,
} from "../teacher-assignments-editor";

const STEPS = [
  { id: 1, label: "Details" },
  { id: 2, label: "Assignments" },
] as const;

export function CreateTeacherForm({
  boards,
  classes,
  sections,
  subjects,
  takenSections = [],
}: {
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
  const [step, setStep] = useState(1);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([
    newAssignmentDraft(),
  ]);

  function goNext() {
    if (name.trim().length < 2) {
      toast.error("Enter the teacher's full name.");
      return;
    }
    if (!email.trim().includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setStep(2);
  }

  function onSubmit() {
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
      formData.set("name", name.trim());
      formData.set("email", email.trim());
      formData.set("password", password);
      formData.set("assignments", JSON.stringify(expanded));

      startTransition(async () => {
        const result = await createTeacher(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Teacher created successfully.");
        router.push("/org-admin/teachers");
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
      <div className="flex items-center gap-2">
        {STEPS.map((item, index) => {
          const active = step === item.id;
          const done = step > item.id;
          return (
            <div key={item.id} className="flex items-center gap-2">
              {index > 0 ? (
                <div
                  className={`h-px w-8 ${done || active ? "bg-brand" : "bg-[rgba(15,40,70,0.12)]"}`}
                />
              ) : null}
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  active
                    ? "bg-brand text-white"
                    : done
                      ? "bg-brand/10 text-brand"
                      : "bg-[#f3f7fb] text-muted"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    active
                      ? "bg-white/20"
                      : done
                        ? "bg-brand text-white"
                        : "bg-white text-muted"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : item.id}
                </span>
                {item.label}
              </div>
            </div>
          );
        })}
      </div>

      {step === 1 ? (
        <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">
              Full name <span className="text-red-500">*</span>
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter teacher's full name"
              autoComplete="name"
              className="h-11"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">
              Email <span className="text-red-500">*</span>
            </span>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="teacher@school.com"
              autoComplete="email"
              className="h-11"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">
              Password <span className="text-red-500">*</span>
            </span>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Minimum 8 characters"
              minLength={8}
              autoComplete="new-password"
              className="h-11"
            />
          </label>
        </div>
      ) : null}

      {step === 2 ? (
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
      ) : null}


      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {step === 2 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <Link href="/org-admin/teachers" className="sm:inline-flex">
              <Button type="button" variant="outline" className="h-11 w-full px-6 sm:w-auto">
                Cancel
              </Button>
            </Link>
          )}
        </div>

        <div>
          {step === 1 ? (
            <Button type="button" onClick={goNext} className="h-11 gap-2 px-8">
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onSubmit}
              disabled={pending}
              className="h-11 px-8"
            >
              {pending ? "Creating…" : "Create Teacher"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
