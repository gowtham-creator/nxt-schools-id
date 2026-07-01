import { login, signup } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; redirect?: string }>;
}) {
  const sp = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-slate-900">Nxt Schools ID</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to manage ID cards</p>

        {sp.error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</p>
        ) : null}
        {sp.message ? (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{sp.message}</p>
        ) : null}

        <form className="mt-6 space-y-4">
          <div>
            <label htmlFor="full_name" className="field-label">
              Full name <span className="text-slate-400">(sign up only)</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="password" className="field-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="field-input"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              formAction={login}
              className="btn-primary flex-1"
            >
              Sign in
            </button>
            <button
              formAction={signup}
              className="btn-secondary flex-1"
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
