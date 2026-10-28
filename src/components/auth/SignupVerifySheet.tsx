import { useEffect } from 'react';
import { Shield, Check, ArrowLeft } from 'lucide-react';
import WhatsAppOTPVerification from '@/components/WhatsAppOTPVerification';
import PhoneVerifyBox from '@/components/auth/PhoneVerifyBox';
import EmailOtpVerifyBox from '@/components/auth/EmailOtpVerifyBox';
import type { SignupOtpPage } from '@/hooks/useSignupEmailOtpSetting';

interface SignupVerifySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** E.164 phone number the codes are sent to */
  phone: string;
  /** Full name / company name used in the OTP message */
  name: string;
  /** WhatsApp OTP (owner trigger) */
  needWhatsApp: boolean;
  whatsAppVerified: boolean;
  whatsAppPurpose?: 'user_signup_otp' | 'company_signup_otp';
  onWhatsAppVerified?: () => void;
  /** SMS OTP (owner setting) */
  needSms: boolean;
  smsVerified: boolean;
  onSmsVerified?: (phoneE164: string) => void;
  /** Email OTP (owner "Verify OTP" page switch) */
  needEmail?: boolean;
  emailVerified?: boolean;
  email?: string;
  emailPage?: SignupOtpPage;
  onEmailVerified?: () => void;
  /** Fired once every required step is verified */
  onAllVerified: () => void;
}

/**
 * Full-screen verification page that collects the signup OTP(s).
 * Opens when "Create Account" is pressed while verification is switched ON.
 * When every required step is verified it closes and the account is created.
 */
export const SignupVerifySheet = ({
  open,
  onOpenChange,
  phone,
  name,
  needWhatsApp,
  whatsAppVerified,
  whatsAppPurpose = 'user_signup_otp',
  onWhatsAppVerified,
  needSms,
  smsVerified,
  onSmsVerified,
  onAllVerified,
  needEmail = false,
  emailVerified = false,
  email = '',
  emailPage = 'jobseeker',
  onEmailVerified,
}: SignupVerifySheetProps) => {
  const emailPending = needEmail && !emailVerified;
  const whatsAppPending = needWhatsApp && !whatsAppVerified;
  const smsPending = needSms && !smsVerified;
  const allDone = !emailPending && !whatsAppPending && !smsPending;

  useEffect(() => {
    if (!open || !allDone) return;
    const id = window.setTimeout(() => {
      onOpenChange(false);
      onAllVerified();
    }, 700);
    return () => window.clearTimeout(id);
  }, [open, allDone, onOpenChange, onAllVerified]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
      <div className="flex min-h-full w-full flex-col items-center px-5 pb-10 pt-4">
        <div className="flex w-full max-w-md items-center">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Go back"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/80"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-10 flex w-full max-w-md flex-col items-center text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary shadow-[0_12px_30px_-8px_hsl(var(--primary)/0.55)]">
            {allDone ? (
              <Check className="h-11 w-11 text-primary-foreground" />
            ) : (
              <Shield className="h-11 w-11 text-primary-foreground" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {allDone ? 'Verification Complete' : 'Verify Your Number'}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {allDone
              ? 'Creating your account...'
              : emailPending
                ? 'Enter the 6-digit code sent to your email'
                : `Enter the 6-digit code sent on WhatsApp to ${phone}`}
          </p>

          {!allDone && (
            <div className="mt-8 w-full space-y-2 text-left">
              {emailPending && (
                <EmailOtpVerifyBox
                  email={email}
                  name={name}
                  page={emailPage}
                  onVerified={() => onEmailVerified?.()}
                />
              )}

              {!emailPending && whatsAppPending && (
                <WhatsAppOTPVerification
                  phone={phone}
                  name={name}
                  purpose={whatsAppPurpose}
                  onVerified={() => onWhatsAppVerified?.()}
                  isPhoneValid
                />
              )}

              {!emailPending && !whatsAppPending && smsPending && (
                <PhoneVerifyBox
                  phone={phone}
                  mode="signup"
                  verified={false}
                  onVerified={(verifiedPhone) => onSmsVerified?.(verifiedPhone)}
                />
              )}

              {!emailPending && (<div className="mt-4 rounded-2xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">
                Didn't receive the code? Check that {phone} is correct and can
                receive WhatsApp messages, then tap Resend.
              </div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignupVerifySheet;
