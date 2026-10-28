import { useLiveAppSetting } from '@/hooks/useLiveAppSetting';

export type PhoneVerifyKey =
  | 'phone_verify_jobseeker_signup'
  | 'phone_verify_employer_signup'
  | 'phone_verify_ai_signup'
  | 'phone_verify_jobseeker_profile'
  | 'phone_verify_employer_profile';

/** One owner "Number Verify" switch for job seekers and employers covers signup, onboarding and settings. */
const EFFECTIVE_KEY: Record<PhoneVerifyKey, string> = {
  phone_verify_jobseeker_signup: 'number_verify_all',
  phone_verify_ai_signup: 'number_verify_all',
  phone_verify_jobseeker_profile: 'number_verify_all',
  phone_verify_employer_signup: 'number_verify_all',
  phone_verify_employer_profile: 'number_verify_all',
};

/** Owner-controlled phone OTP (sent on WhatsApp) switch stored in app_settings (live). */
export const usePhoneVerifySetting = (requested: PhoneVerifyKey) => {
  const { enabled, loading } = useLiveAppSetting(EFFECTIVE_KEY[requested]);
  return { phoneVerifyEnabled: enabled, phoneVerifyLoading: loading };
};

export default usePhoneVerifySetting;
