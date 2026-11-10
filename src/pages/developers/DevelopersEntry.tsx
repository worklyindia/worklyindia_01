import { lazy, Suspense } from "react";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";
import DeveloperProfileGate from "@/components/developers/DeveloperProfileGate";
import DeveloperLanding from "./DeveloperLanding";

const APIDocumentation = lazy(() => import("@/pages/owner-portal/APIDocumentation"));

/**
 * Entry point for /developers:
 * - Signed-in developers see the full API documentation (previous behaviour).
 * - Everyone else gets a public landing page with INR pricing instead of a login wall,
 *   so the page is useful to visitors and crawlers.
 */
const DevelopersEntry = () => {
  const { user, loading } = useEmployerAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return (
      <DeveloperProfileGate>
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-background">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          }
        >
          <APIDocumentation />
        </Suspense>
      </DeveloperProfileGate>
    );
  }

  return <DeveloperLanding />;
};

export default DevelopersEntry;
