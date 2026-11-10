
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface EmployerMetrics {
  active_jobs_count: number;
  total_applications: number;
  monthly_spent_points: number;
  total_spent_points: number;
  successful_hires: number;
}

interface JobPayment {
  id: string;
  points_spent: number;
  payment_type: string;
  description: string;
  created_at: string;
  job_id: string | null;
}

export const useEmployerMetrics = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<EmployerMetrics | null>(null);
  const [jobPayments, setJobPayments] = useState<JobPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMetrics();
      fetchJobPayments();
    }
  }, [user]);

  const fetchMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('employer_metrics')
        .select('*')
        .eq('user_id', user?.id)
        .eq('current_month', new Date().getMonth() + 1)
        .eq('current_year', new Date().getFullYear())
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setMetrics(data || {
        active_jobs_count: 0,
        total_applications: 0,
        monthly_spent_points: 0,
        total_spent_points: 0,
        successful_hires: 0
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to load employer metrics');
    }
  };

  const fetchJobPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('job_payments')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobPayments(data || []);
    } catch (error) {
      console.error('Error fetching job payments:', error);
      toast.error('Failed to load job payments');
    } finally {
      setLoading(false);
    }
  };

  const getAvgCostPerHire = () => {
    if (!metrics || metrics.successful_hires === 0) return 0;
    return Math.round(metrics.total_spent_points / metrics.successful_hires);
  };

  return {
    metrics,
    jobPayments,
    loading,
    avgCostPerHire: getAvgCostPerHire(),
    refetch: () => {
      fetchMetrics();
      fetchJobPayments();
    }
  };
};
