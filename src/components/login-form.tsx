"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

function targetAfterLogin(role?: string | null) {
  if (role === "SUPER_ADMIN") return "/super-admin";
  if (role) return "/select-org";
  return null;
}

type LoginFormProps = {
  initialError?: string | null;
  showSignOut?: boolean;
};

export function LoginForm({
  initialError = null,
  showSignOut = false,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }

      const signInUser = result.data?.user as { role?: string } | undefined;
      let role = signInUser?.role;

      if (!role) {
        const session = await authClient.getSession();
        role = (session.data?.user as { role?: string } | undefined)?.role;
      }

      const target = targetAfterLogin(role);
      if (!target) {
        setError("Login succeeded but role is missing. Contact your administrator.");
        setLoading(false);
        return;
      }

      router.replace(target);
      router.refresh();
    } catch {
      setError("Invalid email or password.");
      setLoading(false);
    }
  }

  async function onSignOut() {
    setSigningOut(true);
    setError(null);
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Card className="login-card w-full border-white/50 bg-card/94 shadow-[0_24px_60px_rgba(11,31,51,0.28)] backdrop-blur-md">
      <p className="page-kicker">Welcome back</p>
      <CardTitle className="mt-2 text-[1.55rem]">Sign in to continue</CardTitle>
      <CardDescription>
        Use your organization account to access your workspace.
      </CardDescription>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@school.com"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
          />
        </div>
        {error ? (
          <p className="text-sm text-[#b42318]" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full min-w-0" size="lg" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
        {showSignOut ? (
          <Button
            type="button"
            variant="outline"
            className="w-full min-w-0"
            disabled={signingOut}
            onClick={onSignOut}
          >
            {signingOut ? "Signing out..." : "Sign out and use another account"}
          </Button>
        ) : null}
      </form>
    </Card>
  );
}