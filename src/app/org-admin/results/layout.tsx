import { requireOrgModule } from "@/lib/org-modules";

export default async function ResultsModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrgModule("RESULTS");
  return children;
}
