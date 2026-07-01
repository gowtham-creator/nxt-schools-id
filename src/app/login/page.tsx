import LoginView from "./LoginView";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; redirect?: string }>;
}) {
  const sp = await searchParams;
  return <LoginView error={sp.error} message={sp.message} />;
}
