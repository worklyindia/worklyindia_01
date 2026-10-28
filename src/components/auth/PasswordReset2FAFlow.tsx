import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Lock, CheckCircle2, Loader2, Shield, Fingerprint, Bell, Send, RefreshCw, AlertTriangle, Key, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { validatePassword } from '@/utils/authErrorHandler';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';
import { startAuthentication } from '@simplewebauthn/browser';
import { getCurrentOrigin, getPasskeyDomain, isPasskeyDomainMismatch } from '@/config/domainConfig';
import { distributeOtpDigits, readPastedOtp } from '@/utils/otpInput';

interface PasswordReset2FAFlowProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  userType: 'job_seeker' | 'employer';
  telegramConnected: boolean;
  totpEnabled: boolean;
  passkeyEnabled: boolean;
  pushOtpEnabled: boolean;
}

type ResetStep = 'method-selection' | 'verification' | 'set-password' | 'success';
type VerificationMethod = 'google_authenticator' | 'telegram' | 'passkey' | 'push_otp';

export const PasswordReset2FAFlow: React.FC<PasswordReset2FAFlowProps> = ({
  open,
  onClose,
  userId,
  userEmail,
  userType,
  telegramConnected,
  totpEnabled,
  passkeyEnabled,
  pushOtpEnabled,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<ResetStep>('method-selection');
  const [selectedMethod, setSelectedMethod] = useState<VerificationMethod | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  
  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  
  // OTP state (for telegram and TOTP)
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Push OTP polling
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Domain mismatch warning for passkeys
  const [domainMismatchWarning, setDomainMismatchWarning] = useState<string | null>(null);

  // Count enabled methods
  const enabledMethods = [
    totpEnabled && 'google_authenticator',
    telegramConnected && 'telegram',
    passkeyEnabled && 'passkey',
    pushOtpEnabled && 'push_otp'
  ].filter(Boolean) as VerificationMethod[];

  // Auto-select if only one method
  useEffect(() => {
    if (open && enabledMethods.length === 1) {
      handleMethodSelect(enabledMethods[0]);
    } else if (open) {
      setStep('method-selection');
    }
  }, [open]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setStep('method-selection');
      setSelectedMethod(null);
      setResetToken(null);
      setNewPassword('');
      setConfirmPassword('');
      setOtp(['', '', '', '', '', '']);
      setOtpSent(false);
      setError(null);
      setIsVerified(false);
      setIsPolling(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    }
  }, [open]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleMethodSelect = (method: VerificationMethod) => {
    setSelectedMethod(method);
    setStep('verification');
    setError(null);
    setOtp(['', '', '', '', '', '']);
    
    // Auto-send OTP for telegram
    if (method === 'telegram') {
      sendTelegramOtp();
    } else if (method === 'push_otp') {
      sendPushOtp();
    } else if (method === 'passkey') {
      startPasskeyVerification();
    }
  };

  // ==================== TELEGRAM OTP ====================
  const sendTelegramOtp = async () => {
    setIsSendingOtp(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('password-reset-2fa', {
        body: { action: 'send-telegram-otp', userId, userType }
      });

      if (error) {
        console.error('[2fa-reset] Telegram OTP network error:', error);
        throw new Error('Failed to connect to the server. Please check your internet connection.');
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }

      setOtpSent(true);
      setResendTimer(data?.remainingCooldown || 60);
      toast({
        title: "OTP Sent",
        description: "Check your Telegram for the verification code",
      });
    } catch (error: any) {
      console.error('[2fa-reset] Error sending Telegram OTP:', error);
      setError(error?.message || "Failed to send OTP. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ==================== PUSH OTP ====================
  const sendPushOtp = async () => {
    setIsSendingOtp(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('password-reset-2fa', {
        body: { action: 'send-push-otp', userId, userType }
      });

      if (error) {
        console.error('[2fa-reset] Push OTP network error:', error);
        throw new Error('Failed to connect to the server. Please check your internet connection.');
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }

      setOtpSent(true);
      setResendTimer(data?.remainingCooldown || 60);
      startPushPolling();
      toast({
        title: "Push Notification Sent",
        description: "Tap 'Approve' in the notification or enter the OTP",
      });
    } catch (error: any) {
      console.error('[2fa-reset] Error sending push OTP:', error);
      setError(error?.message || "Failed to send push notification. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const startPushPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setIsPolling(true);
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Check if push approval happened - generate token directly
        const { data, error } = await supabase.functions.invoke('password-reset-2fa', {
          body: { action: 'verify-2fa', userId, userType, method: 'push_otp' }
        });

        if (data?.success && data?.token) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setIsPolling(false);
          setIsVerified(true);
          setResetToken(data.token);
          toast({
            title: "Verified!",
            description: "Now set your new password",
          });
          setTimeout(() => setStep('set-password'), 800);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2500);
  };

  // ==================== PASSKEY ====================
  const startPasskeyVerification = async () => {
    setIsLoading(true);
    setError(null);
    setDomainMismatchWarning(null);
    
    try {
      const currentOrigin = getCurrentOrigin();
      const currentPasskeyDomain = getPasskeyDomain();
      
      console.log('[passkey-reset] Starting verification with origin:', currentOrigin, 'domain:', currentPasskeyDomain);
      
      // Get passkey challenge options - pass origin for proper rpId
      const { data: optionsData, error: optionsError } = await supabase.functions.invoke('password-reset-2fa', {
        body: { 
          action: 'get-passkey-options', 
          userId, 
          userType,
          origin: currentOrigin 
        }
      });

      if (optionsError) {
        console.error('[passkey-reset] Options error:', optionsError);
        throw new Error('Failed to connect to the server. Please check your internet connection and try again.');
      }
      
      if (!optionsData?.options) {
        const errorMsg = optionsData?.error || 'Failed to get passkey options';
        console.error('[passkey-reset] No options returned:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('[passkey-reset] Received options with rpId:', optionsData.options?.rpId);
      
      // Check for domain mismatch - passkeys are domain-bound
      const optionsRpId = optionsData.options?.rpId;
      if (optionsRpId && optionsRpId !== currentPasskeyDomain) {
        console.warn('[passkey-reset] Domain mismatch detected:', optionsRpId, 'vs', currentPasskeyDomain);
        setDomainMismatchWarning(`Your Passkey was registered on "${optionsRpId}" but you're on "${currentPasskeyDomain}". The verification may fail.`);
      }

      // Start WebAuthn authentication
      let credential;
      try {
        credential = await startAuthentication(optionsData.options);
      } catch (webAuthnError: any) {
        console.error('[passkey-reset] WebAuthn error:', webAuthnError);
        
        // Provide user-friendly error messages
        if (webAuthnError.name === 'NotAllowedError') {
          throw new Error('Passkey verification was cancelled or timed out. Please try again.');
        } else if (webAuthnError.name === 'SecurityError') {
          throw new Error('Passkey domain mismatch. Your Passkey was registered on a different domain. Please use an alternative 2FA method.');
        } else if (webAuthnError.message?.includes('rpId')) {
          throw new Error(`Domain mismatch: Your Passkey was registered on a different domain. Please use an alternative 2FA method like Authenticator App or Telegram.`);
        } else {
          throw new Error(webAuthnError.message || 'Passkey authentication failed. Please try again or use an alternative method.');
        }
      }

      // Verify passkey and get reset token - pass origin for proper rpId
      const { data, error: verifyError } = await supabase.functions.invoke('password-reset-2fa', {
        body: { 
          action: 'verify-2fa', 
          userId, 
          userType, 
          method: 'passkey',
          credential,
          origin: currentOrigin
        }
      });

      if (verifyError) {
        console.error('[passkey-reset] Verify error:', verifyError);
        throw new Error('Failed to verify passkey. Please try again.');
      }
      
      if (!data?.success) {
        throw new Error(data?.error || 'Passkey verification failed');
      }

      setIsVerified(true);
      setResetToken(data.token);
      toast({
        title: "Verified!",
        description: "Now set your new password",
      });
      setTimeout(() => setStep('set-password'), 800);

    } catch (error: any) {
      console.error('[passkey-reset] Error:', error);
      
      // If domain mismatch detected, suggest alternative methods
      if (error.message?.includes('domain') || error.message?.includes('rpId')) {
        setError(error.message);
        if (enabledMethods.length > 1) {
          toast({
            variant: "destructive",
            title: "Passkey Error",
            description: "Please try an alternative verification method like Authenticator App or Telegram.",
          });
        }
      } else {
        setError(error?.message || 'Passkey verification failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== VERIFY OTP (Telegram/TOTP/Push manual) ====================
  const verifyOtp = async (code: string) => {
    setIsLoading(true);
    setError(null);
    
    // Stop push polling if active
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      setIsPolling(false);
    }

    try {
      const { data, error } = await supabase.functions.invoke('password-reset-2fa', {
        body: { 
          action: 'verify-2fa', 
          userId, 
          userType, 
          method: selectedMethod,
          code 
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Verification failed');
      }

      setIsVerified(true);
      setResetToken(data.token);
      toast({
        title: "Verified!",
        description: "Now set your new password",
      });
      setTimeout(() => setStep('set-password'), 800);

    } catch (error: any) {
      console.error('Verification error:', error);
      setError(error?.message || 'Invalid code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
      // Resume push polling if it was active
      if (selectedMethod === 'push_otp') {
        startPushPolling();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== PASSWORD RESET ====================
  const handlePasswordReset = async () => {
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      toast({
        variant: "destructive",
        title: "Invalid Password",
        description: passwordValidation.message
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords Don't Match",
        description: "Password and confirm password must match"
      });
      return;
    }

    if (!resetToken) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invalid session. Please try again."
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('password-reset-2fa', {
        body: { 
          action: 'reset-password', 
          token: resetToken,
          newPassword 
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Password reset failed');
      }

      setStep('success');
      toast({
        title: "Success!",
        description: "Your password has been updated. Please log in with your new password.",
      });

      // User's sessions are already invalidated by the edge function
      // Navigate to appropriate login page
      setTimeout(async () => {
        onClose();
        // Clear any local session state
        await supabase.auth.signOut({ scope: 'local' });
        if (userType === 'employer') {
          navigate('/employer-auth');
        } else {
          navigate('/login');
        }
      }, 2000);

    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: error?.message || "Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== OTP INPUT HANDLERS ====================
  const applyOtpDigits = (startIndex: number, raw: string) => {
    const { otp: newOtp, focusIndex } = distributeOtpDigits(otp, startIndex, raw);
    setOtp(newOtp);
    setError(null);
    inputRefs.current[focusIndex]?.focus();

    const code = newOtp.join('');
    if (code.length === 6 && newOtp.every(digit => digit !== '')) {
      verifyOtp(code);
    }
  };

  const handleOtpInputChange = (index: number, value: string) => {
    applyOtpDigits(index, value);
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = readPastedOtp(e, 6);
    if (pastedData) applyOtpDigits(0, pastedData);
  };

  // ==================== RENDER: Method Selection ====================
  if (step === 'method-selection' && open) {
    return (
      <NativeBottomSheet
        isOpen={open}
        onClose={onClose}
        title="Verify Your Identity"
        height="auto"
      >
        <div className="flex flex-col space-y-3 pb-4">
          <p className="text-sm text-muted-foreground mb-2">
            Choose a verification method to reset your password
          </p>
          
          {passkeyEnabled && (
            <button
              onClick={() => handleMethodSelect('passkey')}
              className="w-full p-4 rounded-2xl border-2 border-border hover:border-primary/50 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <Fingerprint className="w-5 h-5 text-primary" />
                <div>
                  <h5 className="font-semibold">Passkey</h5>
                  <p className="text-sm text-muted-foreground">Use biometrics or device PIN</p>
                </div>
              </div>
            </button>
          )}

          {pushOtpEnabled && (
            <button
              onClick={() => handleMethodSelect('push_otp')}
              className="w-full p-4 rounded-2xl border-2 border-border hover:border-primary/50 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary" />
                <div>
                  <h5 className="font-semibold">Push Notification</h5>
                  <p className="text-sm text-muted-foreground">Approve via push notification</p>
                </div>
              </div>
            </button>
          )}

          {totpEnabled && (
            <button
              onClick={() => handleMethodSelect('google_authenticator')}
              className="w-full p-4 rounded-2xl border-2 border-border hover:border-primary/50 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <h5 className="font-semibold">Authenticator App</h5>
                  <p className="text-sm text-muted-foreground">Use 6-digit code from app</p>
                </div>
              </div>
            </button>
          )}

          {telegramConnected && (
            <button
              onClick={() => handleMethodSelect('telegram')}
              className="w-full p-4 rounded-2xl border-2 border-border hover:border-primary/50 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <Send className="w-5 h-5 text-primary" />
                <div>
                  <h5 className="font-semibold">Telegram OTP</h5>
                  <p className="text-sm text-muted-foreground">Receive code on Telegram</p>
                </div>
              </div>
            </button>
          )}
        </div>
      </NativeBottomSheet>
    );
  }

  // ==================== RENDER: Verification (OTP based - Telegram, TOTP, Push) ====================
  if (step === 'verification' && (selectedMethod === 'telegram' || selectedMethod === 'google_authenticator' || selectedMethod === 'push_otp') && open) {
    const methodConfig = {
      telegram: { icon: Send, title: 'Enter Telegram OTP', color: 'text-blue-500', bgColor: 'bg-blue-500' },
      google_authenticator: { icon: Shield, title: 'Enter Authenticator Code', color: 'text-primary', bgColor: 'bg-primary' },
      push_otp: { icon: Bell, title: 'Push OTP Verification', color: 'text-green-500', bgColor: 'bg-green-500' },
    };
    
    const config = methodConfig[selectedMethod];
    const IconComponent = config.icon;

    return (
      <NativeBottomSheet
        isOpen={open}
        onClose={() => {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setIsPolling(false);
          if (enabledMethods.length > 1) {
            setStep('method-selection');
            setSelectedMethod(null);
          } else {
            onClose();
          }
        }}
        title={config.title}
        height="auto"
      >
        <div className="flex flex-col items-center space-y-4 pb-4">
          {/* Icon */}
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            isVerified ? 'bg-green-500' : config.bgColor
          }`}>
            {isVerified ? (
              <CheckCircle2 className="w-8 h-8 text-white" />
            ) : (
              <IconComponent className="w-8 h-8 text-white" />
            )}
          </div>
          
          {isVerified ? (
            <p className="text-green-600 font-medium">Two-factor authentication successful</p>
          ) : (
            <>
              {/* Polling indicator for push */}
              {isPolling && selectedMethod === 'push_otp' && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-xl">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    Waiting for approval tap...
                  </span>
                </div>
              )}

              <p className="text-sm text-muted-foreground text-center">
                {selectedMethod === 'telegram' && (otpSent 
                  ? "Enter the 6-digit code sent to your Telegram" 
                  : "Sending verification code to your Telegram...")}
                {selectedMethod === 'google_authenticator' && "Enter the 6-digit code from your authenticator app"}
                {selectedMethod === 'push_otp' && (otpSent 
                  ? "Enter the OTP or tap 'Approve' in the notification" 
                  : "Sending push notification...")}
              </p>

              {/* OTP Input */}
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-11 h-14 text-center text-xl font-bold"
                    disabled={isLoading || isSendingOtp}
                    autoFocus={index === 0 && (otpSent || selectedMethod === 'google_authenticator')}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center justify-center p-3 bg-destructive/10 rounded-xl w-full">
                  <AlertTriangle className="w-4 h-4 text-destructive mr-2" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Loading */}
              {isLoading && (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Verifying...</span>
                </div>
              )}

              {/* Resend for Telegram/Push */}
              {(selectedMethod === 'telegram' || selectedMethod === 'push_otp') && otpSent && (
                <div className="text-center">
                  {resendTimer > 0 ? (
                    <span className="text-sm text-muted-foreground">Resend in {resendTimer}s</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectedMethod === 'telegram' ? sendTelegramOtp : sendPushOtp}
                      disabled={isSendingOtp}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Resend
                    </Button>
                  )}
                </div>
              )}

              {/* Change method button */}
              {enabledMethods.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => {
                    if (pollingIntervalRef.current) {
                      clearInterval(pollingIntervalRef.current);
                    }
                    setIsPolling(false);
                    setStep('method-selection');
                    setSelectedMethod(null);
                  }}
                >
                  Change 2FA Method
                </Button>
              )}
            </>
          )}
        </div>
      </NativeBottomSheet>
    );
  }

  // ==================== RENDER: Passkey Verification ====================
  if (step === 'verification' && selectedMethod === 'passkey' && open) {
    return (
      <NativeBottomSheet
        isOpen={open}
        onClose={() => {
          if (enabledMethods.length > 1) {
            setStep('method-selection');
            setSelectedMethod(null);
          } else {
            onClose();
          }
        }}
        title="Passkey Verification"
        height="auto"
      >
        <div className="flex flex-col items-center space-y-4 pb-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            isVerified ? 'bg-green-500' : 'bg-primary'
          }`}>
            {isVerified ? (
              <CheckCircle2 className="w-8 h-8 text-white" />
            ) : (
              <Fingerprint className="w-8 h-8 text-white" />
            )}
          </div>
          
          {isVerified ? (
            <p className="text-green-600 font-medium">Two-factor authentication successful</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-center">
                {isLoading 
                  ? "Verifying your passkey..." 
                  : "Use your fingerprint, face, or device PIN to verify"}
              </p>

              {/* Domain mismatch warning */}
              {domainMismatchWarning && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl w-full">
                  <Globe className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">{domainMismatchWarning}</p>
                </div>
              )}

              {error && (
                <div className="flex flex-col gap-2 p-3 bg-destructive/10 rounded-xl w-full">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                  {error.includes('domain') && enabledMethods.length > 1 && (
                    <p className="text-xs text-muted-foreground ml-6">
                      Try using Authenticator App or Telegram instead.
                    </p>
                  )}
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-muted-foreground">Waiting for passkey...</span>
                </div>
              ) : (
                <Button
                  onClick={startPasskeyVerification}
                  className="w-full"
                  size="lg"
                >
                  <Fingerprint className="w-5 h-5 mr-2" />
                  Try Again
                </Button>
              )}

              {enabledMethods.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => {
                    setStep('method-selection');
                    setSelectedMethod(null);
                  }}
                >
                  Change 2FA Method
                </Button>
              )}
            </>
          )}
        </div>
      </NativeBottomSheet>
    );
  }

  // ==================== RENDER: Set Password ====================
  if (step === 'set-password' && open) {
    return (
      <NativeBottomSheet
        isOpen={open}
        onClose={onClose}
        title="Set New Password"
        height="auto"
      >
        <div className="flex flex-col space-y-4 pb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          
          <p className="text-sm text-muted-foreground text-center">
            Create a new secure password for your account
          </p>

          <div className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button
              onClick={handlePasswordReset}
              disabled={isLoading || !newPassword || !confirmPassword}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </div>
        </div>
      </NativeBottomSheet>
    );
  }

  // ==================== RENDER: Success ====================
  if (step === 'success' && open) {
    return (
      <NativeBottomSheet
        isOpen={open}
        onClose={onClose}
        height="auto"
      >
        <div className="flex flex-col items-center space-y-4 pb-4">
          <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          
          <h3 className="text-xl font-bold">Password Updated!</h3>
          <p className="text-sm text-muted-foreground text-center">
            Your password has been successfully changed. Redirecting you now...
          </p>
        </div>
      </NativeBottomSheet>
    );
  }

  return null;
};

export default PasswordReset2FAFlow;
