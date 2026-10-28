import { supabase } from '@/integrations/supabase/client';
import {
  CANONICAL_DOMAIN,
  CANONICAL_DOMAIN_STORAGE_KEY,
  DEFAULT_CANONICAL_DOMAIN,
  isValidDomain,
  normalizeDomain,
} from '@/config/domainConfig';


/**
 * Loads the owner-configured canonical domain from `app_settings` and caches it
 * in localStorage so `domainConfig` can read it synchronously on next boot.
 * If the saved domain differs from the one currently in use, the page is
 * reloaded once so every URL builder picks up the new value.
 */
export const syncCanonicalDomain = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', CANONICAL_DOMAIN_STORAGE_KEY)
      .maybeSingle();

    if (error) return;

    const saved = data?.setting_value ? normalizeDomain(data.setting_value) : '';
    const next = saved && isValidDomain(saved) ? saved : DEFAULT_CANONICAL_DOMAIN;

    // Just cache for the next boot — never reload the page mid-visit,
    // otherwise users see the site load twice on every open.
    window.localStorage.setItem(CANONICAL_DOMAIN_STORAGE_KEY, next);
  } catch {
    /* offline or table unavailable — keep current domain */
  }
};
