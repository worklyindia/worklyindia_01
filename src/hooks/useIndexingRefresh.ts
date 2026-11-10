import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface IndexingStatus {
  google_status: string | null;
  google_scheduled_at: string | null;
  google_submitted_at: string | null;
  google_public_at: string | null;
  google_last_checked_at: string | null;
  is_google_public: boolean;
  bing_status: string | null;
  bing_scheduled_at: string | null;
  bing_submitted_at: string | null;
  bing_public_at: string | null;
  bing_last_checked_at: string | null;
  is_bing_public: boolean;
}

interface RefreshResult {
  success: boolean;
  google?: {
    status: string;
    isPublic: boolean;
    checkedAt: string;
  };
  bing?: {
    status: string;
    isPublic: boolean;
    checkedAt: string;
  };
  message?: string;
}

export const useIndexingRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh indexing status for a single job
  const refreshJobIndexing = useCallback(async (jobId: string): Promise<RefreshResult> => {
    setIsRefreshing(true);
    
    try {
      // Call the check-indexing-status edge function with force=true for manual refresh
      const { data, error } = await supabase.functions.invoke('check-indexing-status', {
        body: { 
          mode: 'single', 
          job_id: jobId,
          force: true  // Skip 24h interval for manual refresh
        }
      });

      if (error) {
        console.error('[IndexingRefresh] Error:', error);
        toast.error('Failed to refresh indexing status');
        return { success: false, message: error.message };
      }

      if (data?.skipped) {
        toast.info(data.message || 'Status already checked recently');
        return { success: true, message: data.message };
      }

      // Show appropriate toast based on status
      const googlePublic = data?.google?.isIndexed || data?.google?.isPublic;
      const bingPublic = data?.bing?.isIndexed || data?.bing?.isPublic;
      
      if (googlePublic && bingPublic) {
        toast.success('🎉 URL is Public on both Google and Bing!');
      } else if (googlePublic) {
        toast.success('✅ Google: Public | Bing: Checking...');
      } else if (bingPublic) {
        toast.success('✅ Bing: Public | Google: Checking...');
      } else {
        toast.info('Still waiting for indexing. Will check again in 24 hours.');
      }

      return {
        success: true,
        google: data?.google,
        bing: data?.bing
      };

    } catch (err) {
      console.error('[IndexingRefresh] Error:', err);
      toast.error('Error checking indexing status');
      return { success: false, message: 'Unknown error' };
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Get current indexing status from database
  const getIndexingStatus = useCallback(async (jobId: string): Promise<IndexingStatus | null> => {
    try {
      const { data, error } = await supabase
        .from('job_indexing_status')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found is ok
          console.error('[IndexingRefresh] Fetch error:', error);
        }
        return null;
      }

      return data as IndexingStatus;
    } catch (err) {
      console.error('[IndexingRefresh] Error:', err);
      return null;
    }
  }, []);

  return {
    isRefreshing,
    refreshJobIndexing,
    getIndexingStatus
  };
};
