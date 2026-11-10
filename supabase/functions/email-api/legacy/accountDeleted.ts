// =============================================================================
// notify-account-deleted
// -----------------------------------------------------------------------------
// Sends the owner-editable "account deleted" Email + Telegram templates when an
// admin removes a job seeker profile (Website Users) or a company profile
// (Employers). The caller passes the name / email captured BEFORE the delete,
// because the rows are gone by the time we send.
// Admin / owner only.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CANONICAL_DOMAIN } from '../../_shared/domain.ts';
import { fanoutLifecycleChannels } from '../../_shared/lifecycleFanout.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPPORT_EMAIL = `contact@${CANONICAL_DOMAIN}`;

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ---- Only an owner / admin may trigger this -----------------------------
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!bearer) return json({ success: false, error: 'Unauthorized' }, 401);

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (bearer !== serviceKey) {
      const { data: userData } = await admin.auth.getUser(bearer);
      const callerId = userData?.user?.id;
      if (!callerId) return json({ success: false, error: 'Unauthorized' }, 401);
      const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', callerId);
      const privileged = (roles ?? []).some((r: { role: string }) => r.role === 'owner' || r.role === 'admin');
      if (!privileged) return json({ success: false, error: 'Forbidden' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const userId = typeof body.user_id === 'string' ? body.user_id : '';
    const audience: 'job_seeker' | 'employer' = body.audience === 'employer' ? 'employer' : 'job_seeker';
    const name = (typeof body.name === 'string' && body.name.trim()) || 'User';
    const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null;

    if (!userId) return json({ success: false, error: 'user_id is required' }, 400);
    if (!email) return json({ success: false, status: 'skipped', reason: 'no_email' });

    const now = new Date();
    const date = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(now);
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(now);

    const result = await fanoutLifecycleChannels(admin, {
      userId,
      templateKey: audience === 'employer' ? 'employer_account_deleted' : 'job_seeker_account_deleted',
      email,
      // The profile rows are already deleted, so preferences cannot be read and
      // the ban guard must not swallow this final message.
      bypassPreferences: true,
      variables: { name, company: name, email, date, time },
      fallbackTitle: audience === 'employer'
        ? 'Your Workly India employer profile has been deleted'
        : 'Your Workly India profile has been deleted',
      fallbackMessage: `Hi ${name}, your Workly India ${audience === 'employer' ? 'employer profile' : 'profile'} has been deleted. If this was unexpected, contact ${SUPPORT_EMAIL}.`,
    });

    console.log(`[notify-account-deleted] ${audience} ${userId}:`, JSON.stringify(result));
    return json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[notify-account-deleted] failed:', message);
    return json({ success: false, error: message }, 500);
  }
};
