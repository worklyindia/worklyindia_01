import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Fingerprint, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { usePasskeySupport } from '@/hooks/usePasskeySupport';
import {
  signInWithNativePasskey,
  describePasskeyError,
  isPasskeyServerUnavailable,
  isPasskeyDomainMismatch,
  getPasskeyDomainMessage,
} from '@/lib/nativePasskey';


interface PasskeyVerificationProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  userId: string;
  userType: 'job_seeker' | 'employer';
  multipleMethodsEnabled?: boolean;
  onShowMethodSelection?: () => void;
}

export const PasskeyVerification: React.FC<PasskeyVerificationProps> = ({
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
  const { isIOS, buttonClass } = usePlatformStyle();
  const { isSupported: browserSupportsPasskey, isLoading: checkingPasskeySupport } = usePasskeySupport();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoStarted, setAutoStarted] = useState(false);
  const [browserUnsupported, setBrowserUnsupported] = useState(false);

  // Check if browser supports passkeys when sheet opens
  useEffect(() => {
    if (open && !checkingPasskeySupport) {
      if (!browserSupportsPasskey) {
        setBrowserUnsupported(true);
        setError('This browser doesn\'t support passkeys. Please use a different verification method.');
      }
    }
  }, [open, browserSupportsPasskey, checkingPasskeySupport]);

  // Auto-start authentication when sheet opens (only if browser supports passkeys)
  useEffect(() => {
    if (open && !autoStarted && !isVerified && !error && browserSupportsPasskey && !checkingPasskeySupport) {
      setAutoStarted(true);
      // Small delay to let the sheet animate in
      const timer = setTimeout(() => {
        handleAuthenticate();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [open, autoStarted, isVerified, error, browserSupportsPasskey, checkingPasskeySupport]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setIsVerified(false);
      setError(null);
      setAutoStarted(false);
      setIsLoading(false);
      setBrowserUnsupported(false);
    }
  }, [open]);

  const handleAuthenticate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check browser support
      if (!window.PublicKeyCredential) {
        throw new Error('Your browser does not support Passkeys.');
      }

      // Native Supabase passkey authentication (full WebAuthn ceremony + session)
      const result = await signInWithNativePasskey();
      const verifiedUserId = (result?.user as { id?: string } | null)?.id;

      if (userId && verifiedUserId && verifiedUserId !== userId) {
        throw new Error('This passkey belongs to a different account.');
      }

      setIsVerified(true);
      successFeedback();

      toast({
        title: 'Verified!',
        description: 'Two-factor authentication successful',
      });

      setTimeout(() => {
        onVerified();
      }, 800);

    } catch (err: any) {
      console.error('Passkey authentication error:', err);
      errorFeedback();

      setError(
        isPasskeyDomainMismatch()
          ? getPasskeyDomainMessage()
          : isPasskeyServerUnavailable(err)
            ? 'Passkey verification is temporarily unavailable. Please use another verification method.'
            : describePasskeyError(err, 'Authentication failed')
      );

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

  

  return (
    <NativeBottomSheet
      isOpen={open}
      onClose={handleClose}
      title=""
      height="auto"
    >
      <div className="flex flex-col items-center animate-fade-in pb-4">
        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${
          isVerified 
            ? 'bg-green-500 scale-110' 
            : error
              ? 'bg-destructive/10'
              : isIOS 
                ? 'bg-gradient-to-br from-primary to-primary/80' 
                : 'bg-primary shadow-lg shadow-primary/30'
        }`}>
          {isVerified ? (
            <CheckCircle className="w-10 h-10 text-white animate-scale-in" />
          ) : error ? (
            <AlertTriangle className="w-10 h-10 text-destructive" />
          ) : isLoading ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : (
            <Fingerprint className="w-10 h-10 text-white" />
          )}
        </div>

        {/* Title */}
        <h2 className={`text-xl font-bold mb-2 ${isIOS ? 'font-semibold' : 'font-bold'}`}>
          {isVerified 
            ? 'Verified!' 
            : error 
              ? 'Verification Failed' 
              : isLoading 
                ? 'Verifying...' 
                : 'Verify with Passkey'}
        </h2>

        {/* Description */}
        <p className="text-center text-muted-foreground mb-6 px-4">
          {isVerified 
            ? 'Two-factor authentication successful' 
            : error 
              ? error
              : isLoading
                ? 'Please authenticate using your biometrics or device PIN'
                : 'Use Face ID, Touch ID, or your device PIN to verify your login.'}
        </p>

        {/* Action Buttons */}
        <div className="w-full space-y-3">
          {isVerified ? (
            <Button
              className={`w-full h-14 text-base font-semibold bg-green-500 hover:bg-green-600 ${
                isIOS ? 'rounded-2xl' : 'rounded-xl'
              }`}
              onClick={handleClose}
            >
              Continue
            </Button>
          ) : error ? (
            <>
              {/* If browser is unsupported, show method selection button prominently */}
              {browserUnsupported ? (
                <>
                  {multipleMethodsEnabled && onShowMethodSelection ? (
                    <Button
                      className={`w-full h-14 text-base font-semibold ${buttonClass} ${
                        isIOS ? 'rounded-2xl' : 'rounded-xl'
                      }`}
                      onClick={onShowMethodSelection}
                    >
                      Use Different Method
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className={`w-full h-14 text-base font-semibold ${
                        isIOS ? 'rounded-2xl' : 'rounded-xl'
                      }`}
                      onClick={handleClose}
                    >
                      Cancel
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    className={`w-full h-14 text-base font-semibold ${buttonClass} ${
                      isIOS ? 'rounded-2xl' : 'rounded-xl'
                    }`}
                    onClick={() => {
                      setError(null);
                      handleAuthenticate();
                    }}
                  >
                    <Fingerprint className="w-5 h-5 mr-2" />
                    Try Again
                  </Button>
                  
                  {/* Change 2FA Method - only show if multiple methods enabled */}
                  {multipleMethodsEnabled && onShowMethodSelection && (
                    <Button
                      variant="ghost"
                      className="w-full h-12"
                      onClick={onShowMethodSelection}
                    >
                      Change 2FA Method
                    </Button>
                  )}
                </>
              )}
            </>
          ) : !isLoading && (
            <>
              <Button
                className={`w-full h-14 text-base font-semibold ${buttonClass} ${
                  isIOS ? 'rounded-2xl' : 'rounded-xl'
                }`}
                onClick={handleAuthenticate}
                disabled={isLoading}
              >
                <Fingerprint className="w-5 h-5 mr-2" />
                Verify with Passkey
              </Button>
              
              {/* Change 2FA Method - only show if multiple methods enabled */}
              {multipleMethodsEnabled && onShowMethodSelection && (
                <Button
                  variant="ghost"
                  className="w-full h-12"
                  onClick={onShowMethodSelection}
                >
                  Change 2FA Method
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </NativeBottomSheet>
  );
};
