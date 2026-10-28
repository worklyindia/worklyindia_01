import { useTelegramBot } from '@/hooks/useTelegramBot';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, RefreshCw, Shield, Loader2, CheckCircle, AlertTriangle, Smartphone, Fingerprint, Bell, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { GoogleAuthenticatorVerification } from '@/components/auth/GoogleAuthenticatorVerification';
import { PasskeyVerification } from '@/components/auth/PasskeyVerification';
import { PushOTPVerification } from '@/components/auth/PushOTPVerification';
import { EmailOTPVerification } from '@/components/auth/EmailOTPVerification';
import { distributeOtpDigits, readPastedOtp } from '@/utils/otpInput';

interface Login2FAVerificationProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  userId: string;
  userEmail: string;
  userType: 'job_seeker' | 'employer';
  telegramConnected: boolean;
  twoFactorMethod?: 'telegram' | 'google_authenticator' | 'passkey' | 'push_otp' | 'email_otp' | null;
  totpEnabled?: boolean;
  passkeyEnabled?: boolean;
  pushOtpEnabled?: boolean;
  emailOtpEnabled?: boolean;
}

export const Login2FAVerification: React.FC<Login2FAVerificationProps> = ({
  open,
  onClose,
  onVerified,
  userId,
  userEmail,
  userType,
  telegramConnected,
  twoFactorMethod = null,
  totpEnabled = false,
  emailOtpEnabled = false,
}) => {
  const { botUsername: _tgBot } = useTelegramBot(userType);
  const tgBot = _tgBot || 'worklyindia_bot';
  // Passkeys never act as a login 2FA step, and push is only a delivery
  // channel for the same OTP — neither is offered as a separate method here.
  const passkeyEnabled = false;
  const pushOtpEnabled = false;
  const { toast } = useToast();
  const { tapFeedback, successFeedback, errorFeedback } = useNativeFeel();
  const { isIOS, isAndroid, cardClass, buttonClass, shadowClass } = usePlatformStyle();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Safety check: if only passkey is enabled and no other methods, auto-verify
  // Passkeys are device-bound and don't need a separate verification step during password login
  const onlyPasskeyEnabled = passkeyEnabled && !totpEnabled && !telegramConnected && !pushOtpEnabled && !emailOtpEnabled;
  
  useEffect(() => {
    if (open && onlyPasskeyEnabled) {
      console.log('[2FA] Only passkey enabled, auto-verifying');
      onVerified();
    }
  }, [open, onlyPasskeyEnabled, onVerified]);

  // Count enabled methods (exclude passkey-only scenario)
  const enabledMethodsCount = [totpEnabled, telegramConnected, passkeyEnabled, pushOtpEnabled, emailOtpEnabled].filter(Boolean).length;
  const multipleMethodsEnabled = enabledMethodsCount > 1;
  
  // Determine the default method - prioritize passkey > push_otp > TOTP > Telegram > Email
  const getDefaultMethod = () => {
    if (passkeyEnabled) return 'passkey';
    if (pushOtpEnabled) return 'push_otp';
    if (totpEnabled) return 'google_authenticator';
    if (telegramConnected) return 'telegram';
    if (emailOtpEnabled) return 'email_otp';
    return null;
  };
  
  // Track current method for switching between 2FA methods
  const [currentMethod, setCurrentMethod] = useState<'google_authenticator' | 'telegram' | 'passkey' | 'push_otp' | 'email_otp' | null>(
    multipleMethodsEnabled ? null : getDefaultMethod()
  );

  // Show method selection when multiple methods are enabled and no method selected yet
  const [showMethodSelection, setShowMethodSelection] = useState(multipleMethodsEnabled);

  // Can switch to other methods?
  const canSwitchToTelegram = telegramConnected;
  const canSwitchToGoogleAuth = totpEnabled;
  const canSwitchToPasskey = passkeyEnabled;
  const canSwitchToPushOtp = pushOtpEnabled;
  const canSwitchToEmailOtp = emailOtpEnabled;

  // Update currentMethod when props change
  React.useEffect(() => {
    if (open) {
      if (multipleMethodsEnabled) {
        setShowMethodSelection(true);
        setCurrentMethod(null);
      } else {
        setShowMethodSelection(false);
        setCurrentMethod(getDefaultMethod());
      }
    }
  }, [open, multipleMethodsEnabled, passkeyEnabled, totpEnabled, telegramConnected, pushOtpEnabled, emailOtpEnabled]);

  // Check server-side cooldown and send OTP when Telegram method is selected
  useEffect(() => {
    const checkCooldownAndSend = async () => {
      if (!open || isVerified || !telegramConnected || currentMethod !== 'telegram') return;
      
      try {
        // First check if there's an existing cooldown from server
        const { data: cooldownData } = await supabase.functions.invoke('unified-2fa', {
          body: { action: 'send-telegram-otp', userId, userType, checkOnly: true }
        });

        if (cooldownData?.remainingCooldown > 0) {
          // There's an active cooldown - use server time
          setResendTimer(cooldownData.remainingCooldown);
          setCanResend(false);
          setOtpSent(true); // OTP was already sent before
        } else if (!otpSent) {
          // No cooldown and OTP not sent yet - send it
          sendOTP();
        }
      } catch (error) {
        console.error('Error checking cooldown:', error);
        // If check fails, proceed to send OTP
        if (!otpSent) {
          sendOTP();
        }
      }
    };

    checkCooldownAndSend();
  }, [open, telegramConnected, currentMethod]);

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

  // Resend timer countdown (client-side decrement of server time)
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

  const handleSwitchToTelegram = () => {
    tapFeedback();
    setCurrentMethod('telegram');
    setShowMethodSelection(false);
    setOtpSent(false);
    setOtp(['', '', '', '', '', '']);
    setError(null);
  };

  const handleSwitchToGoogleAuth = () => {
    tapFeedback();
    setCurrentMethod('google_authenticator');
    setShowMethodSelection(false);
    setOtp(['', '', '', '', '', '']);
    setError(null);
  };

  const handleSwitchToPasskey = () => {
    tapFeedback();
    setCurrentMethod('passkey');
    setShowMethodSelection(false);
    setOtp(['', '', '', '', '', '']);
    setError(null);
  };

  const handleSwitchToPushOtp = () => {
    tapFeedback();
    setCurrentMethod('push_otp');
    setShowMethodSelection(false);
    setOtp(['', '', '', '', '', '']);
    setError(null);
  };

  const handleSwitchToEmailOtp = () => {
    tapFeedback();
    setCurrentMethod('email_otp');
    setShowMethodSelection(false);
    setOtp(['', '', '', '', '', '']);
    setError(null);
  };

  const handleClose = () => {
    if (!isLoading) {
      tapFeedback();
      onClose();
    }
  };

  // Method Selection Screen - show when multiple methods are enabled
  if (showMethodSelection && multipleMethodsEnabled && open) {
    return (
      <NativeBottomSheet
        isOpen={open}
        onClose={handleClose}
        title=""
        height="auto"
      >
        <div className="flex flex-col animate-fade-in pb-4">
          <div className="w-full space-y-3">
            {/* Passkeys Option */}
            {passkeyEnabled && (
              <button
                onClick={handleSwitchToPasskey}
                className={`w-full p-4 rounded-2xl border-2 border-border hover:border-primary/50 transition-all active:scale-[0.98] ${
                  isIOS ? 'bg-muted/30' : 'bg-muted/50'
                }`}
              >
                <div className="text-left">
                  <h5 className="font-semibold text-foreground">Passkey</h5>
                  <p className="text-sm text-muted-foreground">Use biometrics or device PIN</p>
                </div>
              </button>
            )}

            {/* Push OTP Option */}
            {pushOtpEnabled && (
              <button
                onClick={handleSwitchToPushOtp}
                className={`w-full p-4 rounded-2xl border-2 border-border hover:border-primary/50 transition-all active:scale-[0.98] ${
                  isIOS ? 'bg-muted/30' : 'bg-muted/50'
                }`}
              >
                <div className="text-left">
                  <h5 className="font-semibold text-foreground">Push OTP</h5>
                  <p className="text-sm text-muted-foreground">Receive OTP via push notification</p>
                </div>
              </button>
            )}

            {/* Google Authenticator Option */}
            {totpEnabled && (
              <button
                onClick={handleSwitchToGoogleAuth}
                className={`w-full p-4 rounded-2xl border-2 border-border hover:border-primary/50 transition-all active:scale-[0.98] ${
                  isIOS ? 'bg-muted/30' : 'bg-muted/50'
                }`}
              >
                <div className="text-left">
                  <h5 className="font-semibold text-foreground">Google Authenticator</h5>
                  <p className="text-sm text-muted-foreground">Use 6-digit code from app</p>
                </div>
              </button>
            )}

            {/* Telegram Option */}
            {telegramConnected && (
              <button
                onClick={handleSwitchToTelegram}
                className={`w-full p-4 rounded-2xl border-2 border-border hover:border-primary/50 transition-all active:scale-[0.98] ${
                  isIOS ? 'bg-muted/30' : 'bg-muted/50'
                }`}
              >
                <div className="text-left">
                  <h5 className="font-semibold text-foreground">Telegram OTP</h5>
                  <p className="text-sm text-muted-foreground">Receive code on Telegram</p>
                </div>
              </button>
            )}

            {/* Email OTP Option */}
            {emailOtpEnabled && (
              <button
                onClick={handleSwitchToEmailOtp}
                className={`w-full p-4 rounded-2xl border-2 border-border hover:border-primary/50 transition-all active:scale-[0.98] ${
                  isIOS ? 'bg-muted/30' : 'bg-muted/50'
                }`}
              >
                <div className="text-left">
                  <h5 className="font-semibold text-foreground">Email OTP</h5>
                  <p className="text-sm text-muted-foreground">Receive code on your email</p>
                </div>
              </button>
            )}
          </div>
        </div>
      </NativeBottomSheet>
    );
  }

  // Passkey verification
  if (currentMethod === 'passkey' && open) {
    return (
      <PasskeyVerification
        open={open}
        onClose={onClose}
        onVerified={onVerified}
        userId={userId}
        userType={userType}
        multipleMethodsEnabled={multipleMethodsEnabled}
        onShowMethodSelection={() => setShowMethodSelection(true)}
      />
    );
  }

  // Push OTP verification
  if (currentMethod === 'push_otp' && open) {
    return (
      <PushOTPVerification
        open={open}
        onClose={onClose}
        onVerified={onVerified}
        userId={userId}
        userType={userType}
        multipleMethodsEnabled={multipleMethodsEnabled}
        onShowMethodSelection={() => setShowMethodSelection(true)}
      />
    );
  }

  // Email OTP verification
  if (currentMethod === 'email_otp' && open) {
    return (
      <EmailOTPVerification
        open={open}
        onClose={onClose}
        onVerified={onVerified}
        userId={userId}
        userEmail={userEmail}
        userType={userType}
        multipleMethodsEnabled={multipleMethodsEnabled}
        onShowMethodSelection={() => setShowMethodSelection(true)}
      />
    );
  }

  // If Google Authenticator, use the dedicated component
  if (currentMethod === 'google_authenticator' && open) {
    return (
      <GoogleAuthenticatorVerification
        open={open}
        onClose={onClose}
        onVerified={onVerified}
        userId={userId}
        userType={userType}
        multipleMethodsEnabled={multipleMethodsEnabled}
        onShowMethodSelection={() => setShowMethodSelection(true)}
      />
    );
  }

  const startResendTimer = () => {
    setResendTimer(60);
    setCanResend(false);
  };

  const sendOTP = async () => {
    setIsSending(true);
    tapFeedback();
    try {
      const { data, error } = await supabase.functions.invoke('unified-2fa', {
        body: { action: 'send-telegram-otp', userId, userType }
      });

      if (error) throw error;

      // Check if rate limited (429 response)
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
      // Use server-provided cooldown time
      if (data?.remainingCooldown) {
        setResendTimer(data.remainingCooldown);
        setCanResend(false);
      } else {
        startResendTimer();
      }
      successFeedback();
      toast({
        title: "OTP Sent",
        description: "Check your Telegram for the verification code",
      });
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      
      // Handle rate limit error from server
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
        body: { action: 'verify-telegram-otp', userId, code, userType }
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

  // Platform-specific OTP input styles
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

  // Telegram not connected error state - only show if telegram is the only available method
  if (!telegramConnected && !totpEnabled && !passkeyEnabled && !pushOtpEnabled) {
    return (
      <NativeBottomSheet
        isOpen={open}
        onClose={handleClose}
        title="Telegram Not Connected"
        height="auto"
      >
        <div className="flex flex-col items-center animate-fade-in">
          {/* Error Icon */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
            isIOS ? 'bg-destructive/10' : 'bg-destructive/15 shadow-lg'
          }`}>
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>

          <p className="text-center text-muted-foreground mb-6">
            You have Two-Factor Authentication enabled but your Telegram account is not connected.
          </p>

          <div className={`w-full p-4 rounded-2xl mb-6 ${
            isIOS ? 'bg-muted/50' : 'bg-muted shadow-sm'
          }`}>
            <p className="text-sm text-muted-foreground text-center mb-2">
              To login, please first connect your Telegram account in your profile settings.
            </p>
            <p className="text-sm font-semibold text-center text-foreground">
              {userType === 'job_seeker' 
                ? 'Profile → Security → Connect Telegram'
                : 'Settings → Security → Connect Telegram'
              }
            </p>
          </div>
          
          <Button 
            className={`w-full h-14 text-base font-semibold ${buttonClass} ${
              isIOS ? 'rounded-2xl' : 'rounded-xl'
            }`}
            variant="outline"
            onClick={handleClose}
          >
            Close
          </Button>
        </div>
      </NativeBottomSheet>
    );
  }

  return (
    <NativeBottomSheet
      isOpen={open}
      onClose={handleClose}
      height="auto"
    >
      <div className="flex flex-col items-center animate-fade-in pb-4">
        {/* Shield/Success Icon with animation */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${
          isVerified 
            ? 'bg-green-500 scale-110' 
            : isIOS 
              ? 'bg-gradient-to-br from-primary to-primary/80' 
              : 'bg-primary shadow-lg shadow-primary/30'
        }`}>
          {isVerified ? (
            <CheckCircle className="w-10 h-10 text-white animate-scale-in" />
          ) : (
            <Shield className="w-10 h-10 text-white" />
          )}
        </div>

        {/* Title */}
        <h2 className={`text-xl font-bold mb-2 ${isIOS ? 'font-semibold' : 'font-bold'}`}>
          {isVerified ? "Verified!" : "Two-Factor Authentication"}
        </h2>

        {/* Description */}
        <p className="text-center text-muted-foreground mb-6">
          {isVerified ? (
            <span className="text-green-600 font-medium">Logging you in now...</span>
          ) : (
            <>
              Enter the 6-digit code sent to your Telegram
              <a
                href={`https://t.me/${tgBot}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 mt-2 text-primary font-semibold active:opacity-70 transition-opacity"
                onClick={() => tapFeedback()}
              >
                <Send className="w-4 h-4" />
                <span>@{tgBot}</span>
              </a>
            </>
          )}
        </p>

        {!isVerified && (
          <div className="w-full space-y-6">
            {/* Native OTP Input - 3-3 grouped */}
            <div className="flex justify-center items-center gap-2" onPaste={handlePaste}>
              {/* First 3 digits */}
              <div className="flex gap-2">
                {otp.slice(0, 3).map((digit, index) => (
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
                    className={getOtpInputClass(index, !!digit)}
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              {/* Separator */}
              <div className="w-3 h-0.5 bg-muted-foreground/30 rounded-full" />

              {/* Last 3 digits */}
              <div className="flex gap-2">
                {otp.slice(3, 6).map((digit, index) => (
                  <Input
                    key={index + 3}
                    ref={(el) => (inputRefs.current[index + 3] = el)}
                    type="text"
                    inputMode="numeric"
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

            {/* Error Message - Native style */}
            {error && (
              <div className={`flex items-center justify-center p-4 animate-fade-in ${
                isIOS 
                  ? 'rounded-2xl bg-destructive/10' 
                  : 'rounded-xl bg-destructive/10 shadow-sm'
              }`}>
                <AlertTriangle className="w-4 h-4 text-destructive mr-2 flex-shrink-0" />
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}

            {/* Loading indicator - Native style */}
            {isLoading && (
              <div className="flex items-center justify-center gap-3 py-2">
                <div className={`w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin`} />
                <span className="text-muted-foreground font-medium">Verifying...</span>
              </div>
            )}

            {/* Resend section - Native style */}
            <div className="text-center">
              {!canResend ? (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                  isIOS ? 'bg-muted/50' : 'bg-muted'
                }`}>
                  <span className="text-sm text-muted-foreground">Resend code in</span>
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
                      Resend Code
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Change 2FA Method - only show if multiple methods enabled */}
            {multipleMethodsEnabled && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-primary hover:bg-primary/5"
                onClick={() => setShowMethodSelection(true)}
              >
                Change 2FA Method
              </Button>
            )}

            {/* Help text - Native style */}
            <div className={`p-4 rounded-2xl ${isIOS ? 'bg-muted/30' : 'bg-muted/50'}`}>
              <p className="text-xs text-center text-muted-foreground leading-relaxed">
                Didn't receive the code? Make sure you've started a chat with{' '}
                <a
                  href={`https://t.me/${tgBot}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary"
                  onClick={() => tapFeedback()}
                >
                  @{tgBot}
                </a>{' '}
                on Telegram
              </p>
            </div>
          </div>
        )}
      </div>
    </NativeBottomSheet>
  );
};

export default Login2FAVerification;
