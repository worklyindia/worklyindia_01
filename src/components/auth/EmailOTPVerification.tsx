import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, RefreshCw, Shield, Loader2, CheckCircle, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { useWebOTP } from '@/hooks/useWebOTP';
import { distributeOtpDigits, readPastedOtp } from '@/utils/otpInput';

interface EmailOTPVerificationProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  userId: string;
  userEmail: string;
  userType: 'job_seeker' | 'employer';
  multipleMethodsEnabled?: boolean;
  onShowMethodSelection?: () => void;
}

export const EmailOTPVerification: React.FC<EmailOTPVerificationProps> = ({
  open,
  onClose,
  onVerified,
  userId,
  userEmail,
  userType,
  multipleMethodsEnabled = false,
  onShowMethodSelection,
}) => {
  const { toast } = useToast();
  const { tapFeedback, successFeedback, errorFeedback } = useNativeFeel();
  const { isIOS, isAndroid } = usePlatformStyle();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check cooldown and send OTP when modal opens
  useEffect(() => {
    const checkCooldownAndSend = async () => {
      if (!open || isVerified) return;
      
      try {
        // Check if there's an existing cooldown from server
        const { data: cooldownData } = await supabase.functions.invoke('unified-2fa', {
          body: { action: 'send-email-otp', userId, userType, checkOnly: true }
        });

        if (cooldownData?.remainingCooldown > 0) {
          setResendTimer(cooldownData.remainingCooldown);
          setCanResend(false);
          setOtpSent(true);
        } else if (!otpSent) {
          sendOTP();
        }
      } catch (error) {
        console.error('Error checking cooldown:', error);
        if (!otpSent) {
          sendOTP();
        }
      }
    };

    checkCooldownAndSend();
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

  const handleClose = () => {
    if (!isLoading) {
      tapFeedback();
      onClose();
    }
  };

  const sendOTP = async () => {
    setIsSending(true);
    tapFeedback();
    try {
      const { data, error } = await supabase.functions.invoke('unified-2fa', {
        body: { action: 'send-email-otp', userId, userType }
      });

      if (error) throw error;

      if (data?.remainingCooldown && !data?.success) {
        setResendTimer(data.remainingCooldown);
        setCanResend(false);
        setOtpSent(true);
        toast({
          title: "Please Wait",
          description: `You can resend OTP in ${data.remainingCooldown} seconds`,
          variant: "destructive",
        });
        return;
      }

      setOtpSent(true);
      if (data?.remainingCooldown) {
        setResendTimer(data.remainingCooldown);
        setCanResend(false);
      } else {
        setResendTimer(60);
        setCanResend(false);
      }
      successFeedback();
      toast({
        title: "OTP Sent",
        description: "Check your email for the verification code",
      });
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      
      if (error?.message?.includes('wait')) {
        const match = error.message.match(/(\d+)/);
        if (match) {
          setResendTimer(parseInt(match[1]));
          setCanResend(false);
          setOtpSent(true);
        }
      }
      
      errorFeedback();
      toast({
        title: "Error",
        description: error?.message || "Failed to send OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    tapFeedback();
    await sendOTP();
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
    try {
      const { data, error: verifyError } = await supabase.functions.invoke('unified-2fa', {
        body: { action: 'verify-email-otp', userId, code, userType }
      });

      if (verifyError) throw verifyError;

      if (data?.verified) {
        setIsVerified(true);
        successFeedback();
        toast({
          title: "Verified!",
          description: "Email OTP verification successful",
        });
        setTimeout(() => {
          onVerified();
        }, 800);
      } else {
        const errorMessage = data?.error || "Invalid OTP. Please try again.";
        setError(errorMessage);
        errorFeedback();
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError("Verification failed. Please check your code and try again.");
      errorFeedback();
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const getOtpInputClass = (hasValue: boolean) => {
    const baseClass = "text-center text-xl font-bold transition-all duration-200";
    const sizeClass = "w-11 h-14 sm:w-12 sm:h-16";
    
    const platformClass = isIOS
      ? `rounded-xl border-2 ${hasValue ? 'border-primary bg-primary/5' : 'border-border bg-background'} focus:border-primary focus:ring-0 active:scale-95`
      : isAndroid
      ? `rounded-lg border-b-2 border-t-0 border-l-0 border-r-0 ${hasValue ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 bg-muted/30'} focus:border-primary focus:ring-0`
      : `rounded-xl border-2 ${hasValue ? 'border-primary' : 'border-border'} focus:border-primary focus:ring-primary/20`;

    return `${baseClass} ${sizeClass} ${platformClass}`;
  };

  // Mask email for display
  const maskedEmail = userEmail ? 
    userEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 
    'your email';

  return (
    <NativeBottomSheet
      isOpen={open}
      onClose={handleClose}
      title=""
      height="auto"
    >
      <div className="flex flex-col items-center animate-fade-in">
        {/* Back button for multiple methods */}
        {multipleMethodsEnabled && onShowMethodSelection && (
          <button
            onClick={() => {
              tapFeedback();
              onShowMethodSelection();
            }}
            className="absolute left-4 top-4 p-2 rounded-full hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
        )}

        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
          isVerified ? 'bg-green-100' : isIOS ? 'bg-primary/10' : 'bg-primary/15 shadow-lg'
        }`}>
          {isVerified ? (
            <CheckCircle className="w-10 h-10 text-green-600" />
          ) : (
            <Mail className="w-10 h-10 text-primary" />
          )}
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-foreground mb-2">
          {isVerified ? 'Verified!' : 'Email OTP'}
        </h3>

        {/* Description */}
        <p className="text-center text-muted-foreground mb-6 px-4">
          {isVerified 
            ? 'Authentication successful' 
            : isSending 
              ? 'Sending verification code...' 
              : `Enter the 6-digit code sent to ${maskedEmail}`}
        </p>

        {/* OTP Input */}
        {!isVerified && (
          <>
            <div className="flex gap-2 mb-4">
              {otp.map((digit, index) => (
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
                  onPaste={handlePaste}
                  className={getOtpInputClass(!!digit)}
                  disabled={isLoading || isSending}
                />
              ))}
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-destructive mb-4">{error}</p>
            )}

            {/* Resend button */}
            <div className="flex items-center gap-2 mb-6">
              {canResend ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResend}
                  disabled={isSending}
                  className="text-primary"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${isSending ? 'animate-spin' : ''}`} />
                  Resend Code
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Resend code in {resendTimer}s
                </p>
              )}
            </div>

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-primary">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Verifying...</span>
              </div>
            )}
          </>
        )}
      </div>
    </NativeBottomSheet>
  );
};

export default EmailOTPVerification;
