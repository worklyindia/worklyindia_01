import { lazy, Suspense } from 'react';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import ProtectedEmployerRoute from '@/components/ProtectedEmployerRoute';
import PostJobLanding from './PostJobLanding';
const PostNewJob = lazy(() => import('./employer/PostNewJob'));
const waiting = <div className="flex min-h-screen items-center justify-center bg-background"><div role="status" aria-label="Loading" className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
export default function PostJobEntry() {
  const { user, loading } = useEmployerAuth();
  if (loading) return waiting;
  if (!user) return <PostJobLanding />;
  return <ProtectedEmployerRoute requireCompleteProfile><Suspense fallback={waiting}><PostNewJob /></Suspense></ProtectedEmployerRoute>;
}
