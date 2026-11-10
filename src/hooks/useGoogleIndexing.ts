import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface QuotaInfo {
  date: string;
  quota_used: number;
  quota_limit: number;
  indexnow_fallback_count: number;
}

export interface QueueItem {
  id: string;
  url: string;
  action: string;
  status: string;
  priority: number;
  page_type: string;
  retry_count: number;
  error_message: string | null;
  indexnow_submitted: boolean;
  created_at: string;
  processed_at: string | null;
  queue_position?: number | null;
  scheduled_for?: string | null;
}

export interface ErrorLog {
  id: string;
  url: string;
  error_code: number;
  error_message: string;
  error_type: string;
  is_permanent: boolean;
  fallback_used: string | null;
  created_at: string;
}

export interface IndexingStats {
  quota: QuotaInfo;
  queueStats: {
    pending: number;
    completed: number;
    failed: number;
    total: number;
  };
  recentErrors: ErrorLog[];
  recentQueue: QueueItem[];
}

export const useGoogleIndexing = () => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Fetch indexing statistics
  const fetchIndexingStats = async (): Promise<IndexingStats | null> => {
    setLoading(prev => ({ ...prev, stats: true }));
    
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch quota
      const { data: quotaData } = await supabase
        .from('indexing_daily_quota')
        .select('*')
        .eq('date', today)
        .single();

      // Fetch queue stats using count queries
      const { count: pendingCount } = await supabase
        .from('google_indexing_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: completedCount } = await supabase
        .from('google_indexing_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      const { count: failedCount } = await supabase
        .from('google_indexing_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');

      // Fetch recent queue items with FIFO ordering
      const { data: recentQueue } = await supabase
        .from('google_indexing_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch recent errors
      const { data: recentErrors } = await supabase
        .from('indexing_error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        quota: quotaData || { date: today, quota_used: 0, quota_limit: 200, indexnow_fallback_count: 0 },
        queueStats: {
          pending: pendingCount || 0,
          completed: completedCount || 0,
          failed: failedCount || 0,
          total: (pendingCount || 0) + (completedCount || 0) + (failedCount || 0)
        },
        recentErrors: (recentErrors || []) as ErrorLog[],
        recentQueue: (recentQueue || []) as QueueItem[]
      };
    } catch (err: any) {
      console.error('Error fetching indexing stats:', err);
      return null;
    } finally {
      setLoading(prev => ({ ...prev, stats: false }));
    }
  };

  // Submit URLs for indexing
  const submitUrls = async (urls: string[], useGoogleApi = true): Promise<boolean> => {
    setLoading(prev => ({ ...prev, submit: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'indexing', urls, action: 'URL_UPDATED', priority: 10 }
      });

      if (error) throw error;

      toast({
        title: "URLs Submitted",
        description: `Submitted: ${data.submitted || 0}, Queued: ${data.queued || 0}, IndexNow: ${data.indexnow_fallback || 0}`,
      });

      return true;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || 'Failed to submit URLs',
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  };

  // Submit static pages
  const submitStaticPages = async (): Promise<boolean> => {
    setLoading(prev => ({ ...prev, staticPages: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('seo-auto-submit', {
        body: { trigger: 'static-pages', useGoogleApi: true }
      });

      if (error) throw error;

      toast({
        title: "Static Pages Submitted",
        description: `Submitted ${data.submitted || 0} static pages to IndexNow`,
      });

      return true;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || 'Failed to submit static pages',
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(prev => ({ ...prev, staticPages: false }));
    }
  };

  // Process the queue
  const processQueue = async (): Promise<boolean> => {
    setLoading(prev => ({ ...prev, processQueue: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('process-indexing-queue', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Queue Processed",
        description: `Success: ${data.successCount || 0}, Failed: ${data.failedCount || 0}, IndexNow: ${data.indexNowCount || 0}`,
      });

      return true;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || 'Failed to process queue',
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(prev => ({ ...prev, processQueue: false }));
    }
  };

  // Retry failed URLs
  const retryFailedUrls = async (): Promise<boolean> => {
    setLoading(prev => ({ ...prev, retry: true }));
    
    try {
      // Reset failed items to pending
      const { error } = await supabase
        .from('google_indexing_queue')
        .update({ status: 'pending', retry_count: 0 })
        .eq('status', 'failed')
        .lt('retry_count', 5);

      if (error) throw error;

      toast({
        title: "Failed URLs Reset",
        description: "Failed URLs have been queued for retry",
      });

      return true;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || 'Failed to retry URLs',
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(prev => ({ ...prev, retry: false }));
    }
  };

  // Clear completed queue items
  const clearCompletedQueue = async (): Promise<boolean> => {
    setLoading(prev => ({ ...prev, clear: true }));
    
    try {
      const { error } = await supabase
        .from('google_indexing_queue')
        .delete()
        .eq('status', 'completed');

      if (error) throw error;

      toast({
        title: "Queue Cleared",
        description: "Completed items have been removed",
      });

      return true;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || 'Failed to clear queue',
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(prev => ({ ...prev, clear: false }));
    }
  };

  return {
    loading,
    fetchIndexingStats,
    submitUrls,
    submitStaticPages,
    processQueue,
    retryFailedUrls,
    clearCompletedQueue
  };
};
