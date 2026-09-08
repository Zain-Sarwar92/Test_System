import { requireOrgModule } from "@/lib/org-modules";
import { assertFullOrgDesk } from "../assert-full-desk";

export default async function StudentsModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertFullOrgDesk();
  await requireOrgModule("STUDENTS");
  return children;
}
