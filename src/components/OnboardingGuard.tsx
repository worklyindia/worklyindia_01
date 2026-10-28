import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import { usePhoneVerifySetting } from '@/hooks/usePhoneVerifySetting';
import { requiresAccountPhone } from '@/lib/onboardingPhone';
import RequiredNumberVerification from '@/components/auth/RequiredNumberVerification';

/**
 * Global onboarding gate.
 *
 * Job seeker side: jab tak profile complete nahi, website ka koi bhi page
 * nahi khulega — sirf /JobSeeker/Setup.
 * Employer side: jab tak company profile complete nahi, employer ka koi bhi
 * page nahi khulega — sirf /Employer/Setup.
 *
 * Dono side ka check bilkul alag rehta hai.
 */

const JOBSEEKER_SETUP = '/JobSeeker/Setup';
const EMPLOYER_SETUP = '/Employer/Setup';

// Ye paths hamesha khule rehte hain (auth, legal, admin, oauth vagairah).
const ALWAYS_ALLOWED_PREFIXES = [
  '/auth',
  '/employer-auth',
  '/signup',
  '/employer-signup',
  '/forgot-password',
  '/employer-forgot-password',
  '/oauth',
  '/banned',
  '/employer-disabled',
  '/admin',
  '/owner-portal',
  '/reset-password',
  '/verify',
  '/JobSeeker/Setup',
  '/Employer/Setup',
  '/profile-setup',
  '/referral',
  '/referral-profile',
  '/referral-onboarding',
  '/referral-code',
  '/referral-activity',
  '/employer/referral',
  '/employer/referral-code',
  '/employer/referral-activity',
];

const ALWAYS_ALLOWED_EXACT = [
  '/pricing',
  '/privacy',
  '/privacy-policy',
  '/terms',
  '/terms-and-conditions',
  '/terms-conditions',
  '/refund-policy',
  '/cookie-policy',
  '/cookies',
  '/dmca',
  '/disclaimer',
  '/job-policy',
  '/points-policy',
  '/accessibility',
  '/community-guidelines',
  '/employer-guidelines',
  '/job-seeker-guidelines',
  '/trust-safety',
  '/contact',
  '/contact-us',
];

const normalize = (pathname: string) =>
  (pathname.replace(/\/+$/, '') || '/').toLowerCase();

const isAlwaysAllowed = (pathname: string) => {
  const path = normalize(pathname);
  if (ALWAYS_ALLOWED_EXACT.includes(path)) return true;
  return ALWAYS_ALLOWED_PREFIXES.some(
    (p) => path === normalize(p) || path.startsWith(`${normalize(p)}/`),
  );
};

const isEmployerPath = (pathname: string) => {
  const path = normalize(pathname);
  return path === '/employer' || path.startsWith('/employer');
};

const OnboardingGuard = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { user, profile, loading, profileLoading, checkProfileCompletion, refreshProfile } = useAuth();
  const {
    user: employerUser,
    company,
    loading: employerLoading,
    companyLoading,
    checkCompanyCompletion,
    refreshCompany,
  } = useEmployerAuth();

  const path = location.pathname;
  const redirectTarget = path + location.search;
  const { phoneVerifyEnabled, phoneVerifyLoading } = usePhoneVerifySetting('phone_verify_jobseeker_profile');
  const activeUser = user || employerUser;
  const employerAccount = activeUser?.user_metadata?.user_type === 'employer' || Boolean(company);
  const numberExempt = /^(\/auth|\/employer-auth|\/signup|\/employer-signup|\/forgot-password|\/employer-forgot-password|\/reset-password|\/oauth|\/admin|\/owner-portal|\/banned|\/employer-disabled|\/developers?)(\/|$)/i.test(path)
    || ALWAYS_ALLOWED_EXACT.includes(normalize(path));

  // Check before setup/referral exemptions: completed legacy accounts must verify too.
  if (activeUser && !numberExempt) {
    const needsNumber = requiresAccountPhone(phoneVerifyEnabled, activeUser);
    // Sending the OTP refreshes the account; keep the number screen mounted so the OTP boxes stay visible.
    if (!needsNumber || phoneVerifyLoading) {
      if (phoneVerifyLoading || loading || employerLoading || profileLoading || companyLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
      }
    }
    if (needsNumber) {
      return <RequiredNumberVerification key={activeUser.id} user={activeUser} employer={employerAccount}
        savedPhone={employerAccount ? company?.phone : profile?.phone}
        onComplete={() => { void (employerAccount ? refreshCompany() : refreshProfile()); }} />;
    }
  }

  if (isAlwaysAllowed(path)) {
    return <>{children}</>;
  }

  // ---- Employer side ----
  if (isEmployerPath(path)) {
    if (employerLoading || companyLoading) return <>{children}</>;
    if (employerUser && (!company || !checkCompanyCompletion())) {
      return (
        <Navigate
          to={`${EMPLOYER_SETUP}?redirect=${encodeURIComponent(redirectTarget)}`}
          replace
        />
      );
    }
    return <>{children}</>;
  }

  // ---- Job seeker side (baaki poori website) ----
  if (loading || profileLoading) return <>{children}</>;
  if (user && (!profile || !checkProfileCompletion())) {
    return (
      <Navigate
        to={`${JOBSEEKER_SETUP}?redirect=${encodeURIComponent(redirectTarget)}`}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default OnboardingGuard;
