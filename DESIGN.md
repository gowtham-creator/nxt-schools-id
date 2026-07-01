# Nxt Schools ID — Design System

Clean, trustworthy **admin SaaS** aesthetic (think Linear/Stripe dashboards), not playful.
Synthesized from ui-ux-pro-max, antigravity-design-expert, frontend-design principles.

## Tokens
- **Font:** Inter (UI, via `--font-inter` → `font-sans`). Poppins stays for the printed cards.
- **Neutral:** slate. Text `slate-900`, secondary `slate-600`, muted `slate-400/500`, borders `slate-200/300`, surfaces `white` on `slate-50` page bg.
- **Brand accent:** teal (`teal-700 #0F766E`, hover `teal-800`, tints `teal-50`). Matches the cards.
- **Semantic:** success `emerald`, danger `red`, warning `amber`, info/pipeline `blue`/`indigo`.
- **Radius:** inputs/buttons `rounded-lg`, cards/tables `rounded-xl`, pills `rounded-full`.
- **Elevation:** `shadow-sm` on cards/inputs; no hard 1px-only edges.
- **Motion:** `transition-colors duration-150`; respect `prefers-reduced-motion`.

## Component classes (defined in `src/app/globals.css`) — USE THESE
| Class | Use for |
|---|---|
| `field-label` | every `<label>` above an input |
| `field-input` | **every** `<input>/<select>/<textarea>` (refined border, hover, teal focus ring, shadow) |
| `field-input-invalid` | add when a field has an error |
| `field-hint` / `field-error` | helper / error text under a field |
| `btn-primary` | primary CTA (teal): Save, Create, Generate, + Add… |
| `btn-secondary` | secondary action (white + border): Cancel, Import, Filter… |
| `btn-ghost` | low-emphasis text button |
| `btn-danger` | destructive (Delete/Remove) |
| `btn-sm` | modifier to shrink a button |
| `card` | white panel container |
| `badge` | status pill (add the color utilities per state) |
| `nav-link` / `nav-link-active` | sidebar links + active state |

## Rules (from the skills)
1. **Every input has a real `<label htmlFor>`** (id/name matched). No placeholder-only fields.
2. **Correct input `type`**: email→`email`, phone→`tel`, dates→`date`, numbers→`number`.
3. **Visible focus** everywhere (the classes bake in a teal ring). Never `outline-none` alone.
4. **cursor-pointer** on all clickable elements (baked into `btn-*`).
5. Contrast ≥ 4.5:1 — body text `slate-600` min, never `slate-400` for content.
6. SVG icons only (Heroicons/Lucide-style inline SVG), never emoji.
7. Consistent page shell: `max-w-*` container, section heading (`text-2xl font-semibold text-slate-900`) + muted subtitle.

## Do NOT
- Reintroduce a dark-mode media query (app is light-only).
- Leave raw `border-slate-300 px-3 py-2` inputs — replace with `field-input`.
- Mix ad-hoc button styles — use the `btn-*` classes.
