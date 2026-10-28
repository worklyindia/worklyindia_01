export const SUPABASE_PROJECT_ID = 'jubwzelupbntbetpajqb';
export const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o';
export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
export const FACEBOOK_WEBHOOK_URL = `${SUPABASE_FUNCTIONS_URL}/meta-whatsapp-webhook`;
export const X_WEBHOOK_URL = `${SUPABASE_FUNCTIONS_URL}/x-webhook`;
export const SUPABASE_SECRETS_URL = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/settings/vault/secrets`;

/**
 * Vite env first, hardcoded fallback second — a host build without the env
 * vars (e.g. Vercel missing VITE_SUPABASE_URL) must never produce
 * "undefined/functions/v1/..." requests.
 */
export const supabaseUrl = () =>
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || SUPABASE_URL;

export const supabasePublishableKey = () =>
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  SUPABASE_PUBLISHABLE_KEY;
