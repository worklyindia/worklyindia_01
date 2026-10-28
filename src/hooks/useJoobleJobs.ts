import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeJobSearch, simplifySearchQuery } from '@/lib/jobSearchMatching';
import {
  readPersistentJobsCache,
  writePersistentJobsCache,
} from '@/utils/persistentJobsCache';


export interface JoobleJob {
  external_id: string;
  id?: string | number;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  description: string;
  snippet?: string;
  link: string;
  source: string;
  updated: string | null;
  employment?: string | null;
  experience?: string | null;
  education?: string | null;
  company_logo?: string | null;
  company_url?: string | null;
  category?: string | null;
  category_tag?: string | null;
  currency?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_is_predicted?: boolean | null;
  contract_time?: string | null;
  contract_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  area?: string[] | null;
  adref?: string | null;
  /** Complete raw provider payload (Jooble or Adzuna). */
  raw?: Record<string, any> | null;
}

interface UseJoobleJobsOptions {
  keywords?: string;
  location?: string;
  enabled?: boolean;
  limit?: number;
  /** Controls how Jooble ordering is nudged: latest = recent first, trending = default. */
  sort?: 'latest' | 'trending' | 'relevance';
}

type ExternalSource = 'jooble' | 'adzuna' | 'careerjet';

interface SourcePayload {
  jobs: any[];
  totalCount?: number;
  success?: boolean;
  error?: string;
  page?: number;
}

const SOURCE_CACHE_TTL = 0; // disabled — always fetch fresh external jobs
const STALE_SOURCE_CACHE_TTL = 24 * 60 * 60 * 1000; // in-memory fallback used only if a live request fails
const memorySourceCache = new Map<string, { timestamp: number; payload: SourcePayload }>();
const inflightSourceRequests = new Map<string, Promise<SourcePayload>>();

const getSourceCacheKey = (
  action: ExternalSource,
  keywords: string,
  location: string,
  page: number,
  limit: number,
  sort: string
) => `ext_${action}_${keywords.trim().toLowerCase()}_${location.trim().toLowerCase()}_${page}_${limit}_${sort}`;

const SOURCE_LABEL: Record<ExternalSource, string> = {
  jooble: 'Jooble',
  adzuna: 'Adzuna',
  careerjet: 'Careerjet',
};

const normalizeSourceJob = (job: any, action: ExternalSource): JoobleJob => ({
  ...job,
  external_id: String(job?.external_id || `${action}_${job?.id || crypto.randomUUID()}`),
  source: SOURCE_LABEL[action],
});


const readCachedSource = (key: string, maxAge: number): SourcePayload | null => {
  const cached = memorySourceCache.get(key);
  if (cached && Date.now() - cached.timestamp < maxAge) return cached.payload;

  // Persistent 24h layer (localStorage). Survives reloads and full app restarts.
  const persisted = readPersistentJobsCache<SourcePayload>(key);
  if (persisted) {
    memorySourceCache.set(key, { timestamp: Date.now(), payload: persisted });
    return persisted;
  }
  return null;
};

const writeCachedSource = (key: string, payload: SourcePayload) => {
  const entry = { timestamp: Date.now(), payload };
  memorySourceCache.set(key, entry);
  writePersistentJobsCache(key, payload);
};


/**
 * Fetches supplementary Indian job listings from Jooble via the existing
 * get-job-feed edge function (action: 'jooble'). Used to enrich the Jobs page
 * when the platform has few internal listings.
 */
export const useJoobleJobs = (options?: UseJoobleJobsOptions) => {
  const { keywords = '', location = '', enabled = true, limit = 20, sort = 'relevance' } = options || {};

  // One-time purge of any older-version external_jobs_* cache entries so
  // stale empty payloads from before the fix cannot mask fresh results.
  if (typeof window !== 'undefined' && !(window as any).__extJobsPurgedV6) {
    (window as any).__extJobsPurgedV6 = true;
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('external_jobs_') && !k.startsWith('external_jobs_v6_'))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {}
  }


  const [jobs, setJobs] = useState<JoobleJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(1);
  const seenIds = useRef<Set<string>>(new Set());
  const seenKeys = useRef<Set<string>>(new Set());
  const requestSeq = useRef(0);
  const emptyStreakRef = useRef(0);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (append && loadingRef.current) return;
      const currentRequest = ++requestSeq.current;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        // Alternate primary source per page (scroll): odd pages = Jooble first,
        // even pages = Adzuna first. If the primary fails or returns nothing
        // (e.g. platform limit reached), automatically fall back to the other.
        const callSource = async (action: ExternalSource, kw: string, sourceLocation = location): Promise<SourcePayload> => {
          const cacheKey = getSourceCacheKey(action, kw, sourceLocation, page, limit, sort);
          const fresh = readCachedSource(cacheKey, SOURCE_CACHE_TTL);
          if (fresh) return fresh;

          const pending = inflightSourceRequests.get(cacheKey);
          if (pending) return pending;

          const request = supabase.functions
            .invoke('get-job-feed', {
              body: { action, keywords: kw, location: sourceLocation, page, limit, sort },
            })
            .then(({ data, error }) => {
              if (error) throw error;
              const rawPayload = (data || { success: false, jobs: [] }) as SourcePayload;
              const payload: SourcePayload = {
                ...rawPayload,
                jobs: Array.isArray(rawPayload.jobs)
                  ? rawPayload.jobs.map((job) => normalizeSourceJob(job, action))
                  : [],
              };
              if (payload.success !== false && Array.isArray(payload.jobs)) {
                writeCachedSource(cacheKey, payload);
              }
              return payload;
            })
            .catch((err) => {
              const stale = readCachedSource(cacheKey, STALE_SOURCE_CACHE_TTL);
              if (stale) {
                console.warn(`[useJoobleJobs] ${action} live request failed, using cached jobs`, err?.message || err);
                return stale;
              }
              return { success: false, jobs: [], error: err?.message || String(err) };
            })
            .finally(() => {
              inflightSourceRequests.delete(cacheKey);
            });

          inflightSourceRequests.set(cacheKey, request);
          return request;
        };

        // Provider fallbacks run independently instead of extending a serial chain.
        const sourceWithFallback = async (action: ExternalSource, kw: string) => {
          const result = await callSource(action, kw);
          if (action !== 'jooble' && !result.jobs.length && location.trim()) {
            const fallback = await callSource(action, kw, '');
            if (fallback.jobs.length) return fallback;
          }
          return result;
        };
        const fetchAllSources = (kw: string) => Promise.all([
          callSource('jooble', kw), sourceWithFallback('adzuna', kw), sourceWithFallback('careerjet', kw),
        ]);
        let [joobleRes, adzunaRes, careerjetRes] = await fetchAllSources(keywords);
        if (currentRequest !== requestSeq.current) return;

        // Verbatim long suggestion titles (underscores, numeric IDs) often
        // match nothing on every provider — retry once with the meaningful
        // words so the user still gets results.
        const simplified = simplifySearchQuery(keywords);
        const allEmpty = [joobleRes, adzunaRes, careerjetRes].every(
          (r) => !(r.success !== false && r.jobs.length)
        );
        if (!append && keywords.trim() && allEmpty && simplified !== normalizeJobSearch(keywords)) {
          console.log(`[useJoobleJobs] no results for "${keywords}", retrying simplified: "${simplified}"`);
          [joobleRes, adzunaRes, careerjetRes] = await fetchAllSources(simplified);
          if (currentRequest !== requestSeq.current) return;
        }
        const joobleJobs = joobleRes.success !== false ? joobleRes.jobs : [];
        const adzunaJobs = adzunaRes.success !== false ? adzunaRes.jobs : [];
        const careerjetJobs = careerjetRes.success !== false ? careerjetRes.jobs : [];

        if (joobleRes.success === false) console.warn('[useJoobleJobs] Jooble returned no jobs', joobleRes.error);
        if (adzunaRes.success === false) console.warn('[useJoobleJobs] Adzuna returned no jobs', adzunaRes.error);
        if (careerjetRes.success === false) console.warn('[useJoobleJobs] Careerjet returned no jobs', careerjetRes.error);

        // If ALL sources came back empty, surface the error; otherwise fill from whatever we have.
        if (joobleRes.success === false && adzunaRes.success === false && careerjetRes.success === false) {
          throw new Error(joobleRes.error || adzunaRes.error || careerjetRes.error || 'External jobs unavailable');
        }

        // Round-robin merge across all three sources so every page mixes them.
        // Rotate lead source per page so scrolling varies ordering.
        const sourcesArr = [joobleJobs, adzunaJobs, careerjetJobs];
        const offset = (page - 1) % sourcesArr.length;
        const ordered = [
          sourcesArr[offset % sourcesArr.length],
          sourcesArr[(offset + 1) % sourcesArr.length],
          sourcesArr[(offset + 2) % sourcesArr.length],
        ];
        const merged: any[] = [];
        const maxLen = Math.max(...ordered.map((a) => a.length));
        for (let i = 0; i < maxLen; i++) {
          for (const arr of ordered) {
            if (arr[i]) merged.push(arr[i]);
          }
        }


        const MAX_AGE_MS = 21 * 24 * 60 * 60 * 1000; // 21 days — hide stale postings
        const isValidUrl = (u: any): boolean => {
          if (typeof u !== 'string' || u.length < 8) return false;
          try {
            const p = new URL(u);
            return p.protocol === 'http:' || p.protocol === 'https:';
          } catch {
            return false;
          }
        };
        const isExpired = (j: any): boolean => {
          if (j?.expired === true || j?.is_expired === true) return true;
          if (typeof j?.status === 'string' && /expired|closed|inactive|invalid|removed|no longer|filled/i.test(j.status)) return true;
          if (j?.expiration_date || j?.expires_at) {
            const t = Date.parse(j.expiration_date || j.expires_at);
            if (!isNaN(t) && t < Date.now()) return true;
          }
          if (j?.updated) {
            const u = Date.parse(j.updated);
            if (!isNaN(u) && Date.now() - u > MAX_AGE_MS) return true;
          }
          return false;
        };

        const norm = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
        const sourceBucket = (j: JoobleJob): 'adzuna' | 'jooble' | 'careerjet' => {
          const src = String(j.source || '').toLowerCase();
          const id = String(j.external_id || '');
          if (id.startsWith('adzuna_') || src.includes('adzuna')) return 'adzuna';
          if (id.startsWith('careerjet_') || src.includes('careerjet')) return 'careerjet';
          return 'jooble';
        };
        const nextSeenIds = append ? new Set(seenIds.current) : new Set<string>();
        const nextSeenKeys = append ? new Set(seenKeys.current) : new Set<string>();

        const incoming: JoobleJob[] = merged.filter((j: JoobleJob) => {
          if (!j || !isValidUrl(j.link)) return false;
          if (!j.title || j.title.length < 3) return false;
          const bucket = sourceBucket(j);
          // Careerjet returns short snippets for many partner sites — keep them
          // all (A→Z) as long as title + link are valid. Adzuna/Jooble still
          // need some description to weed out placeholder listings.
          if (bucket !== 'careerjet') {
            const desc = String(j.description || j.snippet || '').replace(/<[^>]*>/g, ' ').trim();
            if (desc.length < 30) return false;
          }
          if (isExpired(j)) return false;
          if (nextSeenIds.has(j.external_id)) return false;
          const key = `${bucket}|${norm(j.title)}|${norm(j.company)}|${norm(j.location)}`;
          if (nextSeenKeys.has(key)) return false;
          nextSeenIds.add(j.external_id);
          nextSeenKeys.add(key);
          return true;
        });

        seenIds.current = nextSeenIds;
        seenKeys.current = nextSeenKeys;
        // Debug: source-level counts so we can tell if any source is being filtered out
        const keptJooble = incoming.filter((j) => sourceBucket(j) === 'jooble').length;
        const keptAdzuna = incoming.filter((j) => sourceBucket(j) === 'adzuna').length;
        const keptCareerjet = incoming.filter((j) => sourceBucket(j) === 'careerjet').length;
        console.log(
          `[useJoobleJobs] page ${page}: jooble raw=${joobleJobs.length} kept=${keptJooble} | adzuna raw=${adzunaJobs.length} kept=${keptAdzuna} | careerjet raw=${careerjetJobs.length} kept=${keptCareerjet}`
        );
        setJobs((prev) => (append ? [...prev, ...incoming] : incoming));
        // Never recycle duplicates: bounded empty-page probing avoids request loops.
        emptyStreakRef.current = incoming.length ? 0 : emptyStreakRef.current + 1;
        setHasMore(emptyStreakRef.current < 2);
      } catch (err: any) {
        if (currentRequest !== requestSeq.current) return;
        console.error('[useJoobleJobs] error', err);
        setError(err?.message || 'Failed to load external jobs');
        if (!append) setJobs([]);
        // Stop automatic retries on an unavailable provider.
        setHasMore(false);
      } finally {
        if (currentRequest === requestSeq.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [keywords, location, limit, sort]
  );

  useEffect(() => {
    if (!enabled) return;
    pageRef.current = 1;
    seenIds.current = new Set();
    seenKeys.current = new Set();
    emptyStreakRef.current = 0;
    fetchPage(1, false);
    return () => {
      requestSeq.current += 1;
      loadingRef.current = false;
    };
  }, [enabled, keywords, location, sort, fetchPage]);

  // Re-fetch external jobs when auth state changes (login/logout) so that
  // Adzuna + Jooble both appear regardless of the user's session.
  useEffect(() => {
    if (!enabled) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        // Purge in-memory cache so the next fetch hits the edge function fresh.
        memorySourceCache.clear();
        try {
          Object.keys(sessionStorage)
            .filter((k) => k.startsWith('external_jobs_'))
            .forEach((k) => sessionStorage.removeItem(k));
        } catch {}
        pageRef.current = 1;
        seenIds.current = new Set();
        seenKeys.current = new Set();
        fetchPage(1, false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [enabled, fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || loading || !hasMore) return;
    pageRef.current += 1;
    fetchPage(pageRef.current, true);
  }, [loading, hasMore, fetchPage]);

  return { jobs, loading, hasMore, error, loadMore };
};
