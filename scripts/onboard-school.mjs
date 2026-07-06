// Onboard a new school as a fresh tenant: schools row, super-admin login,
// current academic year. Run seed-standard-templates.mjs AFTER this so the
// school gets its six auto-branding templates + defaults.
//
// Usage: node scripts/onboard-school.mjs "School Name" admin@email.com "Password" ["Address"] ["Phone"]

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function env(key) {
  if (process.env[key]) return process.env[key];
  const txt = readFileSync(resolve(root, ".env.local"), "utf8");
  const m = txt.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) throw new Error(`Missing env ${key}`);
  return m[1].trim();
}
const URL_ = env("NEXT_PUBLIC_SUPABASE_URL");
const KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function q(path, opts = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path}: ${t}`);
  return t ? JSON.parse(t) : null;
}

const [name, email, password, address = "", phone = ""] = process.argv.slice(2);
if (!name || !email || !password) {
  console.error('Usage: node scripts/onboard-school.mjs "School Name" admin@email.com "Password" ["Address"] ["Phone"]');
  process.exit(1);
}

// 1) School row (idempotent by name)
let school = (await q(`schools?name=eq.${encodeURIComponent(name)}&select=id,name`))[0];
if (!school) {
  const short = name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 6);
  school = (
    await q("schools", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ name, short_name: short, address: address || null, phone: phone || null, academic_year: "2026-27" }),
    })
  )[0];
  console.log("school created:", school.id);
} else {
  console.log("school exists:", school.id);
}

// 2) Super-admin auth user
const users = await fetch(`${URL_}/auth/v1/admin/users?per_page=100`, { headers: H }).then((r) => r.json());
let user = (users.users ?? users).find((u) => u.email === email);
if (!user) {
  const res = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: `${name} Admin` } }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`createUser: ${res.status} ${JSON.stringify(body)}`);
  user = body;
  console.log("auth user created:", user.id);
} else {
  // ensure the password is what we say it is
  await fetch(`${URL_}/auth/v1/admin/users/${user.id}`, { method: "PUT", headers: H, body: JSON.stringify({ password }) });
  console.log("auth user exists (password reset):", user.id);
}

// 3) app_users profile → this school, super_admin (trigger may have inserted a row already)
const existing = (await q(`app_users?id=eq.${user.id}&select=id`))[0];
if (existing) {
  await q(`app_users?id=eq.${user.id}`, {
    method: "PATCH",
    body: JSON.stringify({ school_id: school.id, role: "admin", full_name: `${name} Admin` }),
  });
} else {
  await q("app_users", {
    method: "POST",
    body: JSON.stringify({ id: user.id, school_id: school.id, role: "admin", full_name: `${name} Admin` }),
  });
}
console.log("profile linked: super_admin @", name);

// 4) Current academic year (idempotent)
const yr = (await q(`academic_years?school_id=eq.${school.id}&name=eq.2026-27&select=id`))[0];
if (!yr) {
  await q("academic_years", {
    method: "POST",
    body: JSON.stringify({ school_id: school.id, name: "2026-27", start_date: "2026-06-01", end_date: "2027-04-30", is_current: true }),
  });
  console.log("academic year 2026-27 created (current)");
}

console.log("\n=== ONBOARDED ===");
console.log("School:", name, `(${school.id})`);
console.log("Login :", email);
console.log("Pass  :", password);
console.log("\nNext: node scripts/seed-standard-templates.mjs   (gives this school its 6 templates + defaults)");
