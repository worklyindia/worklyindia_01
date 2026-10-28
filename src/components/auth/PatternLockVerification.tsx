import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Grid3X3, Loader2, CheckCircle, AlertTriangle, Smartphone, Send, Fingerprint } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';
import { PatternLockGrid } from './PatternLockGrid';
import { supabase } from '@/integrations/supabase/client';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';

interface PatternLockVerificationProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  userId: string;
  userType: 'job_seeker' | 'employer';
  telegramConnected?: boolean;
  totpEnabled?: boolean;
  passkeyEnabled?: boolean;
  onSwitchToTelegram?: () => void;
  onSwitchToGoogleAuth?: () => void;
  onSwitchToPasskey?: () => void;
}

export const PatternLockVerification: React.FC<PatternLockVerificationProps> = ({
  open,
  onClose,
  onVerified,
  userId,
  userType,
  telegramConnected = false,
  totpEnabled = false,
  passkeyEnabled = false,
  onSwitchToTelegram,
  onSwitchToGoogleAuth,
  onSwitchToPasskey,
}) => {
  const { toast } = useToast();
  const { tapFeedback, successFeedback, errorFeedback } = useNativeFeel();
  const { isIOS, buttonClass } = usePlatformStyle();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 300; // 5 minutes in seconds

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsVerified(false);
      setError(null);
      setAttempts(0);
      setIsLoading(false);
    }
  }, [open]);

  // Lockout timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer((prev) => {
          if (prev <= 1) {
            setIsLocked(false);
            setAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const formatLockoutTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePatternComplete = async (pattern: string) => {
    if (isLoading || isLocked) return;

    const dots = pattern.split(',');
    if (dots.length < 4) {
      setError('Pattern too short. Use at least 4 dots.');
      errorFeedback();
      return;
    }

    setIsLoading(true);
    setError(null);
    tapFeedback();

    try {
      const { data, error: verifyError } = await supabase.functions.invoke('unified-2fa', {
        body: {
          action: 'pattern-verify',
          userId,
          userType,
          patternSequence: pattern,
        },
      });

      if (verifyError) throw verifyError;

      if (data?.verified) {
        setIsVerified(true);
        successFeedback();
        toast({
          title: 'Verified!',
          description: 'Pattern authentication successful',
        });
        setTimeout(() => {
          onVerified();
        }, 800);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= MAX_ATTEMPTS) {
          setIsLocked(true);
          setLockoutTimer(LOCKOUT_DURATION);
          setError(`Too many failed attempts. Try again in ${formatLockoutTime(LOCKOUT_DURATION)}.`);
        } else {
          setError(`Wrong pattern. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
        }
        errorFeedback();
      }
    } catch (err: any) {
      console.error('Pattern verification error:', err);
      setError(err.message || 'Verification failed. Please try again.');
      errorFeedback();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      tapFeedback();
      onClose();
    }
  };

  // Check for alternative methods
  const hasAlternatives = telegramConnected || totpEnabled || passkeyEnabled;

  return (
    <NativeBottomSheet
      isOpen={open}
      onClose={handleClose}
      height="auto"
    >
      <div className="flex flex-col items-center animate-fade-in pb-6">
        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${
          isVerified 
            ? 'bg-green-500 scale-110' 
            : isLocked
              ? 'bg-destructive'
              : 'bg-orange-500'
        }`}>
          {isVerified ? (
            <CheckCircle className="w-10 h-10 text-white animate-scale-in" />
          ) : isLocked ? (
            <AlertTriangle className="w-10 h-10 text-white" />
          ) : (
            <Grid3X3 className="w-10 h-10 text-white" />
          )}
        </div>

        {/* Title */}
        <h2 className={`text-xl font-bold mb-2 ${isIOS ? 'font-semibold' : 'font-bold'}`}>
          {isVerified 
            ? 'Verified!' 
            : isLocked 
              ? 'Account Locked' 
              : 'Draw Your Pattern'
          }
        </h2>

        {/* Description */}
        <p className="text-center text-muted-foreground mb-6">
          {isVerified ? (
            <span className="text-green-600 font-medium">Logging you in now...</span>
          ) : isLocked ? (
            <span className="text-destructive">
              Please wait {formatLockoutTime(lockoutTimer)} before trying again
            </span>
          ) : (
            'Draw your pattern to verify your identity'
          )}
        </p>

        {/* Pattern Grid */}
        {!isVerified && !isLocked && (
          <div className="mb-6">
            <PatternLockGrid
              onPatternComplete={handlePatternComplete}
              disabled={isLoading}
              error={!!error}
              size="md"
            />
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-2 mb-4">
            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
            <span className="text-muted-foreground font-medium">Verifying...</span>
          </div>
        )}

        {/* Error Message */}
        {error && !isLocked && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 rounded-xl text-destructive w-full max-w-xs animate-fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Attempts indicator */}
        {!isVerified && !isLocked && attempts > 0 && (
          <div className="flex items-center gap-2 mb-4">
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < attempts ? 'bg-destructive' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        )}

        {/* Switch to other 2FA methods */}
        {!isVerified && hasAlternatives && (
          <div className="space-y-2 w-full max-w-xs mt-4">
            {onSwitchToPasskey && passkeyEnabled && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                onClick={() => {
                  tapFeedback();
                  onSwitchToPasskey();
                }}
                disabled={isLoading}
              >
                <Fingerprint className="w-4 h-4 mr-2" />
                Switch to Passkey
              </Button>
            )}
            
            {onSwitchToGoogleAuth && totpEnabled && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-primary hover:bg-primary/5"
                onClick={() => {
                  tapFeedback();
                  onSwitchToGoogleAuth();
                }}
                disabled={isLoading}
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Switch to Google Authenticator
              </Button>
            )}

            {onSwitchToTelegram && telegramConnected && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                onClick={() => {
                  tapFeedback();
                  onSwitchToTelegram();
                }}
                disabled={isLoading}
              >
                <Send className="w-4 h-4 mr-2" />
                Switch to Telegram OTP
              </Button>
            )}
          </div>
        )}

        {/* Cancel button */}
        {!isVerified && (
          <Button
            variant="ghost"
            className="mt-4 text-muted-foreground"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}

        {/* Help text */}
        {!isVerified && !isLocked && (
          <div className="mt-6 p-4 bg-muted/50 rounded-xl text-center max-w-xs">
            <p className="text-xs text-muted-foreground">
              Draw the pattern you set up during 2FA configuration.
              If you've forgotten it, you can use recovery codes or another 2FA method.
            </p>
          </div>
        )}
      </div>
    </NativeBottomSheet>
  );
};
