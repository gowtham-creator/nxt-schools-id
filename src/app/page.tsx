import LandingView from "./LandingView";

// Public marketing landing. Protected areas live under (app) and guard
// themselves; the middleware allows "/" through for unauthenticated visitors.
export default function Home() {
  return <LandingView />;
}
