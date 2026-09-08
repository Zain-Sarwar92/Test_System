import { assertFullOrgDesk } from "../assert-full-desk";

export default async function TeachersDeskGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertFullOrgDesk();
  return children;
}
