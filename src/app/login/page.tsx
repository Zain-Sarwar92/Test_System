import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginNav } from "@/components/login-chrome";
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
    <div className="login-page">
      <div className="login-backdrop login-backdrop-shell">
        <div className="orb pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-teal-300/25 blur-3xl" />
        <div className="orb pointer-events-none absolute right-[-4rem] bottom-[-3rem] h-80 w-80 rounded-full bg-cyan-200/20 blur-3xl" />

        <LoginNav />

        <div className="login-page-body">
          <div className="login-page-grid">
            <div className="login-hero fade-up hidden text-white lg:block lg:pr-4">
              <p className="text-[11px] font-semibold tracking-[0.28em] text-teal-200/90 uppercase">
                Green Book
              </p>
              <h1 className="font-display mt-4 max-w-[34rem] text-[2.35rem] leading-[1.12] font-semibold tracking-tight sm:text-5xl">
                Professional tests, built for real classrooms.
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

            <div className="login-form-column fade-up-delay">
              <LoginForm
                initialError={initialError}
                showSignOut={Boolean(session && errorParam)}
              />
              <p className="login-form-explore">
                New to Green Book?{" "}
                <Link href="/#product">See how it works</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
