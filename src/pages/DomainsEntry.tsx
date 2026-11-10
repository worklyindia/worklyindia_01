import { lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DomainsLanding from "./DomainsLanding";

const Domains = lazy(() => import("./Domains"));

/**
 * Entry point for /domains:
 * - Signed-in users get the domain dashboard, exactly as before.
 * - Everyone else gets a public introduction page instead of a login wall,
 *   so the page is useful to visitors and crawlers.
 */
const DomainsEntry = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <Domains />
      </Suspense>
    );
  }

  return <DomainsLanding />;
};

export default DomainsEntry;
