export const ORG_MODULE_KEYS = [
  "STUDENTS",
  "RESULTS",
  "FEES",
  "SCHEDULES",
] as const;

export type OrgModuleKey = (typeof ORG_MODULE_KEYS)[number];

export type OrgModuleFlags = Record<OrgModuleKey, boolean>;

export type OrgModuleRow = {
  moduleStudents: boolean;
  moduleResults: boolean;
  moduleFees: boolean;
  moduleSchedules: boolean;
};

export const ORG_MODULES: Record<
  OrgModuleKey,
  { field: keyof OrgModuleRow; label: string; description: string }
> = {
  STUDENTS: {
    field: "moduleStudents",
    label: "Students",
    description: "Student records, rolls, custom fields, and section lists",
  },
  RESULTS: {
    field: "moduleResults",
    label: "Results",
    description: "Marks entry, gazettes, and combined result series",
  },
  FEES: {
    field: "moduleFees",
    label: "Fees",
    description: "Fee heads, dues, and payment collection",
  },
  SCHEDULES: {
    field: "moduleSchedules",
    label: "Schedules",
    description: "Named test schedules and teacher assigned tests",
  },
};

export const DISABLED_ORG_MODULES: OrgModuleFlags = {
  STUDENTS: false,
  RESULTS: false,
  FEES: false,
  SCHEDULES: false,
};

export function flagsFromOrg(org: OrgModuleRow): OrgModuleFlags {
  return {
    STUDENTS: org.moduleStudents,
    RESULTS: org.moduleResults,
    FEES: org.moduleFees,
    SCHEDULES: org.moduleSchedules,
  };
}

export function parseOrgModulesFromForm(formData: FormData): OrgModuleRow {
  const selected = new Set(
    formData.getAll("module").map((value) => String(value).toUpperCase()),
  );
  return {
    moduleStudents: selected.has("STUDENTS"),
    moduleResults: selected.has("RESULTS"),
    moduleFees: selected.has("FEES"),
    moduleSchedules: selected.has("SCHEDULES"),
  };
}
