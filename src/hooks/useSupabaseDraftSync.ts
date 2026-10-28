import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Generic hook that syncs a draft object with a Supabase table (user_id PK, data jsonb).
 * - Loads on mount / auth change (Supabase wins over localStorage if present)
 * - Persists to localStorage always (offline / anon fallback)
 * - Debounced upsert to Supabase whenever authenticated
 */
export function useSupabaseDraftSync<T extends object>(
  table: 'resume_drafts' | 'cover_letter_drafts',
  storageKey: string,
  empty: T,
) {
  const [draft, setDraft] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...empty, ...JSON.parse(raw) };
    } catch {}
    return empty;
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track auth + hydrate from Supabase
  useEffect(() => {
    let cancelled = false;

    const hydrate = async (uid: string | null) => {
      if (!uid) {
        hydratedRef.current = true;
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from(table)
          .select('data')
          .eq('user_id', uid)
          .maybeSingle();
        if (!cancelled && !error && data?.data) {
          setDraft({ ...empty, ...(data.data as T) });
        }
      } catch {}
      if (!cancelled) {
        hydratedRef.current = true;
        setLoading(false);
      }
    };

    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      hydrate(uid);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      hydratedRef.current = false;
      setLoading(true);
      hydrate(uid);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, storageKey]);

  // Persist locally + debounced sync to Supabase
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {}
    if (!hydratedRef.current || !userId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await supabase
          .from(table)
          .upsert({ user_id: userId, data: draft as any }, { onConflict: 'user_id' });
      } catch {}
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, userId, table, storageKey]);

  const reset = async () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setDraft(empty);
    if (userId) {
      try {
        await supabase.from(table).delete().eq('user_id', userId);
      } catch {}
    }
  };

  const update = <K extends keyof T>(key: K, value: T[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return { draft, setDraft, update, reset, loading };
}
