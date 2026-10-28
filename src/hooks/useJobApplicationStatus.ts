import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface JobApplicationStatus {
  canUpdate: boolean;
  error?: string;
}

export const useJobApplicationStatus = () => {
  const { user } = useAuth();
  
  const updateApplicationStatus = async (applicationId: string, newStatus: string): Promise<JobApplicationStatus> => {
    if (!user) {
      return { canUpdate: false, error: 'User not authenticated' };
    }

    try {
      console.log(`Updating application ${applicationId} to status: ${newStatus}`);
      
      const { error } = await supabase
        .from('job_applications')
        .update({ 
          status: newStatus,
          reviewed_at: newStatus !== 'applied' ? new Date().toISOString() : null
        })
        .eq('id', applicationId);

      if (error) {
        console.error('Failed to update application status:', error);
        return { 
          canUpdate: false, 
          error: `Failed to update application status: ${error.message}` 
        };
      }

      supabase.functions
        .invoke('email-api', {
          body: {
            action: 'application_status_notification',
            application_id: applicationId,
            new_status: newStatus
          }
        })
        .catch((e) => console.error('Status notification dispatch failed:', e));

      console.log('Application status updated successfully');
      return { canUpdate: true };
    } catch (error) {
      console.error('Unexpected error updating application status:', error);
      return { 
        canUpdate: false, 
        error: 'An unexpected error occurred while updating the application status' 
      };
    }
  };

  return {
    updateApplicationStatus
  };
};