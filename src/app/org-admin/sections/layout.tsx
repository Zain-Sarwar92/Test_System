import { assertFullOrgDesk } from "../assert-full-desk";

export default async function SectionsDeskGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertFullOrgDesk();
  return children;
}
