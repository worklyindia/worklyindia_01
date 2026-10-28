import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface JobAlertPreference {
  id: string;
  user_id?: string;
  email: string;
  phone?: string;
  job_categories: string[];
  locations: string[];
  experience_levels: string[];
  salary_ranges: string[];
  email_alerts: boolean;
  sms_alerts: boolean;
  push_notifications: boolean;
  instant_alerts: boolean;
  daily_digest: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useJobAlerts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createJobAlert = useMutation({
    mutationFn: async (data: Omit<JobAlertPreference, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: result, error } = await supabase
        .from('job_alert_preferences' as any)
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-alerts'] });
    },
  });

  const updateJobAlert = useMutation({
    mutationFn: async ({ id, ...data }: Partial<JobAlertPreference> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('job_alert_preferences' as any)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-alerts'] });
    },
  });

  const getUserJobAlerts = useQuery({
    queryKey: ['job-alerts', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('job_alert_preferences' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.id,
  });

  const deleteJobAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('job_alert_preferences' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-alerts'] });
    },
  });

  return {
    createJobAlert,
    updateJobAlert,
    getUserJobAlerts,
    deleteJobAlert,
  };
};
