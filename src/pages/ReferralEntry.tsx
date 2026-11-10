import { lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ReferralOnboardingGuard } from '@/components/referral/ReferralOnboardingGuard';
import ReferralLanding from './ReferralLanding';
const Referral = lazy(() => import('./Referral'));
const waiting = <div className="flex min-h-screen items-center justify-center bg-background"><div role="status" aria-label="Loading" className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
export default function ReferralEntry() {
  const { user, loading } = useAuth();
  if (loading) return waiting;
  if (!user) return <ReferralLanding />;
  return <ReferralOnboardingGuard><Suspense fallback={waiting}><Referral /></Suspense></ReferralOnboardingGuard>;
}
