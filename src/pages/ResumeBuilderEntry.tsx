import { lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ResumeBuilderLanding from "./ResumeBuilderLanding";

const ResumeBuilder = lazy(() => import("./ResumeBuilder"));

/**
 * Entry point for /resume-builder:
 * - Signed-in job seekers get the builder, exactly as before.
 * - Everyone else gets a public introduction page instead of a login wall,
 *   so the page is useful to visitors and crawlers.
 */
const ResumeBuilderEntry = () => {
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
        <ResumeBuilder />
      </Suspense>
    );
  }

  return <ResumeBuilderLanding />;
};

export default ResumeBuilderEntry;
