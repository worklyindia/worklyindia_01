import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'onboarding_status_developer';

/** Blocks developer pages until the developer profile is complete. */
const DeveloperProfileGate = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [state, setState] = useState<'loading' | 'ok' | 'setup'>(() =>
    localStorage.getItem(CACHE_KEY) === 'complete' ? 'ok' : 'loading',
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setState('ok'); return; }
      const { data } = await (supabase as any)
        .from('developer_profiles')
        .select('is_profile_complete')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      if (data?.is_profile_complete) {
        localStorage.setItem(CACHE_KEY, 'complete');
        setState('ok');
        return;
      }
      // Team members invited by a developer use developer pages (e.g. the Chat Widget
      // Inbox) without their own developer profile.
      const { data: tm } = await (supabase as any)
        .from('admin_users')
        .select('created_by')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      if (tm?.created_by) {
        setState('ok');
      } else {
        localStorage.removeItem(CACHE_KEY);
        setState('setup');
      }
    })();
    return () => { active = false; };
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (state === 'setup') {
    const redirect = location.pathname + location.search;
    return <Navigate to={`/developers/setup?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  return <>{children}</>;
};

export default DeveloperProfileGate;
