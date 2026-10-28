import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWakeRefetch } from '@/hooks/useWakeRefetch';

interface Certification {
  id: string;
  user_id: string;
  certification_name: string;
  issuing_organization: string;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  credential_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const useCertifications = () => {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchCertifications = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('certifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        console.error('Error fetching certifications:', fetchError);
      } else {
        setCertifications(data || []);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching certifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertifications();
  }, [user?.id]);

  useWakeRefetch(fetchCertifications, !!user);


  return {
    certifications,
    loading,
    error,
    refetch: fetchCertifications
  };
};