import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReferralProfile } from '@/hooks/useReferralProfile';
import { isReferralProfileComplete } from '@/utils/referralProfile';

export const ReferralOnboardingGuard = ({ children }: { children: ReactNode }) => {
  const { data, isLoading, isError, refetch } = useReferralProfile();
  const location = useLocation();
  if (isLoading) return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading referral profile" /></div>;
  if (isError) return <div className="min-h-screen grid content-center justify-items-center gap-4 bg-background"><p>Could not load your referral profile.</p><Button onClick={() => refetch()}>Try again</Button></div>;
  if (!isReferralProfileComplete(data)) return <Navigate replace to={`/referral-onboarding?redirect=${encodeURIComponent(location.pathname + location.search)}`} />;
  return <>{children}</>;
};