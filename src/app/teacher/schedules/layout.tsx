import { requireOrgModule } from "@/lib/org-modules";

export default async function TeacherSchedulesModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrgModule("SCHEDULES", ["TEACHER"]);
  return children;
}
