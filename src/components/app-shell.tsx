"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  BookPlus,
  Inbox,
  GraduationCap,
  ClipboardList,
  UserRound,
  FilePlus2,
  MessageSquarePlus,
  LogOut,
  Layers,
  Library,
  CreditCard,
  Settings,
  ArrowLeftRight,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type NavIcon =
  | "overview"
  | "organizations"
  | "questions"
  | "suggestions"
  | "teachers"
  | "tests"
  | "profile"
  | "generate"
  | "suggest"
  | "hierarchy"
  | "questionBank"
  | "plans"
  | "settings"
  | "schedule";

type NavItem = {
  href: string;
  label: string;
  icon?: NavIcon;
  badge?: number;
};

const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  organizations: Building2,
  questions: BookPlus,
  suggestions: Inbox,
  teachers: GraduationCap,
  tests: ClipboardList,
  profile: UserRound,
  generate: FilePlus2,
  suggest: MessageSquarePlus,
  hierarchy: Layers,
  questionBank: Library,
  plans: CreditCard,
  settings: Settings,
  schedule: CalendarClock,
};

function isNavActive(pathname: string, href: string) {
  if (href === "/super-admin" || href === "/org-admin" || href === "/teacher") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  title,
  subtitle,
  titleMeta,
  organizationName,
  nav,
  children,
  showOrgSwitcher = false,
}: {
  title: string;
  subtitle?: string;
  /** Optional label next to the role title (e.g. teacher subjects). */
  titleMeta?: string | null;
  organizationName?: string | null;
  nav: NavItem[];
  children: React.ReactNode;
  showOrgSwitcher?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isGenerate = pathname.startsWith("/teacher/generate");

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-backdrop">
      <div className="shell-frame">
        <aside className="sidebar-panel text-white">
          <div className="mb-7 px-1 text-left">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-teal-200/90 uppercase">
              Test Generator
            </p>
            <h1 className="font-display mt-3 text-[1.65rem] leading-tight font-semibold text-white">
              {title}
              {titleMeta ? (
                <span className="font-display text-[1.05rem] font-medium text-teal-200/95">
                  {" "}
                  · {titleMeta}
                </span>
              ) : null}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-sm leading-relaxed text-white/65">{subtitle}</p>
            ) : null}
            {organizationName ? (
              <div className="mt-3 flex items-start gap-2 rounded-[0.85rem] border border-white/15 bg-white/10 px-3 py-2.5">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-200/90" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-white/50 uppercase">
                    Organization
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-white/90">
                    {organizationName}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
            {nav.map((item) => {
              const active = isNavActive(pathname, item.href);
              const Icon = item.icon ? NAV_ICONS[item.icon] : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-[0.8rem] px-3.5 py-2.5 text-left text-[0.9rem] font-medium transition-all duration-300",
                    active
                      ? "nav-active"
                      : "text-white/70 hover:translate-x-0.5 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {Icon ? (
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-teal-200" : "text-white/55",
                      )}
                      strokeWidth={2}
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {typeof item.badge === "number" && item.badge > 0 ? (
                    <span className="nav-badge">{item.badge > 99 ? "99+" : item.badge}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
            {showOrgSwitcher ? (
              <Link href="/select-org" className="block">
                <Button
                  variant="outline"
                  className="h-11 w-full border-white/20 bg-white/5 text-white hover:bg-white/12 hover:text-white"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Switch organization
                </Button>
              </Link>
            ) : null}
            <Button
              variant="outline"
              onClick={handleSignOut}
              className={cn(
                "h-11 w-full border-white/20 bg-white/5 text-white hover:bg-white/12 hover:text-white",
                showOrgSwitcher && "mt-1",
              )}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <main className={cn("glass-panel fade-up", isGenerate && "glass-panel-dense")}>
          <div className="mobile-topbar">
            <div className="min-w-0 text-left">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-teal-200 uppercase">
                Test Generator
              </p>
              <p className="truncate text-sm font-semibold text-white">
                {title}
                {titleMeta ? (
                  <span className="font-medium text-teal-200/90"> · {titleMeta}</span>
                ) : null}
              </p>
              {organizationName ? (
                <p className="mt-0.5 truncate text-[11px] text-white/60">
                  {organizationName}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {showOrgSwitcher ? (
                <Link href="/select-org">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white hover:bg-white/12 hover:text-white"
                  >
                    Switch
                  </Button>
                </Link>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={handleSignOut}
                className="border-white/20 bg-white/5 text-white hover:bg-white/12 hover:text-white"
              >
                Sign out
              </Button>
            </div>
          </div>

          <nav className="mobile-nav">
            {nav.map((item) => {
              const active = isNavActive(pathname, item.href);
              const Icon = item.icon ? NAV_ICONS[item.icon] : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-all duration-300",
                    active
                      ? "bg-brand text-white"
                      : "border border-[rgba(15,40,70,0.1)] bg-white/70 text-ink-soft",
                  )}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
                  <span className="truncate">{item.label}</span>
                  {typeof item.badge === "number" && item.badge > 0 ? (
                    <span className="ml-auto rounded-md bg-white/20 px-1.5 py-0.5 text-[10px]">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {children}
        </main>
      </div>
    </div>
  );
}
