import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Fingerprint, Loader2, CheckCircle, AlertTriangle, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { usePasskeySupport } from '@/hooks/usePasskeySupport';
import {
  registerNativePasskey,
  renameNativePasskey,
  listNativePasskeys,
  describePasskeyError,
  isPasskeyServerUnavailable,
  isPasskeyDomainMismatch,
  getPasskeyDomainMessage,
  getPasskeyDeviceName,

} from '@/lib/nativePasskey';


interface PasskeySetupProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  userType: 'job_seeker' | 'employer';
}

export const PasskeySetup: React.FC<PasskeySetupProps> = ({
  open,
  onClose,
  onSuccess,
  userId,
  userType,
}) => {
  const { toast } = useToast();
  const { tapFeedback, successFeedback, errorFeedback } = useNativeFeel();
  const { isIOS, buttonClass } = usePlatformStyle();
  const { isSupported: browserSupportsPasskey, isLoading: checkingPasskeySupport } = usePasskeySupport();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check browser support when component opens
  useEffect(() => {
    if (open && !checkingPasskeySupport && !browserSupportsPasskey) {
      setError('This browser doesn\'t support passkeys. Please use a modern browser with passkey support.');
    }
  }, [open, browserSupportsPasskey, checkingPasskeySupport]);

  const handleSetup = async () => {
    setIsLoading(true);
    setError(null);
    tapFeedback();

    try {
      // Check browser support
      if (!window.PublicKeyCredential) {
        throw new Error('Your browser does not support Passkeys. Please use a modern browser.');
      }

      const isConditionalMediationAvailable =
        typeof PublicKeyCredential.isConditionalMediationAvailable === 'function' &&
        await PublicKeyCredential.isConditionalMediationAvailable();

      const isPlatformAvailable =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

      if (!isConditionalMediationAvailable && !isPlatformAvailable) {
        throw new Error('Passkeys are not supported on this device. Please use a modern browser with passkey support.');
      }

      // Native Supabase passkey registration (handles the full WebAuthn ceremony)
      const passkey = await registerNativePasskey();

      // Give the passkey a readable device name where supported
      const passkeyId = (passkey as { id?: string } | null)?.id;
      if (passkeyId) {
        try {
          await renameNativePasskey(passkeyId, getPasskeyDeviceName());
        } catch {
          // Renaming is cosmetic — ignore failures
        }
      }

      // Confirm the credential really landed on the server before flagging 2FA on
      let registeredCount = 0;
      try {
        registeredCount = (await listNativePasskeys()).length;
      } catch {
        registeredCount = passkeyId ? 1 : 0;
      }

      if (registeredCount === 0) {
        throw new Error('Passkey was not saved to your account. Please try again.');
      }

      // Reflect the enabled state in the app's 2FA settings
      const tableName = userType === 'employer' ? 'employer_settings' : 'user_settings';
      const { error: settingsError } = await supabase
        .from(tableName)
        .upsert({
          user_id: userId,
          passkey_enabled: true,
          two_factor_enabled: true,
        }, { onConflict: 'user_id' });

      if (settingsError) {
        console.error('Failed to save passkey setting:', settingsError);
      }


      setIsSuccess(true);
      successFeedback();
      
      toast({
        title: 'Passkey Registered!',
        description: 'You can now use biometrics to verify your login.',
      });

      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: any) {
      console.error('Passkey setup error:', err);
      errorFeedback();

      setError(
        isPasskeyDomainMismatch()
          ? getPasskeyDomainMessage()
          : isPasskeyServerUnavailable(err)
            ? `Passkey setup is temporarily unavailable. ${describePasskeyError(err, '')}`.trim()
            : describePasskeyError(err, 'Failed to setup passkey')
      );

    } finally {
      setIsLoading(false);
    }
  };


  const handleClose = () => {
    if (!isLoading) {
      tapFeedback();
      setError(null);
      setIsSuccess(false);
      onClose();
    }
  };

  return (
    <NativeBottomSheet
      isOpen={open}
      onClose={handleClose}
      title="Setup Passkey"
      height="auto"
    >
      <div className="flex flex-col items-center animate-fade-in pb-4">
        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${
          isSuccess 
            ? 'bg-green-500 scale-110' 
            : error
              ? 'bg-destructive/10'
              : isIOS 
                ? 'bg-gradient-to-br from-primary to-primary/80' 
                : 'bg-primary shadow-lg shadow-primary/30'
        }`}>
          {isSuccess ? (
            <CheckCircle className="w-10 h-10 text-white animate-scale-in" />
          ) : error ? (
            <AlertTriangle className="w-10 h-10 text-destructive" />
          ) : (
            <Fingerprint className="w-10 h-10 text-white" />
          )}
        </div>

        {/* Title */}
        <h2 className={`text-xl font-bold mb-2 ${isIOS ? 'font-semibold' : 'font-bold'}`}>
          {isSuccess ? 'Passkey Registered!' : error ? 'Setup Failed' : 'Enable Passkeys'}
        </h2>

        {/* Description */}
        <p className="text-center text-muted-foreground mb-6 px-4">
          {isSuccess 
            ? 'You can now use biometrics or device PIN to verify your login.' 
            : error 
              ? error
              : 'Use Face ID, Touch ID, or your device PIN for quick and secure login verification.'}
        </p>

        {!isSuccess && !error && (
          <div className="w-full p-4 bg-muted/50 rounded-xl mb-6 space-y-3">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Your passkey will be saved to Google Password Manager (Android/Chrome) or iCloud Keychain (iOS/Mac) and synced across your devices.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full space-y-3">
          {isSuccess ? (
            <Button
              className={`w-full h-14 text-base font-semibold ${buttonClass} ${
                isIOS ? 'rounded-2xl' : 'rounded-xl'
              }`}
              onClick={handleClose}
            >
              Done
            </Button>
          ) : error ? (
            <>
              <Button
                className={`w-full h-14 text-base font-semibold ${buttonClass} ${
                  isIOS ? 'rounded-2xl' : 'rounded-xl'
                }`}
                onClick={() => {
                  setError(null);
                  handleSetup();
                }}
              >
                Try Again
              </Button>
              <Button
                variant="ghost"
                className="w-full h-12"
                onClick={handleClose}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                className={`w-full h-14 text-base font-semibold ${buttonClass} ${
                  isIOS ? 'rounded-2xl' : 'rounded-xl'
                }`}
                onClick={handleSetup}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5 mr-2" />
                    Setup Passkey
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full h-12"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    </NativeBottomSheet>
  );
};
