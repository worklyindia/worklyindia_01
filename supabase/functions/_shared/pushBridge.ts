// Single push hub bridge.
// Every edge function that needs to send a push notification routes through
// the one email-api function instead of talking to FCM itself.
// This keeps push logic (tokens, AI rephrase, logging, cleanup) in ONE place.

const HUB = 'email-api';

export interface HubPushToUser {
  user_id: string;
  title: string;
  message: string;
  action_url?: string;
  image_url?: string;
  button_text?: string;
  data?: Record<string, unknown>;
  skip_rephrase?: boolean;
  event_type?: string;
  /**
   * Which side of the marketplace this notification is for. Always pass it when
   * known: a login can own both a job-seeker profile and a company, and the side
   * decides the switches, mailbox and Telegram bot used.
   */
  audience?: 'employer' | 'job_seeker';
  /** Placeholder values for the owner-saved template ({{name}}, {{amount}} …). */
  variables?: Record<string, unknown>;
}

export interface HubPushDirect {
  player_ids: string[];
  title: string;
  message: string;
  url?: string;
  image?: string;
  data?: Record<string, unknown>;
  buttons?: Array<{ id?: string; text: string; url?: string }>;
  no_ai?: boolean;
}

async function callHub(supabase: any, body: Record<string, unknown>) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
      return { sent: false, error: 'Push service is not configured' };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/${HUB}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof data?.error === 'string'
        ? data.error
        : Array.isArray(data?.errors)
          ? data.errors.join('; ')
          : `Push service failed (${response.status})`;
      console.error(`[pushBridge] ${HUB} failed: ${detail}`);
      return { sent: false, error: detail };
    }
    return { sent: data?.sent !== false, response: data };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[pushBridge] ${HUB} transport error: ${detail}`);
    return { sent: false, error: detail };
  }
}

/** Push to one user's registered devices (hub resolves the tokens). */
export function sendPushToUser(supabase: any, payload: HubPushToUser) {
  return callHub(supabase, { action: 'send_push', ...payload });
}

/** Push to explicit device tokens / player ids. */
export function sendPushToDevices(supabase: any, payload: HubPushDirect) {
  return callHub(supabase, { action: 'send_push_direct', ...payload });
}
