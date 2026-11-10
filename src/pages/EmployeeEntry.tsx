import { lazy, Suspense } from 'react';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import ProtectedEmployerRoute from '@/components/ProtectedEmployerRoute';
import EmployeeLanding from './EmployeeLanding';
const EmployerPortal = lazy(() => import('./EmployerPortal'));
const waiting = <div className="flex min-h-screen items-center justify-center bg-background"><div role="status" aria-label="Loading" className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
export default function EmployeeEntry() {
  const { user, loading } = useEmployerAuth();
  if (loading) return waiting;
  if (!user) return <EmployeeLanding />;
  return <ProtectedEmployerRoute requireCompleteProfile><Suspense fallback={waiting}><EmployerPortal /></Suspense></ProtectedEmployerRoute>;
}
