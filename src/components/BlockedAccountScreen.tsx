import { ShieldBan, AlertTriangle, LogIn, Mail, Fingerprint, Monitor, Globe, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface BlockedAccountScreenProps {
  reason: string;
  originalAccountHint?: string | null;
  matchedSignals?: string[];
  confidenceScore?: number;
}

export const BlockedAccountScreen = ({ reason, originalAccountHint, matchedSignals, confidenceScore }: BlockedAccountScreenProps) => {
  const navigate = useNavigate();

  const handleLoginOriginal = async () => {
    // Sign out current blocked account
    await supabase.auth.signOut();
    // Clear any cached completion status
    try {
      localStorage.removeItem('profile_completion_status');
      localStorage.removeItem('employer_profile_completion_status');
      localStorage.removeItem('last_auto_device_collect');
    } catch {}
    // Redirect to auth page immediately
    window.location.href = '/auth';
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background overflow-y-auto"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
    >
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="max-w-lg w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-destructive/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative w-24 h-24 bg-destructive rounded-full flex items-center justify-center shadow-lg">
              <ShieldBan className="w-12 h-12 text-destructive-foreground" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground">
          Account Blocked
        </h1>

        {/* Warning Badge */}
        <div className="flex items-center justify-center gap-2 text-destructive font-medium">
          <AlertTriangle className="w-5 h-5" />
          <span>Duplicate Account Detected</span>
        </div>

        {/* Why blocked */}
        <div className="bg-muted/50 rounded-xl p-4 text-left space-y-3">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            Why was your account blocked?
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Our system detected that you already have an existing account. Each person is only allowed <strong className="text-foreground">one account</strong> on this platform. Creating multiple accounts is not permitted.
          </p>
        </div>


        {/* Original Account Hint - always show if available */}
        {originalAccountHint && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-left">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Your existing account</span>
            </div>
            <p className="text-sm text-muted-foreground">
              We found your original account: <strong className="text-foreground">{originalAccountHint}</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Please log out and sign in with this account instead.
            </p>
          </div>
        )}

        {/* What you can do */}
        <div className="bg-muted/30 rounded-xl p-4 text-left space-y-2">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            What can you do?
          </h3>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Log out and sign in with your original account</li>
            <li>If you deleted your old account, you can create a new one — the block will be removed automatically</li>
            <li>Contact support if you believe this is an error</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={handleLoginOriginal}
            size="lg"
            variant="default"
            className="min-w-[180px]"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Log In to Original Account
          </Button>
        </div>

        {/* Support */}
        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            Need help? <a href="/contact" className="text-primary font-medium hover:underline">Contact our support team</a> for assistance.
          </p>
        </div>
        </div>
      </div>
    </div>
  );
};
