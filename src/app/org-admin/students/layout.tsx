import { requireOrgModule } from "@/lib/org-modules";

export default async function StudentsModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrgModule("STUDENTS");
  return children;
}
