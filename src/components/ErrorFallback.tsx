import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, RefreshCw, Home, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  title?: string;
  description?: string;
  showHomeButton?: boolean;
  showBackButton?: boolean;
}

export const ErrorFallback = ({ 
  error, 
  resetError, 
  title = "Something went wrong",
  description = "We encountered an error while loading this content. Please try again.",
  showHomeButton = true,
  showBackButton = true
}: ErrorFallbackProps) => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
    window.scrollTo(0, 0);
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <p className="text-muted-foreground mb-6">{description}</p>
          
          {error && (
            <details className="mb-6 text-left">
              <summary className="cursor-pointer text-sm text-muted-foreground mb-2">
                Technical Details
              </summary>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                {error.message}
              </pre>
            </details>
          )}
          
          <div className="space-y-2">
            {resetError && (
              <Button onClick={resetError} className="w-full gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            )}
            
            <div className="flex gap-2">
              {showBackButton && (
                <Button 
                  variant="outline" 
                  onClick={handleGoBack} 
                  className="flex-1 gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Go Back
                </Button>
              )}
              {showHomeButton && (
                <Button 
                  variant="outline" 
                  onClick={handleGoHome} 
                  className="flex-1 gap-2"
                >
                  <Home className="w-4 h-4" />
                  Home
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorFallback;