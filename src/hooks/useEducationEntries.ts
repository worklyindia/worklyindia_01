import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWakeRefetch } from '@/hooks/useWakeRefetch';

interface EducationEntry {
  id: string;
  degree: string;
  institution: string | null;
  field_of_study: string | null;
  start_year: number | null;
  end_year: number | null;
  grade: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const useEducationEntries = () => {
  const { user } = useAuth();
  const [educationEntries, setEducationEntries] = useState<EducationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEducationEntries = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('education_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('start_year', { ascending: false });

      if (error) {
        throw error;
      }

      setEducationEntries(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch education entries');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEducationEntries();
  }, [fetchEducationEntries]);

  // Refetch when tab becomes visible again (fixes stuck skeleton on mobile screen off/on)
  useWakeRefetch(fetchEducationEntries, !!user);

  return { educationEntries, loading, error, refetch: fetchEducationEntries };
};
