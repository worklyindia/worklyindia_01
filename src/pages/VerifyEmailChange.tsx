import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const VerifyEmailChange = () => {
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const verifyEmailChange = async () => {
      try {
        // Get the hash from the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        console.log('Verification params:', { accessToken: !!accessToken, type });

        if (!accessToken || type !== 'email_change') {
          setError("Invalid or expired verification link. Please request a new email change.");
          setVerifying(false);
          return;
        }

        // The token is automatically handled by Supabase
        // Just verify the session
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        console.log('User verification:', { user: !!user, error: userError });

        if (userError || !user) {
          setError("Failed to verify email change. The link may have expired.");
          setVerifying(false);
          return;
        }

        setSuccess(true);
        toast({
          title: "✅ Email Changed Successfully",
          description: "Your email address has been updated. Please use your new email for future logins.",
        });

        // Redirect after 5 seconds with countdown
        setTimeout(() => {
          navigate("/settings");
        }, 5000);
      } catch (err: any) {
        console.error("Error verifying email change:", err);
        setError(err.message || "An unexpected error occurred during verification");
      } finally {
        setVerifying(false);
      }
    };

    verifyEmailChange();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold">Email Verification</CardTitle>
          <CardDescription className="text-base">
            {verifying && "Verifying your new email address..."}
            {success && "Your email has been successfully changed"}
            {error && "Verification failed"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 py-6">
          {verifying && (
            <>
              <div className="relative">
                <Loader2 className="h-20 w-20 animate-spin text-primary" />
                <div className="absolute inset-0 h-20 w-20 rounded-full border-4 border-primary/20 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-medium">Verifying your email...</p>
                <p className="text-sm text-muted-foreground">This will only take a moment</p>
              </div>
            </>
          )}

          {success && (
            <>
              <div className="relative">
                <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-4 animate-in zoom-in duration-500">
                  <CheckCircle className="h-20 w-20 text-green-600 dark:text-green-500" />
                </div>
                <div className="absolute inset-0 rounded-full bg-green-400/20 animate-ping" />
              </div>
              <div className="text-center space-y-3">
                <h3 className="font-bold text-2xl text-green-600 dark:text-green-500">
                  Success! 🎉
                </h3>
                <p className="font-semibold text-lg text-foreground">
                  Email Changed Successfully!
                </p>
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-green-900 dark:text-green-100">
                    ✓ Your email address has been updated
                  </p>
                  <p className="text-sm text-green-900 dark:text-green-100">
                    ✓ You can now use your new email to log in
                  </p>
                  <p className="text-sm text-green-900 dark:text-green-100">
                    ✓ All your data has been preserved
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Redirecting you to settings in a few seconds...
                </p>
              </div>
              <Button 
                onClick={() => navigate("/settings")} 
                className="mt-4 w-full"
                size="lg"
              >
                Go to Settings Now
              </Button>
            </>
          )}

          {error && (
            <>
              <div className="relative">
                <XCircle className="h-20 w-20 text-destructive" />
              </div>
              <div className="text-center space-y-3">
                <p className="font-bold text-xl text-destructive">Verification Failed</p>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <p className="text-sm text-foreground font-medium">{error}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-yellow-900 dark:text-yellow-100">
                    <strong>Common reasons:</strong>
                  </p>
                  <ul className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside text-left">
                    <li>The verification link has expired</li>
                    <li>The link has already been used</li>
                    <li>The link was copied incorrectly</li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  Please try changing your email again from settings to receive a new verification link.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4 w-full">
                <Button 
                  variant="outline" 
                  onClick={() => navigate("/settings")} 
                  className="flex-1"
                  size="lg"
                >
                  Back to Settings
                </Button>
                <Button 
                  onClick={() => window.location.reload()} 
                  className="flex-1"
                  size="lg"
                >
                  Try Again
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmailChange;
