import { FunctionsHttpError } from '@supabase/supabase-js';

/** Surface send failures without exposing raw OAuth/provider responses. */
export async function emailTestError(error: unknown): Promise<string> {
  let message = error instanceof Error ? error.message : 'Please try again.';
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.clone().json().catch(() => null);
    if (typeof body?.error === 'string') message = body.error;
  }
  if (/unauthorized_client|invalid_client/i.test(message)) {
    return 'Gmail permission was rejected. Check the Google connection credentials in Owner Secrets, then reconnect the Employee Gmail mailbox in Email Templates settings.';
  }
  if (/invalid_grant|token.*expired|token.*revoked/i.test(message)) {
    return 'Mailbox permission has expired. Reconnect this mailbox in Email Templates settings, then send the test again.';
  }
  if (/No working mailbox|mailbox_not_connected/i.test(message)) {
    return 'No working mailbox is connected for this audience. Connect or repair its mailbox in Email Templates settings, then try again.';
  }
  if (/non-2xx/i.test(message)) return 'The email service could not send the test. Check the mailbox connection and try again.';
  return message;
}