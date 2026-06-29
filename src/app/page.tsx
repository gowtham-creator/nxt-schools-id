import { redirect } from "next/navigation";

export default function Home() {
  // Authenticated users land on the dashboard; the middleware bounces
  // unauthenticated visitors to /login.
  redirect("/dashboard");
}
