import { useState, useEffect } from 'react';

interface PasskeySupportResult {
  isSupported: boolean;
  isLoading: boolean;
  reason?: string;
}

/**
 * Hook to detect WebAuthn/Passkey browser support
 * Checks for:
 * - Basic WebAuthn support (PublicKeyCredential)
 * - Platform authenticator availability (biometrics/device PIN)
 * - Conditional mediation support (synced passkeys)
 */
export const usePasskeySupport = (): PasskeySupportResult => {
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reason, setReason] = useState<string | undefined>();

  useEffect(() => {
    const checkPasskeySupport = async () => {
      try {
        // The native Android WebView exposes WebAuthn after the app enables
        // WebViewFeature.WEB_AUTHENTICATION in MainActivity. Do not reject the
        // app merely because it is not a full Chrome browser.
        const nativeAndroid = Boolean((window as any).WorklyAndroid?.isNativeAndroidApp?.());

        // Check basic WebAuthn support
        if (!window.PublicKeyCredential) {
          setReason('WebAuthn is not supported in this browser');
          setIsSupported(false);
          setIsLoading(false);
          return;
        }

        // Check for platform authenticator (Face ID, Touch ID, Windows Hello, device PIN)
        const isPlatformAvailable = 
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

        // Check for conditional mediation (synced passkeys) if available
        let isConditionalMediationAvailable = false;
        if (typeof PublicKeyCredential.isConditionalMediationAvailable === 'function') {
          isConditionalMediationAvailable = 
            await PublicKeyCredential.isConditionalMediationAvailable();
        }

        // Passkeys are usable if either platform authenticator OR conditional mediation is available
        const supported = isPlatformAvailable || isConditionalMediationAvailable || (nativeAndroid && isPlatformAvailable);
        
        if (!supported) {
          setReason('No platform authenticator available on this device');
        }
        
        setIsSupported(supported);
      } catch (error) {
        console.error('Error checking passkey support:', error);
        setReason('Failed to check passkey support');
        setIsSupported(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPasskeySupport();
  }, []);

  return { isSupported, isLoading, reason };
};
