import { useTelegramBot } from '@/hooks/useTelegramBot';
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, RefreshCw, Shield, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { distributeOtpDigits, readPastedOtp } from '@/utils/otpInput';

interface TelegramOTPVerificationProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  userId: string;
  userEmail: string;
  userType: 'job_seeker' | 'employer';
}

export const TelegramOTPVerification: React.FC<TelegramOTPVerificationProps> = ({
  open,
  onClose,
  onVerified,
  userId,
  userEmail,
  userType,
}) => {
  const { botUsername: _tgBot } = useTelegramBot(userType);
  const tgBot = _tgBot || 'worklyindia_bot';
  const { toast } = useToast();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Send OTP when dialog opens
  useEffect(() => {
    if (open && !isVerified) {
      sendOTP();
      startResendTimer();
    }
  }, [open]);

  // Resend timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0 && !canResend) {
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
  }, [resendTimer, canResend]);

  const startResendTimer = () => {
    setResendTimer(30);
    setCanResend(false);
  };

  const sendOTP = async () => {
    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('unified-2fa', {
        body: { action: 'send-telegram-otp', userId, userType }
      });

      if (error) throw error;

      toast({
        title: "OTP Sent",
        description: "Check your Telegram for the verification code",
      });
    } catch (error) {
      console.error('Error sending OTP:', error);
      toast({
        title: "Error",
        description: "Failed to send OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    await sendOTP();
    startResendTimer();
  };

  const applyOtpDigits = (startIndex: number, raw: string) => {
    const { otp: newOtp, focusIndex } = distributeOtpDigits(otp, startIndex, raw);
    setOtp(newOtp);
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
    try {
      const { data, error } = await supabase.functions.invoke('unified-2fa', {
        body: { action: 'verify-telegram-otp', userId, code, userType }
      });

      if (error) throw error;

      if (data?.verified) {
        setIsVerified(true);
        toast({
          title: "Verified!",
          description: "Two-factor authentication successful",
        });
        setTimeout(() => {
          onVerified();
        }, 500);
      } else {
        toast({
          title: "Invalid OTP",
          description: "The code you entered is incorrect. Please try again.",
          variant: "destructive",
        });
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      toast({
        title: "Verification Failed",
        description: "Please check the code and try again.",
        variant: "destructive",
      });
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => !isLoading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-[hsl(200,80%,50%)] to-[hsl(200,80%,40%)] rounded-full flex items-center justify-center mb-4">
            {isVerified ? (
              <CheckCircle className="w-8 h-8 text-white" />
            ) : (
              <Shield className="w-8 h-8 text-white" />
            )}
          </div>
          <DialogTitle className="text-xl">
            {isVerified ? "Verified!" : "Enter Verification Code"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isVerified ? (
              "Redirecting you now..."
            ) : (
              <>
                We've sent a 6-digit code to your Telegram
                <div className="flex items-center justify-center gap-1 mt-2 text-[hsl(200,80%,50%)]">
                  <Send className="w-4 h-4" />
                  <span className="font-medium">@{tgBot}</span>
                </div>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!isVerified && (
          <div className="space-y-6 py-4">
            {/* OTP Input - WhatsApp Style */}
            <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
              {otp.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={isLoading}
                  className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold border-2 rounded-xl focus:border-[hsl(200,80%,50%)] focus:ring-[hsl(200,80%,50%)] transition-all"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </div>
            )}

            {/* Resend section */}
            <div className="text-center space-y-2">
              {!canResend ? (
                <p className="text-sm text-muted-foreground">
                  Resend code in <span className="font-medium text-foreground">{resendTimer}s</span>
                </p>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResend}
                  disabled={isSending}
                  className="text-[hsl(200,80%,50%)] hover:text-[hsl(200,80%,40%)]"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Resend Code
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Help text */}
            <p className="text-xs text-center text-muted-foreground">
               Didn't receive the code? Make sure you've started a chat with @{tgBot} on Telegram
             </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TelegramOTPVerification;
