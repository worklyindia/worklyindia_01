export type SignupOtpPage = 'jobseeker' | 'employer' | 'ai';

/**
 * Email verification at signup is controlled only by Supabase Auth "Confirm email"
 * (the code screen after signup), so the website's own email-code step is always off.
 */
export const useSignupEmailOtpSetting = (_page: SignupOtpPage) => false;

export default useSignupEmailOtpSetting;
