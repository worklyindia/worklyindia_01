import { useEffect, useRef } from 'react';

/**
 * WebOTP API — Chrome (Android) shows a native
 * "Allow Chrome to read the message below and enter the code?" prompt
 * and auto-fills the SMS OTP into the app.
 *
 * Requirements for the prompt to appear:
 *  - Page served over HTTPS
 *  - Chrome on Android (silently no-ops elsewhere)
 *  - SMS text must end with a line: `@your-domain.com #123456`
 */
export const useWebOTP = (
  onCode: (code: string) => void,
  enabled: boolean = true,
  nativeSmsConsent: boolean = false
) => {
  const handlerRef = useRef(onCode);
  handlerRef.current = onCode;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (nativeSmsConsent) {
      const nativeBridge = (window as Window & { WorklyAndroid?: { startSmsUserConsent?: () => boolean } }).WorklyAndroid;
      try { nativeBridge?.startSmsUserConsent?.(); } catch { /* browser/manual fallback */ }
    }
    const onNativeOtp = (event: Event) => {
      const code = (event as CustomEvent<{ code?: string }>).detail?.code?.replace(/\D/g, '');
      if (code && code.length >= 4) handlerRef.current(code.slice(0, 6));
    };
    if (nativeSmsConsent) window.addEventListener('workly-sms-otp', onNativeOtp as EventListener);
    const controller = new AbortController();
    if ('OTPCredential' in window && window.isSecureContext) {
      (navigator.credentials as unknown as {
        get: (o: unknown) => Promise<{ code?: string } | null>;
      })
        .get({ otp: { transport: ['sms'] }, signal: controller.signal })
        .then((otpCred) => {
          const code = otpCred?.code?.replace(/\D/g, '');
          if (code && code.length >= 4) handlerRef.current(code.slice(0, 6));
        })
        .catch(() => {
          /* aborted or denied — silently ignore */
        });
    }

    return () => {
      controller.abort();
      if (nativeSmsConsent) window.removeEventListener('workly-sms-otp', onNativeOtp as EventListener);
    };
  }, [enabled, nativeSmsConsent]);
};

export default useWebOTP;
