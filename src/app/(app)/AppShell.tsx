"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { stopImpersonation } from "./platform/impersonation-actions";

export type NavItem = { href: string; label: string };

/**
 * Responsive app chrome. Desktop (md+) shows the fixed sidebar; mobile/tablet
 * shows a top bar with a hamburger that opens a slide-in drawer. Children are
 * server-rendered pages passed through unchanged.
 */
export default function AppShell({
  nav,
  userLabel,
  roleLabel,
  impersonation,
  children,
}: {
  nav: NavItem[];
  userLabel: string;
  roleLabel: string;
  impersonation: { schoolName: string } | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Longest matching nav href wins, so /platform/activity highlights "Login
  // activity" (not also "Platform"), while /platform/<id> keeps "Platform" lit.
  const activeHref = nav
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-1">
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={onNavigate}
          className={`nav-link${n.href === activeHref ? " nav-link-active" : ""}`}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
        <div className="px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/nxt-mark.png" alt="NXT School" className="h-9 w-auto" />
          <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            ID Card Suite
          </div>
        </div>
        <div className="mt-6">
          <NavList />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 h-full w-full cursor-default bg-slate-900/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-64 max-w-[82%] flex-col overflow-y-auto bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between px-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/nxt-mark.png" alt="NXT School" className="h-8 w-auto" />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6">
              <NavList onNavigate={() => setOpen(false)} />
            </div>
            <div className="mt-auto border-t border-slate-100 pt-3 text-xs text-slate-500">
              {userLabel} · <span className="font-medium text-slate-700">{roleLabel}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {impersonation && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm text-white sm:px-6">
            <span>
              Viewing as{" "}
              <span className="font-semibold">{impersonation.schoolName}</span>
              <span className="hidden sm:inline"> — your super-admin session is preserved.</span>
            </span>
            <form action={stopImpersonation}>
              <button className="cursor-pointer rounded-md bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30">
                Return to super admin
              </button>
            </form>
          </div>
        )}

        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 md:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="cursor-pointer rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/nxt-mark.png" alt="NXT School" className="h-7 w-auto" />
          <form action="/auth/signout" method="post">
            <button className="btn-secondary btn-sm">Sign out</button>
          </form>
        </div>

        {/* Desktop header */}
        <header className="hidden items-center justify-between border-b border-slate-200 bg-white px-6 py-3 md:flex">
          <div className="truncate text-sm text-slate-500">
            {userLabel} ·{" "}
            <span className="font-medium text-slate-700">{roleLabel}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="btn-secondary btn-sm">Sign out</button>
          </form>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
