import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, RefreshCw, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { useWebOTP } from '@/hooks/useWebOTP';
import { distributeOtpDigits, readPastedOtp } from '@/utils/otpInput';

interface PushOTPVerificationProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  userId: string;
  userType: 'job_seeker' | 'employer';
  multipleMethodsEnabled?: boolean;
  onShowMethodSelection?: () => void;
}

export const PushOTPVerification: React.FC<PushOTPVerificationProps> = ({
  open,
  onClose,
  onVerified,
  userId,
  userType,
  multipleMethodsEnabled = false,
  onShowMethodSelection,
}) => {
  const { toast } = useToast();
  const { tapFeedback, successFeedback, errorFeedback } = useNativeFeel();
  const { isIOS, isAndroid, buttonClass } = usePlatformStyle();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Send OTP and start polling when opened
  useEffect(() => {
    if (open && !isVerified && !otpSent) {
      sendPushOTP();
    }
    
    return () => {
      // Cleanup polling on unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setOtp(['', '', '', '', '', '']);
      setIsVerified(false);
      setOtpSent(false);
      setCanResend(false);
      setResendTimer(60);
      setError(null);
      setIsPolling(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    }
  }, [open]);

  // Resend timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0 && !canResend && otpSent) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer, canResend, otpSent]);

  // Start polling for approval
  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    setIsPolling(true);
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('unified-2fa', {
          body: { action: 'verify-push-approval', userId, userType, subAction: 'check' }
        });

        if (data?.approved) {
          // Stop polling and verify
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setIsPolling(false);
          setIsVerified(true);
          successFeedback();
          toast({
            title: "Verified!",
            description: "Login approved via push notification",
          });
          setTimeout(() => {
            onVerified();
          }, 800);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 10000); // Poll less often to protect free-plan function usage
  };

  const sendPushOTP = async () => {
    setIsSending(true);
    tapFeedback();
    try {
      const { data, error } = await supabase.functions.invoke('unified-2fa', {
        body: { action: 'send-push-otp', userId, userType }
      });

      if (error) {
        const details = error instanceof FunctionsHttpError
          ? await error.context.json().catch(() => null)
          : null;
        throw new Error(details?.error || error.message);
      }

      // Check if rate limited
      if (data?.remainingCooldown && !data?.success) {
        setResendTimer(data.remainingCooldown);
        setCanResend(false);
        setOtpSent(true);
        toast({
          title: "Please Wait",
          description: `You can resend in ${data.remainingCooldown} seconds`,
          variant: "destructive",
        });
        return;
      }

      setOtpSent(true);
      setResendTimer(data?.remainingCooldown || 60);
      setCanResend(false);
      successFeedback();
      
      // Start polling for approval button clicks
      startPolling();
      
      toast({
        title: "Push Notification Sent",
        description: "Check your device for OTP or tap 'Approve Login'",
      });
    } catch (error: any) {
      console.error('Error sending push OTP:', error);
      errorFeedback();
      toast({
        title: "Error",
        description: error?.message || "Failed to send push notification",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    tapFeedback();
    await sendPushOTP();
  };

  // Auto-fill OTP from SMS via Chrome WebOTP prompt
  useWebOTP((code) => {
    const digits = code.padEnd(6, '').slice(0, 6).split('');
    setOtp(digits);
    if (code.length === 6) verifyOTP(code);
  }, open && otpSent && !isVerified);

  const applyOtpDigits = (startIndex: number, raw: string) => {
    const { otp: newOtp, focusIndex } = distributeOtpDigits(otp, startIndex, raw);
    tapFeedback();
    setOtp(newOtp);
    setError(null);
    inputRefs.current[focusIndex]?.focus();

    const code = newOtp.join('');
    if (code.length === 6 && newOtp.every(digit => digit !== '')) {
      verifyOTP(code);
    }
  };

  const handleInputChange = (index: number, value: string) => {
    applyOtpDigits(index, value);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = readPastedOtp(e, 6);
    if (pastedData) applyOtpDigits(0, pastedData);
  };

  const verifyOTP = async (code: string) => {
    setIsLoading(true);
    setError(null);
    
    // Stop polling while verifying
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    try {
      // Use unified-2fa for OTP verification
      const { data, error: verifyError } = await supabase.functions.invoke('unified-2fa', {
        body: { action: 'verify-push-approval', subAction: 'verify', userId, code, userType }
      });

      if (verifyError) throw verifyError;

      if (data?.verified) {
        setIsVerified(true);
        successFeedback();
        toast({
          title: "Verified!",
          description: "Two-factor authentication successful",
        });
        setTimeout(() => {
          onVerified();
        }, 800);
      } else {
        setError(data?.error || "Invalid OTP. Please try again.");
        errorFeedback();
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        // Resume polling
        startPolling();
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError("Verification failed. Please try again.");
      errorFeedback();
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      // Resume polling
      startPolling();
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

  const getOtpInputClass = (index: number, hasValue: boolean) => {
    const baseClass = "text-center text-xl font-bold transition-all duration-200";
    const sizeClass = "w-11 h-14 sm:w-12 sm:h-16";
    
    const platformClass = isIOS
      ? `rounded-xl border-2 ${hasValue ? 'border-primary bg-primary/5' : 'border-border bg-background'} focus:border-primary focus:ring-0 active:scale-95`
      : isAndroid
      ? `rounded-lg border-b-2 border-t-0 border-l-0 border-r-0 ${hasValue ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 bg-muted/30'} focus:border-primary focus:ring-0`
      : `rounded-xl border-2 ${hasValue ? 'border-primary' : 'border-border'} focus:border-primary focus:ring-primary/20`;

    return `${baseClass} ${sizeClass} ${platformClass}`;
  };

  return (
    <NativeBottomSheet
      isOpen={open}
      onClose={handleClose}
      height="auto"
    >
      <div className="flex flex-col items-center animate-fade-in pb-4">
        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${
          isVerified 
            ? 'bg-green-500 scale-110' 
            : isIOS 
              ? 'bg-gradient-to-br from-green-500 to-green-600' 
              : 'bg-green-500 shadow-lg shadow-green-500/30'
        }`}>
          {isVerified ? (
            <CheckCircle className="w-10 h-10 text-white animate-scale-in" />
          ) : (
            <Bell className="w-10 h-10 text-white" />
          )}
        </div>

        {/* Title */}
        <h2 className={`text-xl font-bold mb-2 ${isIOS ? 'font-semibold' : 'font-bold'}`}>
          {isVerified ? "Verified!" : "Push OTP Verification"}
        </h2>

        {/* Description */}
        <p className="text-center text-muted-foreground mb-6">
          {isVerified ? (
            <span className="text-green-600 font-medium">Logging you in now...</span>
          ) : (
            <>
              Enter the OTP from your push notification
              <br />
              <span className="text-sm text-primary">or tap "Approve Login" in the notification</span>
            </>
          )}
        </p>

        {!isVerified && (
          <div className="w-full space-y-6">
            {/* Polling indicator */}
            {isPolling && (
              <div className="flex items-center justify-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-xl">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  Waiting for approval tap...
                </span>
              </div>
            )}

            {/* OTP Input */}
            <div className="flex justify-center items-center gap-2" onPaste={handlePaste}>
              <div className="flex gap-2">
                {otp.slice(0, 3).map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    disabled={isLoading}
                    className={getOtpInputClass(index, !!digit)}
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              <div className="w-3 h-0.5 bg-muted-foreground/30 rounded-full" />

              <div className="flex gap-2">
                {otp.slice(3, 6).map((digit, index) => (
                  <Input
                    key={index + 3}
                    ref={(el) => (inputRefs.current[index + 3] = el)}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleInputChange(index + 3, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index + 3, e)}
                    disabled={isLoading}
                    className={getOtpInputClass(index + 3, !!digit)}
                  />
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className={`flex items-center justify-center p-4 animate-fade-in ${
                isIOS ? 'rounded-2xl bg-destructive/10' : 'rounded-xl bg-destructive/10 shadow-sm'
              }`}>
                <AlertTriangle className="w-4 h-4 text-destructive mr-2 flex-shrink-0" />
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-muted-foreground font-medium">Verifying...</span>
              </div>
            )}

            {/* Resend section */}
            <div className="text-center">
              {!canResend ? (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                  isIOS ? 'bg-muted/50' : 'bg-muted'
                }`}>
                  <span className="text-sm text-muted-foreground">Resend in</span>
                  <span className={`text-sm font-bold ${isIOS ? 'text-primary' : 'text-foreground'}`}>
                    {resendTimer}s
                  </span>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handleResend}
                  disabled={isSending}
                  className={`text-primary font-semibold ${buttonClass} ${
                    isIOS ? 'rounded-xl' : 'rounded-lg'
                  } active:scale-95 transition-transform`}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2" />
                      Resend Push OTP
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Change 2FA Method - only show if multiple methods enabled */}
            {multipleMethodsEnabled && onShowMethodSelection && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-primary hover:bg-primary/5"
                onClick={onShowMethodSelection}
              >
                Change 2FA Method
              </Button>
            )}

            {/* Help text */}
            <div className={`p-4 rounded-2xl ${isIOS ? 'bg-muted/30' : 'bg-muted/50'}`}>
              <p className="text-xs text-center text-muted-foreground leading-relaxed">
                Make sure push notifications are enabled in your browser or device settings.
              </p>
            </div>
          </div>
        )}
      </div>
    </NativeBottomSheet>
  );
};

export default PushOTPVerification;
