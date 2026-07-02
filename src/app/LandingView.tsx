"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Building2,
  PenTool,
  Users,
  Zap,
  QrCode,
  Printer,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   A light, premium ID-card mockup that floats in the hero.
   Colored header band + photo circle + line placeholders + QR.
   ───────────────────────────────────────────────────────────── */
function MiniCard({
  name,
  role,
  band,
  photoTint,
}: {
  name: string;
  role: string;
  band: string;
  photoTint: string;
}) {
  return (
    <div className="w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-black/5">
      <div className="h-10" style={{ background: band }} />
      <div className="flex gap-3 p-4">
        <div
          className="h-14 w-14 shrink-0 rounded-full ring-2 ring-white"
          style={{ background: photoTint }}
        />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="text-sm font-semibold text-slate-900">{name}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            {role}
          </div>
          <div className="h-1.5 w-24 rounded bg-slate-200" />
          <div className="h-1.5 w-16 rounded bg-slate-200" />
        </div>
        <div className="grid h-9 w-9 shrink-0 grid-cols-3 gap-0.5 self-end rounded bg-slate-50 p-1 ring-1 ring-slate-200">
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
  {
    icon: Building2,
    title: "Branches & academic years",
    body: "Organize every campus, branch and session in one structured, always-current workspace.",
  },
  {
    icon: PenTool,
    title: "Drag-and-drop designer",
    body: "Craft pixel-perfect card templates with fields, photos, logos and QR — no design tools needed.",
  },
  {
    icon: Users,
    title: "Bulk student records",
    body: "Import hundreds of students and photos in a single validated upload, grouped by class.",
  },
  {
    icon: Zap,
    title: "One-click bulk generate",
    body: "Render an entire class or branch of cards in seconds instead of laying them out by hand.",
  },
  {
    icon: QrCode,
    title: "QR verification",
    body: "Every card carries a scannable QR that verifies a student's identity instantly.",
  },
  {
    icon: Printer,
    title: "Print-ready PDF export",
    body: "Export crisp, correctly-sized PDFs that drop straight into any school card printer.",
  },
];

const STEPS = [
  {
    n: 1,
    title: "Add students",
    body: "Bulk-import records and photos, neatly grouped by branch and academic year.",
  },
  {
    n: 2,
    title: "Design template",
    body: "Lay out your card once with the drag-and-drop designer, then reuse it everywhere.",
  },
  {
    n: 3,
    title: "Generate & print",
    body: "Batch-render every card and export a print-ready PDF in a single click.",
  },
];

export default function LandingView() {
  const reduce = useReducedMotion();

  const fadeUp: Variants = {
    initial: { opacity: 0, y: reduce ? 0 : 24 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  const container: Variants = {
    initial: {},
    animate: { transition: { staggerChildren: 0.08 } },
  };

  const float = (delay: number): Variants => ({
    initial: { opacity: 0, y: reduce ? 0 : 24 },
    animate: reduce
      ? { opacity: 1, y: 0 }
      : {
          opacity: 1,
          y: [0, -14, 0],
          transition: {
            y: {
              duration: 6,
              delay,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            },
            opacity: { duration: 0.8, delay },
          },
        },
  });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* ── (a) Sticky glassy top bar ─────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/nxt-mark.png" alt="NXT School" className="h-9 w-auto" />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="btn-secondary hidden sm:inline-flex">
              Sign in
            </Link>
            <Link href="/login" className="btn-primary">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ── (b) Hero ────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:py-24">
            <motion.div
              variants={container}
              initial="initial"
              animate="animate"
              className="relative z-10"
            >
              <motion.span
                variants={fadeUp}
                className="badge gap-1.5 border border-teal-200 bg-teal-50 text-teal-700"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Built for schools
              </motion.span>

              <motion.h1
                variants={fadeUp}
                className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl"
              >
                School ID cards — designed, generated &amp; printed in minutes.
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600"
              >
                Nxt Schools ID gives your school one place to manage students, design
                beautiful cards, and produce print-ready batches — no design skills
                required.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <Link href="/login" className="btn-primary px-5 py-3 text-base">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#how" className="btn-secondary px-5 py-3 text-base">
                  See how it works
                </a>
              </motion.div>

              <motion.p
                variants={fadeUp}
                className="mt-5 flex items-center gap-2 text-sm text-slate-500"
              >
                <ShieldCheck className="h-4 w-4 text-teal-600" />
                Your school data stays private · Set up in minutes.
              </motion.p>
            </motion.div>

            {/* Floating stack of mini cards over a teal gradient blob */}
            <div className="relative mx-auto h-[22rem] w-full max-w-md lg:h-[26rem]">
              <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-teal-300/50 via-cyan-300/40 to-teal-200/30 blur-3xl" />
              </div>

              <motion.div
                variants={float(0)}
                initial="initial"
                animate="animate"
                className="absolute left-0 top-2 -rotate-6"
              >
                <MiniCard
                  name="Ananya Sharma"
                  role="Student · Grade 6"
                  band="#0f766e"
                  photoTint="#ccfbf1"
                />
              </motion.div>

              <motion.div
                variants={float(0.5)}
                initial="initial"
                animate="animate"
                className="absolute right-0 top-24 rotate-3"
              >
                <MiniCard
                  name="Rahul Verma"
                  role="Student · Grade 8"
                  band="#f59e0b"
                  photoTint="#fef3c7"
                />
              </motion.div>

              <motion.div
                variants={float(1)}
                initial="initial"
                animate="animate"
                className="absolute bottom-0 left-8 -rotate-2"
              >
                <MiniCard
                  name="Meera Iyer"
                  role="Staff · Faculty"
                  band="#0ea5e9"
                  photoTint="#e0f2fe"
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── (c) Features grid ───────────────────────────────── */}
        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <motion.div
              variants={fadeUp}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, amount: 0.3 }}
              className="max-w-2xl"
            >
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Everything you need to issue cards
              </h2>
              <p className="mt-3 text-lg text-slate-600">
                From the first student record to the final printed card — one connected
                workflow, built for busy school offices.
              </p>
            </motion.div>

            <motion.div
              variants={container}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, amount: 0.15 }}
              className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {FEATURES.map((f) => (
                <motion.div
                  key={f.title}
                  variants={fadeUp}
                  className="card p-6 transition-shadow duration-150 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── (d) How it works ────────────────────────────────── */}
        <section id="how" className="border-t border-slate-200 bg-slate-50 scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <motion.div
              variants={fadeUp}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, amount: 0.3 }}
              className="max-w-2xl"
            >
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                How it works
              </h2>
              <p className="mt-3 text-lg text-slate-600">
                Three simple steps from spreadsheet to printed card.
              </p>
            </motion.div>

            <motion.ol
              variants={container}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, amount: 0.2 }}
              className="mt-12 grid gap-6 md:grid-cols-3"
            >
              {STEPS.map((s) => (
                <motion.li key={s.n} variants={fadeUp} className="card relative p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white shadow-sm">
                    {s.n}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </motion.li>
              ))}
            </motion.ol>
          </div>
        </section>

        {/* ── (e) CTA band ────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800">
          <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-16 h-[32rem] w-[32rem] rounded-full bg-cyan-400/20 blur-3xl" />
          <motion.div
            variants={fadeUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.4 }}
            className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center sm:px-6 lg:py-20"
          >
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Start issuing cards today
            </h2>
            <p className="mt-4 max-w-xl text-lg text-teal-50">
              Set up your branches, design a template, and generate your first batch of
              student ID cards in a single sitting.
            </p>
            <Link
              href="/login"
              className="btn-secondary mt-8 px-5 py-3 text-base font-semibold"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </section>
      </main>

      {/* ── (f) Footer ────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6">
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/nxt-mark.png" alt="NXT School" className="h-8 w-auto" />
          </div>
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} NXT School. All rights reserved.
          </p>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/login"
              className="font-medium text-slate-500 transition-colors duration-150 hover:text-teal-700"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="font-medium text-slate-500 transition-colors duration-150 hover:text-teal-700"
            >
              Get started
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
