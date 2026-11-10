import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Loader2, CheckCircle, AlertTriangle, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { distributeOtpDigits, readPastedOtp } from '@/utils/otpInput';

interface GoogleAuthenticatorVerificationProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  userId: string;
  userType: 'job_seeker' | 'employer';
  multipleMethodsEnabled?: boolean;
  onShowMethodSelection?: () => void;
}

export const GoogleAuthenticatorVerification: React.FC<GoogleAuthenticatorVerificationProps> = ({
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
  
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setOtp(['', '', '', '', '', '']);
      setRecoveryCode('');
      setIsVerified(false);
      setError(null);
      setMode('totp');
    }
  }, [open]);

  const applyOtpDigits = (startIndex: number, raw: string) => {
    const { otp: newOtp, focusIndex } = distributeOtpDigits(otp, startIndex, raw);
    tapFeedback();
    setOtp(newOtp);
    setError(null);
    inputRefs.current[focusIndex]?.focus();

    const code = newOtp.join('');
    if (code.length === 6 && newOtp.every(digit => digit !== '')) {
      verifyTOTP(code);
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

  const verifyTOTP = async (code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: verifyError } = await supabase.functions.invoke('unified-totp', {
        body: { action: 'verify-login', userId, userType, token: code }
      });

      if (verifyError) {
        console.error('TOTP verification error:', verifyError);
        if (verifyError.message?.includes('404') || verifyError.message?.includes('NOT_FOUND')) {
          setError('Verification service temporarily unavailable. Please try again later.');
        } else {
          setError('Verification failed. Please check your code.');
        }
        errorFeedback();
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setIsLoading(false);
        return;
      }

      if (data?.success) {
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
        setError(data?.error || 'Invalid code. Please check your 6-digit code.');
        errorFeedback();
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      console.error('TOTP verification error:', err);
      setError('Verification failed. Please check your code.');
      errorFeedback();
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const verifyRecoveryCode = async () => {
    if (!recoveryCode.trim()) {
      setError('Please enter a recovery code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: verifyError } = await supabase.functions.invoke('unified-totp', {
        body: { action: 'verify-recovery', userId, userType, recoveryCode: recoveryCode.trim() }
      });

      if (verifyError) {
        console.error('Recovery code verification error:', verifyError);
        if (verifyError.message?.includes('404') || verifyError.message?.includes('NOT_FOUND')) {
          setError('Recovery code service temporarily unavailable. Please try again later.');
        } else {
          setError('Verification failed. Please check your recovery code.');
        }
        errorFeedback();
        setRecoveryCode('');
        setIsLoading(false);
        return;
      }

      if (data?.success) {
        setIsVerified(true);
        successFeedback();
        
        const remainingMsg = data.remainingCodes > 0 
          ? `${data.remainingCodes} recovery codes remaining.`
          : 'No recovery codes left. Generate new ones!';
        
        toast({
          title: "Verified!",
          description: remainingMsg,
        });
        setTimeout(() => {
          onVerified();
        }, 800);
      } else {
        setError(data?.error || 'Invalid or used recovery code.');
        errorFeedback();
        setRecoveryCode('');
      }
    } catch (err) {
      console.error('Recovery code verification error:', err);
      setError('Verification failed. Please check your recovery code.');
      errorFeedback();
    } finally {
      setIsLoading(false);
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
      onClose={() => !isLoading && onClose()}
      height="auto"
    >
      <div className="flex flex-col items-center animate-fade-in pb-4">
        {/* Icon */}
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

        <h2 className={`text-xl font-bold mb-2`}>
          {isVerified ? "Verified!" : "Two-Factor Authentication"}
        </h2>

        <p className="text-center text-muted-foreground mb-6">
          {isVerified ? (
            <span className="text-green-600 font-medium">Logging you in now...</span>
          ) : mode === 'totp' ? (
            "Enter the 6-digit code from Google Authenticator"
          ) : (
            "Enter one of your backup recovery codes"
          )}
        </p>

        {!isVerified && (
          <div className="w-full space-y-6">
            {mode === 'totp' ? (
              <>
                {/* OTP Input */}
                <div className="flex justify-center items-center gap-2" onPaste={handlePaste}>
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

                  <div className="w-3 h-0.5 bg-muted-foreground/30 rounded-full" />

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

                {/* Switch Options */}
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => {
                      tapFeedback();
                      setMode('recovery');
                      setError(null);
                    }}
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Use Recovery Code Instead
                  </Button>
                  
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
                </div>
              </>
            ) : (
              <>
                {/* Recovery Code Input */}
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="XXXX-XXXX"
                    value={recoveryCode}
                    onChange={(e) => {
                      setRecoveryCode(e.target.value.toUpperCase());
                      setError(null);
                    }}
                    className="text-center text-lg tracking-wider h-14 rounded-xl font-mono"
                    autoFocus
                  />

                  <Button 
                    className="w-full h-12 rounded-xl"
                    onClick={verifyRecoveryCode}
                    disabled={isLoading || !recoveryCode.trim()}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify Recovery Code'
                    )}
                  </Button>
                </div>

                {/* Switch back to TOTP */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    tapFeedback();
                    setMode('totp');
                    setError(null);
                    setRecoveryCode('');
                  }}
                >
                  ← Back to Authenticator Code
                </Button>
              </>
            )}

            {/* Error Message */}
            {error && (
              <div className={`flex items-center justify-center p-4 animate-fade-in rounded-xl bg-destructive/10`}>
                <AlertTriangle className="w-4 h-4 text-destructive mr-2 flex-shrink-0" />
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && mode === 'totp' && (
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-muted-foreground font-medium">Verifying...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </NativeBottomSheet>
  );
};

export default GoogleAuthenticatorVerification;
