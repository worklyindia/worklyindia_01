// Shared event notification helper.
//
// Every app event must reach the ONE notification hub
// (email-api → action "send_push"), because that is where the
// owner-saved Push / Email / Telegram templates are applied and where the
// audience (job seeker vs employer) switches are honoured.
//
// Call sites used to invoke a `telegram-trigger-handler` function that no
// longer exists (it was merged into unified-telegram-api), so those events were
// silently lost. Use notifyEvent() instead.

export interface NotifyEventInput {
  /** Owner template key / event_type, e.g. "job_posted". */
  eventType: string;
  userId: string | null | undefined;
  audience: 'job_seeker' | 'employer';
  /** Display name used by {{name}}. */
  name?: string | null;
  /** Any extra placeholder values ({{amount}}, {{job_title}} ...). */
  variables?: Record<string, unknown>;
  /** Safety net text if no owner template exists for this event yet. */
  fallbackTitle?: string;
  fallbackMessage?: string;
}

export async function notifyEvent(supabase: any, input: NotifyEventInput) {
  const { eventType, userId, audience } = input;
  if (!userId || !eventType) return { sent: false, error: 'missing user or event' };

  const variables: Record<string, unknown> = { ...(input.variables ?? {}) };
  if (input.name && String(input.name).trim()) variables.name = String(input.name).trim();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) return { sent: false, error: 'not configured' };

    const response = await fetch(`${supabaseUrl}/functions/v1/email-api`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'send_push',
        user_id: userId,
        audience,
        event_type: eventType,
        title: input.fallbackTitle || 'Workly India',
        message: input.fallbackMessage || 'You have a new update on Workly India.',
        variables,
        data: { type: eventType, ...variables },
        skip_rephrase: true,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`[eventNotify] ${eventType} failed: ${response.status}`, data?.error ?? '');
      return { sent: false, error: data?.error ?? `hub ${response.status}` };
    }
    return { sent: data?.sent !== false, response: data };
  } catch (err) {
    console.error(`[eventNotify] ${eventType} transport error:`, err instanceof Error ? err.message : err);
    return { sent: false, error: 'transport error' };
  }
}
