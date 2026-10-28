import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWakeRefetch } from '@/hooks/useWakeRefetch';

interface ProfessionalExperience {
  id: string;
  position: string;
  company: string | null;
  experience_years: number | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const useProfessionalExperiences = () => {
  const { user } = useAuth();
  const [experiences, setExperiences] = useState<ProfessionalExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfessionalExperiences = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professional_experiences')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });

      if (error) {
        throw error;
      }

      setExperiences(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch professional experiences');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfessionalExperiences();
  }, [fetchProfessionalExperiences]);

  useWakeRefetch(fetchProfessionalExperiences, !!user);

  return { experiences, loading, error, refetch: fetchProfessionalExperiences };
};
