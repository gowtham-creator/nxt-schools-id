"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useFormStatus } from "react-dom";
import { Mail, Lock, User, IdCard, QrCode, Printer, Layers } from "lucide-react";
import { login, signup } from "./actions";

/** A small ID-card mockup that floats in the brand panel. */
function MiniCard({
  name,
  role,
  band,
}: {
  name: string;
  role: string;
  band: string;
}) {
  return (
    <div className="w-64 overflow-hidden rounded-2xl border border-white/25 bg-white/10 shadow-2xl backdrop-blur-md">
      <div className="h-9" style={{ background: band }} />
      <div className="flex gap-3 p-4">
        <div className="h-16 w-14 shrink-0 rounded-lg bg-white/35" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="text-sm font-semibold text-white">{name}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/70">
            {role}
          </div>
          <div className="h-1.5 w-24 rounded bg-white/30" />
          <div className="h-1.5 w-16 rounded bg-white/25" />
        </div>
        <div className="grid h-9 w-9 shrink-0 grid-cols-3 gap-0.5 self-end rounded bg-white/85 p-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className={i % 2 === 0 ? "rounded-[1px] bg-slate-800" : "bg-transparent"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: Layers, label: "Branches & academic years" },
  { icon: IdCard, label: "Drag-and-drop card designer" },
  { icon: QrCode, label: "QR + barcode verification" },
  { icon: Printer, label: "Print-ready PDF export" },
];

/** Submit buttons share the form's pending state via useFormStatus. */
function AuthButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
      <button formAction={login} disabled={pending} className="btn-primary flex-1">
        {pending ? "Please wait…" : "Sign in"}
      </button>
      <button formAction={signup} disabled={pending} className="btn-secondary flex-1">
        Create account
      </button>
    </div>
  );
}

export default function LoginView({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  const reduce = useReducedMotion();

  const float = (delay: number, y: number): Variants => ({
    initial: { opacity: 0, y: 24 },
    animate: reduce
      ? { opacity: 1, y: 0 }
      : {
          opacity: 1,
          y: [0, -14, 0],
          transition: {
            y: { duration: 6, delay, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" },
            opacity: { duration: 0.8, delay },
          },
        },
  });

  return (
    <main className="flex min-h-screen">
      {/* Brand panel */}
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800 lg:flex"
      >
        {/* Soft glows */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-[32rem] w-[32rem] rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="relative z-10 flex w-full flex-col justify-between p-12">
          <div className="flex items-center gap-2 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
              <IdCard className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">Nxt Schools ID</span>
          </div>

          {/* Floating cards */}
          <div className="relative mx-auto my-8 h-72 w-full max-w-md">
            <motion.div
              variants={float(0, 0)}
              initial="initial"
              animate="animate"
              className="absolute left-2 top-4 -rotate-6"
            >
              <MiniCard name="Ananya Sharma" role="Student · Grade 6" band="#f59e0b" />
            </motion.div>
            <motion.div
              variants={float(0.6, 0)}
              initial="initial"
              animate="animate"
              className="absolute right-0 top-24 rotate-6"
            >
              <MiniCard name="Rahul Verma" role="Student · Grade 6" band="#0ea5e9" />
            </motion.div>
          </div>

          <div>
            <h1 className="max-w-sm text-3xl font-bold leading-tight text-white">
              School ID cards, designed &amp; printed in minutes.
            </h1>
            <ul className="mt-6 grid grid-cols-2 gap-3">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex items-center gap-2 text-sm text-white/85">
                  <f.icon className="h-4 w-4 shrink-0 text-teal-200" />
                  {f.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.aside>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center bg-slate-50 p-6 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-sm"
        >
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
              <IdCard className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">Nxt Schools ID</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage your ID cards.</p>

          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          ) : null}

          <form className="mt-6 space-y-4">
            <div>
              <label htmlFor="full_name" className="field-label">
                Full name <span className="font-normal text-slate-400">(sign up only)</span>
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  className="field-input pl-10"
                  placeholder="Jane Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="field-input pl-10"
                  placeholder="you@school.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="field-label">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  className="field-input pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <AuthButtons />
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Secure sign-in · Your school data stays private.
          </p>
        </motion.div>
      </div>
    </main>
  );
}
