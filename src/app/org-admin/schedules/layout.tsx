import { requireOrgModule } from "@/lib/org-modules";

export default async function SchedulesModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrgModule("SCHEDULES");
  return children;
}
