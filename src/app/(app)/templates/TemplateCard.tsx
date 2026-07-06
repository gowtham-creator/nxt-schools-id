"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Copy, Pencil, Star, Trash2 } from "lucide-react";
import {
  deleteTemplate,
  duplicateTemplate,
  setDefaultTemplate,
  setSchoolTemplate,
} from "./actions";
import type { IdTemplate } from "@/lib/types";

/** Minimal, plain-serializable slice of a template the card needs to render. */
export type TemplateCardData = Pick<
  IdTemplate,
  "id" | "name" | "member_type" | "is_default" | "width_mm" | "height_mm" | "front" | "back"
>;

/** A tiny submit button rendered inside a per-action <form>. */
function ActionIcon({
  label,
  tone = "default",
  children,
}: {
  label: string;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      aria-label={label}
      title={label}
      className={
        "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 " +
        (tone === "danger"
          ? "text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:ring-red-500/30"
          : "text-slate-500 hover:bg-teal-50 hover:text-teal-700 focus-visible:ring-teal-600/30")
      }
    >
      {children}
    </button>
  );
}

/** A short line placeholder used inside the stylized card mock. */
function Line({ className }: { className: string }) {
  return <div className={"rounded-full " + className} />;
}

/** A small stylized QR square (decorative). */
function QrMock({ className }: { className: string }) {
  return (
    <div
      className={
        "grid grid-cols-3 gap-[1.5px] rounded-[3px] bg-white p-[2px] shadow-sm ring-1 ring-slate-200 " +
        className
      }
      aria-hidden
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className={i % 2 === 0 ? "rounded-[0.5px] bg-slate-700" : "bg-transparent"} />
      ))}
    </div>
  );
}

export default function TemplateCard({
  template,
  logo,
  isSchoolDefault = false,
}: {
  template: TemplateCardData;
  logo?: string | null;
  /** True when this template is the school-wide default for its member_type. */
  isSchoolDefault?: boolean;
}) {
  const reduce = useReducedMotion();

  const isPortrait = template.height_mm > template.width_mm;
  const elementCount = template.front.elements.length + template.back.elements.length;

  // Derive the header-band colour from the first coloured rect on the front,
  // falling back to the brand teal so every preview still reads as a card.
  const rectFill = template.front.elements.find((el) => el.type === "rect" && el.fill)?.fill;
  const bandColor =
    rectFill && !["#ffffff", "#fff", "white"].includes(rectFill.toLowerCase())
      ? rectFill
      : "#0f766e";

  const logoStyle = logo
    ? { backgroundImage: `url("${logo}")`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;

  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.6 }}
      className="card group flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-lg"
    >
      {/* Preview — a stylized card mock (portrait or landscape) */}
      <div className="flex items-center justify-center bg-slate-100 p-5">
        <div
          aria-hidden
          className="w-full overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-slate-900/5"
          style={{
            aspectRatio: `${template.width_mm} / ${template.height_mm}`,
            width: isPortrait ? "58%" : "100%",
          }}
        >
          <div className="flex h-full flex-col">
            {/* Header band */}
            <div
              className="relative flex shrink-0 items-center gap-1.5 px-2"
              style={{ background: bandColor, height: isPortrait ? "16%" : "22%" }}
            >
              <div className="h-1.5 w-1/3 rounded-full bg-white/55" />
              <div
                className="ml-auto h-6 w-6 shrink-0 rounded-md bg-white/90 shadow-sm ring-1 ring-white/60"
                style={logoStyle}
              />
            </div>

            {/* Body */}
            {isPortrait ? (
              <div className="flex flex-1 flex-col items-center px-3 pb-3">
                <div className="-mt-6 h-14 w-14 rounded-full bg-slate-200 shadow-sm ring-2 ring-white" />
                <Line className="mt-2.5 h-2 w-2/3 bg-slate-300" />
                <Line className="mt-1.5 h-1.5 w-1/2 bg-slate-200" />
                <Line className="mt-1.5 h-1.5 w-2/5 bg-slate-200" />
                <QrMock className="mt-auto h-9 w-9" />
              </div>
            ) : (
              <div className="flex flex-1 gap-2.5 p-3">
                <div className="w-[30%] shrink-0 rounded-md bg-slate-200 shadow-sm ring-1 ring-slate-300/60 [aspect-ratio:3/4]" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Line className="h-2 w-3/4 bg-slate-300" />
                  <Line className="mt-1.5 h-1.5 w-1/2 bg-slate-200" />
                  <Line className="mt-1.5 h-1.5 w-2/3 bg-slate-200" />
                  <QrMock className="mt-auto ml-auto h-8 w-8" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meta + actions */}
      <div className="flex flex-1 flex-col">
        <div className="px-4 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="mr-0.5 truncate font-medium text-slate-800">{template.name}</h3>
            <span className="badge shrink-0 bg-slate-100 text-slate-600">
              {template.member_type === "staff" ? "Staff" : "Student"}
            </span>
            {isSchoolDefault && (
              <span className="badge shrink-0 bg-teal-50 text-teal-700">✓ School template</span>
            )}
            {template.is_default && (
              <span className="badge shrink-0 gap-1 bg-teal-50 text-teal-700">
                <Star className="h-3 w-3 fill-current" />
                Default
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {isPortrait ? "Portrait" : "Landscape"} · {template.width_mm}×{template.height_mm} mm ·{" "}
            {elementCount} element{elementCount === 1 ? "" : "s"}
          </p>
        </div>

        {!isSchoolDefault && (
          <form
            action={setSchoolTemplate.bind(null, template.id, template.member_type)}
            className="mt-3 px-4"
          >
            <button type="submit" className="btn-primary btn-sm w-full">
              Use for whole school
            </button>
          </form>
        )}

        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 px-4 py-2.5">
          <Link
            href={`/templates/${template.id}/edit`}
            className="btn-secondary btn-sm gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>

          <div className="ml-auto flex items-center gap-0.5">
            {!template.is_default && (
              <form action={setDefaultTemplate.bind(null, template.id)}>
                <ActionIcon label="Set as default">
                  <Star className="h-4 w-4" />
                </ActionIcon>
              </form>
            )}
            <form action={duplicateTemplate.bind(null, template.id)}>
              <ActionIcon label="Duplicate template">
                <Copy className="h-4 w-4" />
              </ActionIcon>
            </form>
            <form action={deleteTemplate.bind(null, template.id)}>
              <ActionIcon label="Delete template" tone="danger">
                <Trash2 className="h-4 w-4" />
              </ActionIcon>
            </form>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
