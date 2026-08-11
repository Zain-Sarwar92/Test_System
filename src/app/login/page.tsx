import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession, resolveDashboardAccess } from "@/lib/rbac";

const ACCOUNT_ERROR_MESSAGES: Record<string, string> = {
  inactive:
    "Your account is inactive. Contact your organization administrator.",
  no_org:
    "Your account is not linked to an organization. Sign out and use a different account, or contact support.",
  org_inactive:
    "Your organization is inactive. Contact your administrator or support.",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error: errorParam } = await searchParams;
  const session = await getSession();

  // Keep the login page when showing an account error — avoids redirect loops.
  if (session && !errorParam) {
    const access = await resolveDashboardAccess(session);
    if (access.ok) {
      redirect(access.path);
    }
  }

  const initialError = errorParam
    ? (ACCOUNT_ERROR_MESSAGES[errorParam] ?? "Unable to sign in with this account.")
    : null;

  return (
    <div className="login-backdrop relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="orb pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-teal-300/25 blur-3xl" />
      <div className="orb pointer-events-none absolute right-[-4rem] bottom-[-3rem] h-80 w-80 rounded-full bg-cyan-200/20 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-[1100px] items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div className="fade-up text-white lg:pr-4">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-teal-200/90 uppercase">
            Test Generator
          </p>
          <h1 className="font-display mt-4 max-w-[34rem] text-[2.35rem] leading-[1.12] font-semibold tracking-tight sm:text-5xl">
            Professional papers, built for real classrooms.
          </h1>
          <p className="mt-4 max-w-[28rem] text-sm leading-relaxed text-white/75 sm:text-[0.95rem]">
            A multi-tenant platform for schools and academies — generate balanced
            tests from a global question bank in minutes.
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5 text-xs text-white/75">
            <span className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
              Balanced distribution
            </span>
            <span className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
              Role-based access
            </span>
            <span className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
              Global question bank
            </span>
          </div>
        </div>

        <div className="fade-up-delay w-full max-w-[440px] justify-self-center lg:justify-self-end">
          <LoginForm
            initialError={initialError}
            showSignOut={Boolean(session && errorParam)}
          />
        </div>
      </div>
    </div>
  );
}
