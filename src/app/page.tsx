import { redirect } from "next/navigation";
import { getSession, dashboardPathForRole, resolveUserRole } from "@/lib/rbac";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const role = await resolveUserRole(session);
  redirect(dashboardPathForRole(role));
}
