import { requireOrgModule } from "@/lib/org-modules";

export default async function FeesModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrgModule("FEES");
  return children;
}
