import { requireOrgModule } from "@/lib/org-modules";
import { assertFullOrgDesk } from "../assert-full-desk";

export default async function SchedulesModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertFullOrgDesk();
  await requireOrgModule("SCHEDULES");
  return children;
}
