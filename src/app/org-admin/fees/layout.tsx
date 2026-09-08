import { requireOrgModule } from "@/lib/org-modules";
import { assertFullOrgDesk } from "../assert-full-desk";

export default async function FeesModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertFullOrgDesk();
  await requireOrgModule("FEES");
  return children;
}
