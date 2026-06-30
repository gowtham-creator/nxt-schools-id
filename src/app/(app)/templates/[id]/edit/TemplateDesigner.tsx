"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CardSide, { type CardSideData } from "@/lib/card-render";
import { DISPLAY_K, buildPreviewData, clamp, newElement, snap } from "@/lib/designer/geometry";
import { BINDABLE_FIELDS } from "@/lib/constants";
import { saveTemplate } from "../../actions";
import type {
  IdTemplate,
  School,
  TemplateElement,
  TemplateElementType,
  TemplateSide,
} from "@/lib/types";

type SideKey = "front" | "back";
const inp =
  "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-900";

const PALETTE: { type: TemplateElementType; label: string; icon: string }[] = [
  { type: "field", label: "Field", icon: "≡" },
  { type: "text", label: "Text", icon: "T" },
  { type: "image", label: "Image", icon: "▣" },
  { type: "qr", label: "QR", icon: "▦" },
  { type: "barcode", label: "Barcode", icon: "|||" },
  { type: "rect", label: "Shape", icon: "▮" },
];
const IMAGE_BINDINGS = [
  { value: "photo_url", label: "Member photo" },
  { value: "logo", label: "School logo" },
];
const CODE_BINDINGS = [
  { value: "qr_token", label: "Verify QR (qr_token)" },
  { value: "identifier", label: "Admission / Emp ID" },
  { value: "roll_no", label: "Roll No" },
];

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
function NumField({
  label,
  value,
  step = 0.5,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <Labeled label={label}>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={inp}
      />
    </Labeled>
  );
}

export default function TemplateDesigner({
  template,
  school,
}: {
  template: IdTemplate;
  school: Partial<School> | null;
}) {
  const W = template.width_mm;
  const H = template.height_mm;
  const [name, setName] = useState(template.name);
  const [side, setSide] = useState<SideKey>("front");
  const [sides, setSides] = useState<{ front: TemplateSide; back: TemplateSide }>({
    front: template.front,
    back: template.back,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dragging = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fitK, setFitK] = useState(DISPLAY_K);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const recompute = () => {
      const cw = node.clientWidth - 48;
      const ch = node.clientHeight - 48;
      setFitK(Math.max(2, Math.min(DISPLAY_K, cw / W, ch / H)));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const current = sides[side];
  const selected = current.elements.find((e) => e.id === selectedId) ?? null;
  const data: CardSideData = buildPreviewData(current, { logo: school?.logo_url ?? null });
  const px = (mm: number) => mm * fitK;

  const mutateSide = useCallback(
    (fn: (s: TemplateSide) => TemplateSide) => {
      setSides((prev) => ({ ...prev, [side]: fn(prev[side]) }));
      setDirty(true);
    },
    [side],
  );
  const patchEl = useCallback(
    (id: string, patch: Partial<TemplateElement>) =>
      mutateSide((s) => ({
        ...s,
        elements: s.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),
    [mutateSide],
  );

  function addEl(type: TemplateElementType) {
    const el = newElement(type);
    mutateSide((s) => ({ ...s, elements: [...s.elements, el] }));
    setSelectedId(el.id);
  }
  function removeEl(id: string) {
    mutateSide((s) => ({ ...s, elements: s.elements.filter((e) => e.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }
  function reorder(id: string, dir: -1 | 1) {
    mutateSide((s) => {
      const i = s.elements.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.elements.length) return s;
      const els = [...s.elements];
      [els[i], els[j]] = [els[j], els[i]];
      return { ...s, elements: els };
    });
  }

  function startDrag(e: React.PointerEvent, el: TemplateElement, mode: "move" | "resize") {
    if (el.locked) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(el.id);
    dragging.current = true;
    const sx = e.clientX;
    const sy = e.clientY;
    const o = { x: el.x, y: el.y, w: el.w, h: el.h };
    const id = el.id;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / fitK;
      const dy = (ev.clientY - sy) / fitK;
      if (mode === "move") {
        patchEl(id, { x: snap(clamp(o.x + dx, 0, W - 2)), y: snap(clamp(o.y + dy, 0, H - 2)) });
      } else {
        patchEl(id, { w: snap(clamp(o.w + dx, 2, W - o.x)), h: snap(clamp(o.h + dy, 2, H - o.y)) });
      }
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function onSave() {
    setSaving(true);
    const res = await saveTemplate(template.id, { name, front: sides.front, back: sides.back });
    setSaving(false);
    if (res.ok) setDirty(false);
    else alert(res.error ?? "Save failed");
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-49px)] flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <Link href="/templates" className="text-sm text-slate-500 hover:underline">← Templates</Link>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setDirty(true); }}
          className="w-60 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium outline-none focus:border-slate-900"
        />
        <div className="ml-1 inline-flex rounded-md border border-slate-300 p-0.5 text-sm">
          {(["front", "back"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setSide(s); setSelectedId(null); }}
              className={`rounded px-3 py-1 capitalize ${side === s ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className={`text-xs ${dirty ? "text-amber-600" : "text-emerald-600"}`}>
            {dirty ? "Unsaved changes" : "Saved"}
          </span>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left: palette + layers */}
        <div className="w-52 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Add element</p>
          <div className="grid grid-cols-2 gap-2">
            {PALETTE.map((p) => (
              <button
                key={p.type}
                onClick={() => addEl(p.type)}
                className="flex flex-col items-center gap-1 rounded-md border border-slate-200 py-2 text-xs text-slate-600 hover:border-slate-900 hover:text-slate-900"
              >
                <span className="text-base leading-none">{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Layers ({current.elements.length})
          </p>
          <div className="space-y-1">
            {current.elements.length === 0 && <p className="text-xs text-slate-400">Nothing on this side yet.</p>}
            {[...current.elements].reverse().map((el) => (
              <div
                key={el.id}
                onClick={() => setSelectedId(el.id)}
                className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs ${
                  selectedId === el.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="capitalize">{el.type}</span>
                <span className="truncate opacity-70">
                  {el.type === "field" ? el.field : el.type === "text" ? el.text : el.type === "image" ? el.src : el.value}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeEl(el.id); }}
                  className={`ml-auto ${selectedId === el.id ? "text-white/70" : "text-slate-400"} hover:text-red-400`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Center: canvas */}
        <div ref={wrapRef} className="flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-slate-200 p-6">
          <div
            className="relative shadow-lg ring-1 ring-slate-300"
            style={{ width: px(W), height: px(H) }}
            onPointerDown={() => setSelectedId(null)}
          >
            <CardSide side={current} data={data} widthMm={W} heightMm={H} scale={fitK} />
            <div className="absolute inset-0">
              {current.elements.map((el) => {
                const isSel = el.id === selectedId;
                return (
                  <div
                    key={el.id}
                    onPointerDown={(e) => startDrag(e, el, "move")}
                    style={{
                      position: "absolute",
                      left: px(el.x),
                      top: px(el.y),
                      width: px(el.w),
                      height: px(el.h),
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      transformOrigin: "center center",
                      cursor: el.locked ? "default" : "move",
                      outline: isSel ? "2px solid #2563eb" : "1px dashed rgba(100,116,139,0.45)",
                      outlineOffset: "-1px",
                    }}
                  >
                    {(el.type === "qr" || el.type === "barcode") && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] uppercase text-slate-400">
                        {el.type}
                      </span>
                    )}
                    {isSel && !el.locked && (
                      <div
                        onPointerDown={(e) => startDrag(e, el, "resize")}
                        style={{
                          position: "absolute",
                          right: -5,
                          bottom: -5,
                          width: 10,
                          height: 10,
                          background: "#2563eb",
                          borderRadius: 2,
                          cursor: "nwse-resize",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: properties */}
        <div className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
          {!selected ? (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-700">Card side</p>
              <p className="text-xs text-slate-400">Select an element to edit it, or set the side background.</p>
              <Labeled label="Background colour">
                <input
                  type="color"
                  value={current.background?.startsWith("#") ? current.background : "#ffffff"}
                  onChange={(e) => mutateSide((s) => ({ ...s, background: e.target.value }))}
                  className="mt-1 h-9 w-full rounded border border-slate-300"
                />
              </Labeled>
              <Labeled label="Background image URL">
                <input
                  value={current.background && !current.background.startsWith("#") ? current.background : ""}
                  onChange={(e) => mutateSide((s) => ({ ...s, background: e.target.value || "#ffffff" }))}
                  placeholder="https://… (optional)"
                  className={inp}
                />
              </Labeled>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold capitalize text-slate-700">{selected.type}</p>
                <div className="flex gap-1 text-xs">
                  <button onClick={() => reorder(selected.id, 1)} title="Bring forward" className="rounded border border-slate-200 px-2 py-0.5">↑</button>
                  <button onClick={() => reorder(selected.id, -1)} title="Send back" className="rounded border border-slate-200 px-2 py-0.5">↓</button>
                  <button onClick={() => removeEl(selected.id)} className="rounded border border-red-200 px-2 py-0.5 text-red-600">Delete</button>
                </div>
              </div>

              {selected.type === "field" && (
                <Labeled label="Bind to field">
                  <select value={selected.field ?? ""} onChange={(e) => patchEl(selected.id, { field: e.target.value })} className={inp}>
                    {BINDABLE_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </Labeled>
              )}
              {selected.type === "text" && (
                <Labeled label="Text">
                  <input value={selected.text ?? ""} onChange={(e) => patchEl(selected.id, { text: e.target.value })} className={inp} />
                </Labeled>
              )}
              {selected.type === "image" && (
                <div className="space-y-1">
                  <Labeled label="Image source">
                    <select
                      value={IMAGE_BINDINGS.some((b) => b.value === selected.src) ? selected.src : "custom"}
                      onChange={(e) => patchEl(selected.id, { src: e.target.value === "custom" ? "" : e.target.value })}
                      className={inp}
                    >
                      {IMAGE_BINDINGS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                      <option value="custom">Custom URL…</option>
                    </select>
                  </Labeled>
                  {!IMAGE_BINDINGS.some((b) => b.value === selected.src) && (
                    <input value={selected.src ?? ""} onChange={(e) => patchEl(selected.id, { src: e.target.value })} placeholder="https://…" className={inp} />
                  )}
                </div>
              )}
              {(selected.type === "qr" || selected.type === "barcode") && (
                <Labeled label="Encode">
                  <select value={selected.value ?? ""} onChange={(e) => patchEl(selected.id, { value: e.target.value })} className={inp}>
                    {CODE_BINDINGS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </Labeled>
              )}

              {(selected.type === "text" || selected.type === "field") && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="Font size (pt)" value={selected.fontSize ?? 10} step={0.5} onChange={(v) => patchEl(selected.id, { fontSize: v })} />
                    <Labeled label="Weight">
                      <select value={String(selected.fontWeight ?? 400)} onChange={(e) => patchEl(selected.id, { fontWeight: Number(e.target.value) })} className={inp}>
                        <option value="400">Regular</option>
                        <option value="600">Semibold</option>
                        <option value="700">Bold</option>
                      </select>
                    </Labeled>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Labeled label="Colour">
                      <input type="color" value={selected.color ?? "#0f172a"} onChange={(e) => patchEl(selected.id, { color: e.target.value })} className="mt-1 h-9 w-full rounded border border-slate-300" />
                    </Labeled>
                    <Labeled label="Align">
                      <select value={selected.align ?? "left"} onChange={(e) => patchEl(selected.id, { align: e.target.value as "left" | "center" | "right" })} className={inp}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </Labeled>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={!!selected.uppercase} onChange={(e) => patchEl(selected.id, { uppercase: e.target.checked })} />
                    Uppercase
                  </label>
                </>
              )}

              {selected.type === "rect" && (
                <div className="grid grid-cols-2 gap-2">
                  <Labeled label="Fill">
                    <input type="color" value={selected.fill ?? "#1e3a8a"} onChange={(e) => patchEl(selected.id, { fill: e.target.value })} className="mt-1 h-9 w-full rounded border border-slate-300" />
                  </Labeled>
                  <NumField label="Radius (mm)" value={selected.radius ?? 0} step={0.5} onChange={(v) => patchEl(selected.id, { radius: v })} />
                </div>
              )}

              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Position &amp; size (mm)</p>
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="X" value={selected.x} onChange={(v) => patchEl(selected.id, { x: v })} />
                  <NumField label="Y" value={selected.y} onChange={(v) => patchEl(selected.id, { y: v })} />
                  <NumField label="Width" value={selected.w} onChange={(v) => patchEl(selected.id, { w: v })} />
                  <NumField label="Height" value={selected.h} onChange={(v) => patchEl(selected.id, { h: v })} />
                  <NumField label="Rotation°" value={selected.rotation ?? 0} step={1} onChange={(v) => patchEl(selected.id, { rotation: v })} />
                  <NumField label="Opacity" value={selected.opacity ?? 1} step={0.1} onChange={(v) => patchEl(selected.id, { opacity: clamp(v, 0, 1) })} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
