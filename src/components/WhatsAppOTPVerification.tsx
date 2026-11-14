import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useWhatsAppOTP } from '@/hooks/useWhatsAppOTP';
import { useWebOTP } from '@/hooks/useWebOTP';
import { getWorklyAndroidBridge } from '@/lib/nativeAppBridge';
import { Check, Loader2, RefreshCw, Shield, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

interface WhatsAppOTPVerificationProps {
  phone: string;
  name: string;
  purpose: 'user_signup_otp' | 'user_profile_whatsapp_verify' | 'company_signup_otp' | 'company_profile_whatsapp_verify';
  userId?: string;
  onVerified: () => void;
  isPhoneValid: boolean;
  className?: string;
  autoSend?: boolean;
}

const WhatsAppOTPVerification: React.FC<WhatsAppOTPVerificationProps> = ({
  phone,
  name,
  purpose,
  userId,
  onVerified,
  isPhoneValid,
  className,
  autoSend = true
}) => {
  const [otp, setOtp] = useState('');
  const hasSentRef = useRef(false);
  const lastPhoneRef = useRef(phone);
  const {
    isSending,
    isVerifying,
    otpSent,
    verified,
    error,
    retryAfter,
    remainingAttempts,
    sendOTP,
    verifyOTP,
    resendOTP,
    resetState,
  } = useWhatsAppOTP();

  // Reset state when phone changes
  useEffect(() => {
    if (phone !== lastPhoneRef.current) {
      lastPhoneRef.current = phone;
      hasSentRef.current = false;
      resetState();
      setOtp('');
    }
  }, [phone, resetState]);

  // Auto-send OTP when phone is valid and name is filled
  useEffect(() => {
    const shouldAutoSend = autoSend && isPhoneValid && name.trim() && !hasSentRef.current && !otpSent && !isSending;
    console.log('[WhatsAppOTP] Auto-send check:', { autoSend, isPhoneValid, name: name.trim(), hasSent: hasSentRef.current, otpSent, isSending, shouldAutoSend });
    
    if (shouldAutoSend) {
      hasSentRef.current = true;
      console.log('[WhatsAppOTP] Auto-sending OTP to:', phone, 'for purpose:', purpose);
      try { getWorklyAndroidBridge()?.startWhatsAppOtpHandshake?.(); } catch { /* copy-code/manual fallback */ }
      sendOTP(phone, name, purpose, userId);
    }
  }, [autoSend, isPhoneValid, name, otpSent, isSending, phone, purpose, userId, sendOTP]);

  // WhatsApp OTP is delivered only through Meta's signed one-tap handshake.
  useEffect(() => {
    const handleWhatsAppOtp = (event: Event) => {
      const code = (event as CustomEvent<{ code?: string }>).detail?.code?.replace(/\D/g, '').slice(0, 6);
      if (code && code.length === 6) setOtp(code);
    };
    window.addEventListener('workly-whatsapp-otp', handleWhatsAppOtp as EventListener);
    return () => window.removeEventListener('workly-whatsapp-otp', handleWhatsAppOtp as EventListener);
  }, []);

  // Auto-verify when OTP is complete
  useEffect(() => {
    if (otp.length === 6 && !isVerifying) {
      handleVerifyOTP();
    }
  }, [otp]);

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) return;
    const success = await verifyOTP(phone, otp, purpose);
    if (success) {
      onVerified();
    }
  };

  const handleManualSendOTP = async () => {
    hasSentRef.current = true;
    console.log('[WhatsAppOTP] Manual send OTP to:', phone);
    try { getWorklyAndroidBridge()?.startWhatsAppOtpHandshake?.(); } catch { /* copy-code/manual fallback */ }
    await sendOTP(phone, name, purpose, userId);
  };

  const handleResendOTP = async () => {
    await resendOTP(phone, name, purpose, userId);
    setOtp('');
  };

  // Return null when verified - badge is shown inline with label
  if (verified) {
    return null;
  }

  // Show OTP box only when phone is valid
  if (!isPhoneValid) {
    return null;
  }

  // Check if name is empty - show prompt to fill name
  const isNameEmpty = !name.trim();
  
  // Show manual send button if OTP wasn't sent yet and not currently sending
  const showManualSendButton = !otpSent && !isSending && !isNameEmpty;

  return (
    <div className={cn(
      "space-y-4 pt-4",
      "animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-foreground">WhatsApp Verification</h4>
          <p className="text-xs text-muted-foreground">
            {isNameEmpty ? (
              <span className="text-amber-600 dark:text-amber-400">
                Please fill your name to receive OTP
              </span>
            ) : isSending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Sending OTP to your WhatsApp...
              </span>
            ) : showManualSendButton ? (
              <span className="text-amber-600 dark:text-amber-400">
                Click button to send OTP
              </span>
            ) : (
              'Enter the 6-digit code sent to your WhatsApp'
            )}
          </p>
        </div>
        {showManualSendButton && (
          <Button
            type="button"
            size="sm"
            onClick={handleManualSendOTP}
            className="gap-1.5"
          >
            <Send className="w-4 h-4" />
            Send OTP
          </Button>
        )}
      </div>
      
      {/* OTP Input - 3-3 Grouped Mobile Friendly */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">Enter OTP</Label>
        <div className="flex w-full">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={setOtp}
            disabled={isVerifying || isNameEmpty}
            className="gap-2" containerClassName="w-full"
          >
            <InputOTPGroup className="flex-1 gap-2">
              <InputOTPSlot 
                index={0} 
                className={cn(
                  "flex-1 min-w-0 h-12 md:h-14 text-base sm:text-lg md:text-xl font-bold rounded-lg border-2 transition-all duration-200",
                  "bg-background hover:border-primary/50",
                  "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                  otp[0] && "border-primary/60 bg-primary/5"
                )}
              />
              <InputOTPSlot 
                index={1}
                className={cn(
                  "flex-1 min-w-0 h-12 md:h-14 text-base sm:text-lg md:text-xl font-bold rounded-lg border-2 transition-all duration-200",
                  "bg-background hover:border-primary/50",
                  "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                  otp[1] && "border-primary/60 bg-primary/5"
                )}
              />
              <InputOTPSlot 
                index={2}
                className={cn(
                  "flex-1 min-w-0 h-12 md:h-14 text-base sm:text-lg md:text-xl font-bold rounded-lg border-2 transition-all duration-200",
                  "bg-background hover:border-primary/50",
                  "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                  otp[2] && "border-primary/60 bg-primary/5"
                )}
              />
            </InputOTPGroup>

            {/* Separator Dash */}
            <div className="flex items-center px-0.5 sm:px-1 md:px-2">
              <div className="w-2 sm:w-3 md:w-4 h-0.5 bg-muted-foreground/40 rounded-full" />
            </div>

            <InputOTPGroup className="flex-1 gap-2">
              <InputOTPSlot 
                index={3}
                className={cn(
                  "flex-1 min-w-0 h-12 md:h-14 text-base sm:text-lg md:text-xl font-bold rounded-lg border-2 transition-all duration-200",
                  "bg-background hover:border-primary/50",
                  "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                  otp[3] && "border-primary/60 bg-primary/5"
                )}
              />
              <InputOTPSlot 
                index={4}
                className={cn(
                  "flex-1 min-w-0 h-12 md:h-14 text-base sm:text-lg md:text-xl font-bold rounded-lg border-2 transition-all duration-200",
                  "bg-background hover:border-primary/50",
                  "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                  otp[4] && "border-primary/60 bg-primary/5"
                )}
              />
              <InputOTPSlot 
                index={5}
                className={cn(
                  "flex-1 min-w-0 h-12 md:h-14 text-base sm:text-lg md:text-xl font-bold rounded-lg border-2 transition-all duration-200",
                  "bg-background hover:border-primary/50",
                  "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                  otp[5] && "border-primary/60 bg-primary/5"
                )}
              />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {/* Verifying State */}
        {isVerifying && (
          <div className="flex items-center justify-center gap-2 text-sm text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verifying...</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center justify-center p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      )}

      {/* Remaining Attempts */}
      {remainingAttempts < 3 && (
        <p className="text-xs text-center text-amber-600 dark:text-amber-400 font-medium">
          {remainingAttempts} attempt(s) remaining
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleResendOTP}
          disabled={retryAfter > 0 || isSending || isNameEmpty}
          className="gap-1.5 text-xs font-medium hover:bg-primary/10 hover:text-primary"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isSending && "animate-spin")} />
          {retryAfter > 0 ? `Resend in ${retryAfter}s` : 'Resend OTP'}
        </Button>
        <span className="text-xs text-muted-foreground">
          Expires in 5 minutes
        </span>
      </div>
    </div>
  );
};

export default WhatsAppOTPVerification;
