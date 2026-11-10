import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import Lottie from "lottie-react";
import SEO from "@/components/SEO";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND_CONFIG } from "@/config/brandConfig";
import notFoundAnimation from "@/assets/lottie/404-page-not-found.json";
import { setOn404 } from "@/utils/notFoundSignal";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
    setOn404(true);
    return () => setOn404(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-destructive/5 to-background relative overflow-hidden">
      <SEO
        title="404 - Page Not Found"
        description={`The page you're looking for doesn't exist. Return to ${BRAND_CONFIG.name} to find remote jobs.`}
        noindex={true}
      />

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-destructive/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 flex items-center justify-center min-h-screen">
        <div className="text-center max-w-3xl">
          {/* Lottie 404 Animation */}
          <div className="mb-4 mx-auto w-full max-w-md md:max-w-lg">
            <Lottie animationData={notFoundAnimation} loop autoplay />
          </div>

          {/* Error Message */}
          <div className="space-y-4 mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Oops! Page Not Found
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
              Looks like this page has gone off the job market. Don't worry—we'll help you get back to finding the right opportunities.
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-destructive/10 rounded-full text-sm text-destructive font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
              </span>
              Requested URL: <code className="font-mono">{location.pathname}</code>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-center mb-12">
            <Button
              asChild
              variant="default"
              size="lg"
              className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Link to="/" className="flex items-center gap-2">
                <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Back to Home
                <ArrowLeft className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
              </Link>
            </Button>
          </div>

          {/* Help Text */}
          <p className="mt-8 text-sm text-muted-foreground">
            If you believe this is an error, please{" "}
            <Link to="/contact-us" className="text-primary hover:underline font-semibold">
              contact our support team
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
