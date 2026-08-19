"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteStudentField,
  moveStudentField,
  saveStudentField,
  toggleStudentField,
} from "../actions";
import { toast } from "@/components/ui/toast";

type Field = {
  id: string;
  label: string;
  type: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";
  options: string[];
  isRequired: boolean;
  isActive: boolean;
};

export function FieldManager({ fields }: { fields: Field[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Field | null>(null);
  const [type, setType] = useState<Field["type"]>("TEXT");

  function submit(formData: FormData) {
    const label = String(formData.get("label") ?? "").trim();
    const fieldType = String(formData.get("type") ?? type);
    const options = String(formData.get("options") ?? "").trim();

    if (!label) {
      toast.error("Enter a field label.");
      return;
    }
    if (label.length > 100) {
      toast.error("Field label must be 100 characters or fewer.");
      return;
    }
    if (fieldType === "SELECT") {
      const parts = options.split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length === 0) {
        toast.error("Enter at least one dropdown option, separated by commas.");
        return;
      }
    }

    startTransition(async () => {
      const result = await saveStudentField(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Custom field updated successfully." : "Custom field created successfully.");
      setEditing(null);
      setType("TEXT");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div className="rounded-[1.15rem] border border-[rgba(15,40,70,0.08)] bg-white p-5">
        <h3 className="font-display text-lg font-semibold text-ink">
          {editing ? "Edit custom field" : "Create custom field"}
        </h3>
        <form action={submit} className="mt-5 space-y-4">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Label *</span>
            <Input
              name="label"
              key={editing?.id ?? "new-label"}
              defaultValue={editing?.label ?? ""}
              placeholder="e.g. Date of birth"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Type *</span>
            <select
              name="type"
              value={editing?.type ?? type}
              onChange={(event) => {
                const next = event.target.value as Field["type"];
                if (editing) setEditing({ ...editing, type: next });
                else setType(next);
              }}
              className="field-control h-11 w-full"
            >
              <option value="TEXT">Text</option>
              <option value="NUMBER">Number</option>
              <option value="DATE">Date</option>
              <option value="BOOLEAN">Yes / No</option>
              <option value="SELECT">Dropdown</option>
            </select>
          </label>
          {(editing?.type ?? type) === "SELECT" ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">
                Dropdown options *
              </span>
              <Input
                name="options"
                key={editing?.id ?? "new-options"}
                defaultValue={editing?.options.join(", ") ?? ""}
                placeholder="Option one, Option two"
                required
              />
              <span className="mt-1 block text-xs text-muted">Separate options with commas.</span>
            </label>
          ) : (
            <input type="hidden" name="options" value="" />
          )}
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              name="isRequired"
              value="true"
              key={`${editing?.id ?? "new"}-required`}
              defaultChecked={editing?.isRequired ?? false}
            />
            Required for student profiles
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save Changes" : "Create Field"}
            </Button>
            {editing ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setType("TEXT");
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="space-y-3">
        {fields.length === 0 ? (
          <div className="rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-white p-6 text-sm text-muted">
            No custom fields yet. Fixed student details are always available.
          </div>
        ) : null}
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-white p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-ink">{field.label}</h4>
                  <span className="status-chip status-chip-warn">{field.type}</span>
                  <span className={field.isActive ? "status-chip status-chip-success" : "status-chip status-chip-muted"}>
                    {field.isActive ? "Active" : "Inactive"}
                  </span>
                  {field.isRequired ? <span className="status-chip status-chip-muted">Required</span> : null}
                </div>
                {field.options.length ? (
                  <p className="mt-1 text-xs text-muted">{field.options.join(", ")}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={moveStudentField}>
                  <input type="hidden" name="id" value={field.id} />
                  <input type="hidden" name="direction" value="up" />
                  <Button type="submit" size="sm" variant="outline" disabled={index === 0}>↑</Button>
                </form>
                <form action={moveStudentField}>
                  <input type="hidden" name="id" value={field.id} />
                  <input type="hidden" name="direction" value="down" />
                  <Button type="submit" size="sm" variant="outline" disabled={index === fields.length - 1}>↓</Button>
                </form>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(field);
                  }}
                >
                  Edit
                </Button>
                <form action={toggleStudentField}>
                  <input type="hidden" name="id" value={field.id} />
                  <Button type="submit" size="sm" variant="outline">
                    {field.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </form>
                {!field.isActive ? (
                  <form
                    action={deleteStudentField}
                    onSubmit={(event) => {
                      if (!window.confirm(`Delete "${field.label}" and all saved student values?`)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="id" value={field.id} />
                    <input type="hidden" name="confirmation" value="DELETE" />
                    <Button type="submit" size="sm" variant="danger">Delete</Button>
                  </form>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        <Link href="/org-admin/students" className="inline-block pt-2">
          <Button variant="outline">Back to Students</Button>
        </Link>
      </div>
    </div>
  );
}
