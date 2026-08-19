"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#modes", label: "Modes" },
  { href: "#coverage", label: "Coverage" },
  { href: "#how", label: "How it works" },
] as const;

export function LandingNavBar() {
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
    <header className="landing-nav">
      <div className="landing-nav-inner">
        <BrandLogo
          href="#top"
          className="landing-logo"
          markClassName="landing-logo-mark"
          textClassName="landing-logo-text"
        />

        <nav className="landing-nav-links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>{link.label}</a>
          ))}
        </nav>

        <div className="landing-nav-actions">
          <button
            type="button"
            className="landing-nav-menu-btn"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="landing-nav-desktop-actions">
            <Link href="/login" className="landing-btn landing-btn-ghost">
              Login
            </Link>
            <a href="#start" className="landing-btn landing-btn-solid">
              Get started
            </a>
          </div>
        </div>
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
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="landing-mobile-drawer-footer">
          <Link
            href="/login"
            className="landing-btn landing-btn-outline-light landing-btn-block"
            onClick={() => setOpen(false)}
          >
            Login
          </Link>
          <a
            href="#start"
            className="landing-btn landing-btn-solid landing-btn-block"
            onClick={() => setOpen(false)}
          >
            Get started
          </a>
        </div>
      </aside>
    </header>
  );
}
