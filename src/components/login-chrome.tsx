"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

export const LOGIN_EXPLORE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/#features", label: "Features" },
  { href: "/#modes", label: "Modes" },
  { href: "/#coverage", label: "Coverage" },
  { href: "/#how", label: "How it works" },
  { href: "/#start", label: "Get started" },
] as const;

export function LoginNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="login-nav">
      <div className="login-nav-inner">
        <Link href="/" className="login-logo" aria-label="Test Hub home">
          <span className="login-logo-mark" aria-hidden>
            TH
          </span>
          <span className="login-logo-text">Test Hub</span>
        </Link>

        <nav className="login-nav-links" aria-label="Explore Test Hub">
          {LOGIN_EXPLORE_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="landing-nav-menu-btn"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div
        className={`landing-mobile-overlay${open ? " landing-mobile-overlay--open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside
        className={`landing-mobile-drawer${open ? " landing-mobile-drawer--open" : ""}`}
        aria-hidden={!open}
      >
        <div className="landing-mobile-drawer-head">
          <span className="landing-logo-text text-white">Menu</span>
          <button
            type="button"
            className="landing-nav-menu-btn landing-nav-menu-btn--light"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav className="landing-mobile-drawer-nav" aria-label="Mobile">
          {LOGIN_EXPLORE_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="landing-mobile-drawer-footer">
          <Link
            href="/"
            className="landing-btn landing-btn-outline-light landing-btn-block"
            onClick={() => setOpen(false)}
          >
            Back to home
          </Link>
          <Link
            href="/#start"
            className="landing-btn landing-btn-solid landing-btn-block"
            onClick={() => setOpen(false)}
          >
            Get started
          </Link>
        </div>
      </aside>
    </header>
  );
}
