// Per-user social platform API (X / LinkedIn): connect, A-Z data snapshot,
// AI auto-reply settings, runs and logs. Mirrors the YouTube auto-reply flow.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SOCIAL_ACTIONS, handleSocialAction, handleTwitchEventSub, type SocialAction } from "../_shared/socialAutoReply.ts";
import {
  INTEGRATION_ACTIONS,
  handleIntegrationAction,
  handleIntegrationCallback,
  isIntegrationCallback,
} from "../_shared/userIntegrations.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Twitch EventSub webhook (chat messages for AI auto-reply).
  if (req.headers.get('twitch-eventsub-message-type')) {
    return await handleTwitchEventSub(req);
  }

  // Vercel OAuth redirect lands here (no JSON body, no auth header).
  if (isIntegrationCallback(new URL(req.url).pathname)) {
    return await handleIntegrationCallback(req);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');

    if ((INTEGRATION_ACTIONS as readonly string[]).includes(action)) {
      const payload = await handleIntegrationAction(action, body, req);
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!SOCIAL_ACTIONS.includes(action as SocialAction)) {
      return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[social API] action=${action} platform=${body?.platform || '-'}`);
    const payload = await handleSocialAction(action as SocialAction, body, req);
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[social API] error:', msg);
    const code = msg.startsWith('AUTH_REQUIRED')
      ? 'AUTH_REQUIRED'
      : msg.startsWith('RECONNECT_REQUIRED')
        ? 'RECONNECT_REQUIRED'
        : 'SOCIAL_ERROR';
    return new Response(JSON.stringify({ success: false, code, error: msg.replace(/^[A-Z_]+: /, '') }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
