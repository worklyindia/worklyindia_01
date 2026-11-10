import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useJobInteractions = () => {
  const { user } = useAuth();
  
  const trackPreferences = useCallback(async (
    category?: string,
    location?: string,
    salaryRange?: string,
    jobType?: string
  ) => {
    if (!user?.id) return;
    
    try {
      await supabase.rpc('update_user_preferences', {
        p_user_id: user.id,
        p_category: category || null,
        p_location: location || null,
        p_salary_range: salaryRange || null,
        p_job_type: jobType || null
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  }, [user?.id]);
  
  const trackJobView = useCallback(async (
    jobId: string,
    jobDetails?: {
      category?: string;
      location?: string;
      salaryRange?: string;
      jobType?: string;
    }
  ) => {
    try {
      // Insert view record (every click counts)
      const { error: insertError } = await supabase
        .from('job_interactions')
        .insert({
          job_id: jobId,
          user_id: user?.id || null,
          interaction_type: 'view',
          metadata: { 
            timestamp: new Date().toISOString(),
            anonymous: !user?.id 
          }
        });

      if (insertError) {
        console.error('Error inserting job interaction:', insertError);
        return;
      }

      // Count all views and update job
      const { count } = await supabase
        .from('job_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('interaction_type', 'view');

      if (count !== null) {
        await supabase
          .from('jobs')
          .update({ 
            views_count: count,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
      }

      // Track user preferences
      if (jobDetails && user?.id) {
        await trackPreferences(
          jobDetails.category,
          jobDetails.location,
          jobDetails.salaryRange,
          jobDetails.jobType
        );
      }
    } catch (error) {
      console.error('Error tracking job view:', error);
    }
  }, [user?.id, trackPreferences]);

  const trackJobApply = useCallback(async (jobId: string) => {
    try {
      // Check if user has already applied to avoid duplicate applications
      if (user?.id) {
        const { data: existingApplication } = await supabase
          .from('job_applications')
          .select('id')
          .eq('job_id', jobId)
          .eq('applicant_id', user.id)
          .maybeSingle();

        if (existingApplication) {
          console.log('User has already applied to this job');
          return;
        }
      }

      // Insert apply interaction
      await supabase
        .from('job_interactions')
        .insert({
          job_id: jobId,
          user_id: user?.id || null,
          interaction_type: 'apply',
          metadata: { 
            timestamp: new Date().toISOString(),
            anonymous: !user?.id 
          }
        });

      // Sync job metrics using database function to ensure consistency
      await supabase.rpc('sync_job_metrics', { p_job_id: jobId });
    } catch (error) {
      console.error('Error tracking job apply:', error);
    }
  }, [user?.id]);

  const trackJobCall = useCallback(async (jobId: string) => {
    try {
      await supabase
        .from('job_interactions')
        .insert({
          job_id: jobId,
          user_id: user?.id || null,
          interaction_type: 'call',
          metadata: { 
            timestamp: new Date().toISOString(),
            anonymous: !user?.id 
          }
        });

      // Sync job metrics using database function to ensure consistency
      await supabase.rpc('sync_job_metrics', { p_job_id: jobId });
    } catch (error) {
      console.error('Error tracking job call:', error);
    }
  }, [user?.id]);

  const trackJobShare = useCallback(async (jobId: string) => {
    try {
      await supabase
        .from('job_interactions')
        .insert({
          job_id: jobId,
          user_id: user?.id || null,
          interaction_type: 'share',
          metadata: { 
            timestamp: new Date().toISOString(),
            anonymous: !user?.id 
          }
        });

      // Sync job metrics using database function to ensure consistency
      await supabase.rpc('sync_job_metrics', { p_job_id: jobId });
    } catch (error) {
      console.error('Error tracking job share:', error);
    }
  }, [user?.id]);

  return {
    trackJobView,
    trackJobApply,
    trackJobCall,
    trackJobShare
  };
};