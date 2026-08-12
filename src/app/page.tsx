import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";
import { getSession, dashboardPathForRole, resolveUserRole } from "@/lib/rbac";

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    const role = await resolveUserRole(session);
    redirect(dashboardPathForRole(role));
  }

  return <LandingPage />;
}
