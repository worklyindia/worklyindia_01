import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getExternalJobShareUrl,
  getExternalJobShortShareUrl,
} from '@/config/domainConfig';

type ExternalJob = Parameters<typeof getExternalJobShareUrl>[0];

/**
 * Returns a short `/ej/s/:shortId` share URL for an external partner job.
 * Falls back to the long self-hydrating `/ej/:source/:extId?d=...` URL until
 * the shorten call resolves, or permanently if the call fails.
 *
 * Enabled controls when to actually call the edge function (e.g. only when
 * a share sheet is open) so we don't spend a round-trip per rendered card.
 */
export function useShortExternalJobUrl(
  job: ExternalJob | undefined,
  enabled: boolean = true,
): string {
  const fallback = job ? getExternalJobShareUrl(job) : '';
  const [shortUrl, setShortUrl] = useState<string>('');

  useEffect(() => {
    if (!enabled || !job?.external_id) return;
    let cancelled = false;

    const extId = String(job.external_id);
    const sourceFromId = extId.split('_')[0]?.toLowerCase() || '';
    const sourceRaw = sourceFromId || (job.source || 'ext').toLowerCase();
    const source = sourceRaw.replace(/[^a-z0-9]/g, '') || 'ext';

    // Compact payload the /ej/s/:shortId page will hydrate from.
    const payload = {
      external_id: extId,
      title: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      type: job.type,
      link: job.link,
      source: job.source,
      updated: job.updated ?? null,
      company_logo: job.company_logo ?? null,
      category: job.category ?? null,
    };

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          'external-job-shorten',
          { body: { source, ext_id: extId, payload } },
        );
        if (cancelled) return;
        if (error) {
          console.warn('[useShortExternalJobUrl] shorten failed', error);
          return;
        }
        const shortId = (data as { short_id?: string } | null)?.short_id;
        if (shortId) setShortUrl(getExternalJobShortShareUrl(shortId));
      } catch (e) {
        if (!cancelled) console.warn('[useShortExternalJobUrl] error', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, job?.external_id, job?.source]);

  return shortUrl || fallback;
}

const shortCache = new Map<string, Promise<string | null>>();

/** Resolve (and cache) the short `/ej/s/:id` URL; null if shortening fails. */
export function resolveShortExternalJobUrl(job: ExternalJob): Promise<string | null> {
  const extId = String(job.external_id || '');
  if (!extId) return Promise.resolve(null);
  const cached = shortCache.get(extId);
  if (cached) return cached;
  const source = ((extId.split('_')[0] || job.source || 'ext').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'ext';
  const payload = {
    external_id: extId, title: job.title, company: job.company, location: job.location,
    salary: job.salary, type: job.type, link: job.link, source: job.source,
    updated: job.updated ?? null, company_logo: job.company_logo ?? null, category: job.category ?? null,
  };
  const p = supabase.functions
    .invoke('external-job-shorten', { body: { source, ext_id: extId, payload } })
    .then(({ data, error }) => {
      const id = (data as { short_id?: string } | null)?.short_id;
      if (error || !id) { shortCache.delete(extId); return null; }
      return getExternalJobShortShareUrl(id);
    })
    .catch(() => { shortCache.delete(extId); return null; });
  shortCache.set(extId, p);
  return p;
}
