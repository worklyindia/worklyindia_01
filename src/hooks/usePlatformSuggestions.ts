import { useState, useCallback, useRef, useEffect } from 'react';
import { mergeSearchSuggestions } from '@/lib/jobSearchMatching';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformSuggestion {
  suggestion: string;
  platform: 'Jooble' | 'Adzuna' | 'Careerjet';
}

const SOURCES: Array<{ action: 'jooble' | 'adzuna' | 'careerjet'; label: PlatformSuggestion['platform'] }> = [
  { action: 'jooble', label: 'Jooble' },
  { action: 'adzuna', label: 'Adzuna' },
  { action: 'careerjet', label: 'Careerjet' },
];

// Providers stream independently: the fastest result never waits for the slowest.
export const usePlatformSuggestions = () => {
  const [platformSuggestions, setPlatformSuggestions] = useState<PlatformSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, PlatformSuggestion[]>());

  const clearPlatformSuggestions = useCallback(() => {
    requestIdRef.current++;
    controllerRef.current?.abort();
    setPlatformSuggestions([]);
    setLoading(false);
  }, []);

  useEffect(() => () => { requestIdRef.current++; controllerRef.current?.abort(); }, []);

  const getPlatformSuggestions = useCallback(async (query: string) => {
    const key = query.trim().toLowerCase();
    const requestId = ++requestIdRef.current;
    controllerRef.current?.abort();
    const cached = cacheRef.current.get(key);
    // Reuse cached longer titles immediately when typing a prefix/backspacing.
    const instant = cached || mergeSearchSuggestions([...cacheRef.current.values()].flat(), query);
    setPlatformSuggestions(instant);
    if (key.length < 2) { setPlatformSuggestions([]); setLoading(false); return; }
    if (cached) { setLoading(false); return; }
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    let merged = instant;
    let succeeded = false;
    await Promise.all(SOURCES.map(async ({ action, label }) => {
      try {
        const { data, error } = await supabase.functions.invoke('get-job-feed', {
          body: { action, keywords: query.trim(), location: '', page: 1, limit: 3, sort: 'relevance' },
          signal: controller.signal,
        });
        if (requestId !== requestIdRef.current || error || !data || data.success === false) return;
        succeeded = true;
        const items: PlatformSuggestion[] = (Array.isArray(data.jobs) ? data.jobs : [])
          .map((job: { title?: string }) => ({ suggestion: String(job.title || '').trim(), platform: label }));
        merged = mergeSearchSuggestions([...merged, ...items], query);
        setPlatformSuggestions(merged);
      } catch { /* A failed provider must not hide faster results. */ }
    }));
    if (requestId !== requestIdRef.current) return;
    if (succeeded) cacheRef.current.set(key, merged);
    setLoading(false);
  }, []);

  return { platformSuggestions, platformSuggestionsLoading: loading, getPlatformSuggestions, clearPlatformSuggestions };
};
