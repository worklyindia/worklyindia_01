// =============================================================================
// Notification channel preference
// -----------------------------------------------------------------------------
// Job seekers and employers each control their own Email / Telegram switches.
// Turning a channel OFF stops every notification on that channel until it is
// turned back ON, and the user gets one final confirmation message on that same
// channel ("unsubscribe" template). Turning it ON sends the "subscribe"
// template. Both confirmations bypass the switch itself.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { fanoutLifecycleChannels } from '../../_shared/lifecycleFanout.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ success: false, error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const audience = body?.audience === 'employer' ? 'employer' : 'job_seeker';
    const channel = body?.channel === 'telegram' ? 'telegram' : 'email';
    const enabled = body?.enabled === true;

    const admin = createClient(supabaseUrl, serviceKey);
    const userId = user.id;

    // ------------------------------------------------------------- persist ---
    if (channel === 'email') {
      const table = audience === 'employer' ? 'employer_settings' : 'user_settings';
      const { error } = await admin
        .from(table)
        .upsert({ user_id: userId, email_notifications: enabled }, { onConflict: 'user_id' });
      if (error) return json({ success: false, error: error.message }, 400);
    } else if (audience === 'employer') {
      const { error } = await admin
        .from('companies')
        .update({ telegram_notifications_enabled: enabled })
        .eq('user_id', userId);
      if (error) return json({ success: false, error: error.message }, 400);
    } else {
      const { error } = await admin
        .from('profiles')
        .update({ telegram_notifications_enabled: enabled })
        .eq('user_id', userId);
      if (error) return json({ success: false, error: error.message }, 400);
    }

    // ------------------------------------------------- confirmation message ---
    const templateKey = enabled ? 'subscribe' : 'unsubscribe';
    const fanout = await fanoutLifecycleChannels(admin, {
      userId,
      templateKey,
      channels: [channel],
      bypassPreferences: true,
      variables: {
        channel: channel === 'email' ? 'Email' : 'Telegram',
        status: enabled ? 'subscribed' : 'unsubscribed',
      },
      fallbackTitle: enabled ? 'You are subscribed' : 'You are unsubscribed',
      fallbackMessage: enabled
        ? `You will now receive Workly India notifications on ${channel === 'email' ? 'Email' : 'Telegram'}.`
        : `You will no longer receive Workly India notifications on ${channel === 'email' ? 'Email' : 'Telegram'}. You can turn them back on anytime in Settings.`,
    });

    return json({ success: true, channel, enabled, delivery: fanout[channel] });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[notification-channel-preference]', detail);
    return json({ success: false, error: detail }, 500);
  }
};
