import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, CheckCircle2, Clock, Send, Loader2, ExternalLink, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import LottieSearchIcon from "@/components/LottieSearchIcon";

type IndexingStatus = 'queued' | 'scheduled' | 'submitted' | 'public';

interface IndexingStatusData {
  google_status: IndexingStatus;
  google_queued_at: string | null;
  google_scheduled_at: string | null;
  google_submitted_at: string | null;
  google_public_at: string | null;
  is_google_public: boolean;
  google_last_checked_at: string | null;
  bing_status: IndexingStatus;
  bing_queued_at: string | null;
  bing_scheduled_at: string | null;
  bing_submitted_at: string | null;
  bing_public_at: string | null;
  is_bing_public: boolean;
  bing_last_checked_at: string | null;
  overall_status: string;
}

interface JobIndexingStatusProps {
  jobId: string;
  compact?: boolean;
  showRefresh?: boolean;
  showVerify?: boolean;
}

const statusConfig: Record<IndexingStatus, { color: string; icon: React.ReactNode; label: string }> = {
  queued: { 
    color: 'bg-muted text-muted-foreground', 
    icon: <Clock className="h-3 w-3" />, 
    label: 'Queued' 
  },
  scheduled: { 
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', 
    icon: <Clock className="h-3 w-3" />, 
    label: 'Scheduled' 
  },
  submitted: { 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', 
    icon: <Send className="h-3 w-3" />, 
    label: 'Submitted' 
  },
  public: { 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', 
    icon: <CheckCircle2 className="h-3 w-3" />, 
    label: 'Public' 
  },
};

export function JobIndexingStatus({ jobId, compact = false, showRefresh = true, showVerify = true }: JobIndexingStatusProps) {
  const [status, setStatus] = useState<IndexingStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('job_indexing_status')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (!error && data) {
        setStatus(data as IndexingStatusData);
      }
    } catch (error) {
      console.error('Error fetching indexing status:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      await fetchStatus();
    } catch (error) {
      console.error('Error refreshing status:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Verify actual indexing status with Google/Bing APIs
  const verifyIndexingStatus = async () => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-indexing-status', {
        body: { mode: 'single', job_id: jobId }
      });

      if (error) throw error;

      if (data?.google?.isIndexed) {
        toast.success('Google: URL is now PUBLIC! 🎉');
      } else if (data?.google?.status === 'submitted') {
        toast.info('Google: Still processing (2-7 days typical)');
      }

      if (data?.bing?.isIndexed) {
        toast.success('Bing: URL is now PUBLIC! 🎉');
      } else if (data?.bing?.status === 'submitted') {
        toast.info('Bing: Still processing (24-48 hours typical)');
      }

      // Refresh status from database
      await fetchStatus();
    } catch (error) {
      console.error('Error verifying indexing status:', error);
      toast.error('Failed to verify indexing status');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`indexing-status-${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_indexing_status',
        filter: `job_id=eq.${jobId}`
      }, () => {
        fetchStatus();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-xs text-muted-foreground">No indexing data</div>
    );
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'dd MMMM yyyy h:mm a');
    } catch {
      return null;
    }
  };

  const googleConfig = statusConfig[status.google_status as IndexingStatus] || statusConfig.queued;
  const bingConfig = statusConfig[status.bing_status as IndexingStatus] || statusConfig.queued;

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={`${googleConfig.color} gap-1 text-xs`}>
                <span className="font-semibold">G</span>
                {googleConfig.icon}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <p className="font-semibold">Google: {googleConfig.label}</p>
                {status.google_submitted_at && (
                  <p>Submitted: {formatTime(status.google_submitted_at)}</p>
                )}
                {status.google_public_at && (
                  <p>Public: {formatTime(status.google_public_at)}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={`${bingConfig.color} gap-1 text-xs`}>
                <span className="font-semibold">B</span>
                {bingConfig.icon}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <p className="font-semibold">Bing: {bingConfig.label}</p>
                {status.bing_submitted_at && (
                  <p>Submitted: {formatTime(status.bing_submitted_at)}</p>
                )}
                {status.bing_public_at && (
                  <p>Public: {formatTime(status.bing_public_at)}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>

          {showRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={refreshStatus}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Indexing Status</h4>
        <div className="flex items-center gap-1">
          {showVerify && (status?.google_status === 'submitted' || status?.bing_status === 'submitted') && (
            <Button
              variant="outline"
              size="sm"
              onClick={verifyIndexingStatus}
              disabled={verifying}
              className="h-7 text-xs"
            >
              <LottieSearchIcon size={18} />
              {verifying ? 'Checking...' : 'Verify Now'}
            </Button>
          )}
          {showRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshStatus}
              disabled={refreshing}
              className="h-7"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Google Status */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <img loading="lazy" decoding="async" 
            src="https://www.google.com/favicon.ico" 
            alt="Google" 
            className="h-4 w-4"
          />
          <span className="text-xs font-medium">Google</span>
          <Badge variant="outline" className={`${googleConfig.color} ml-auto`}>
            {googleConfig.icon}
            <span className="ml-1">{googleConfig.label}</span>
          </Badge>
        </div>
        <div className="pl-6 space-y-0.5 text-xs text-muted-foreground">
          {status.google_queued_at && (
            <div className="flex items-center gap-2">
              <span className="w-16">Queued:</span>
              <span>{formatTime(status.google_queued_at)}</span>
            </div>
          )}
          {status.google_scheduled_at && (
            <div className="flex items-center gap-2">
              <span className="w-16">Scheduled:</span>
              <span>{formatTime(status.google_scheduled_at)}</span>
            </div>
          )}
          {status.google_submitted_at && (
            <div className="flex items-center gap-2">
              <span className="w-16">Submitted:</span>
              <span>{formatTime(status.google_submitted_at)}</span>
            </div>
          )}
          {status.google_public_at && (
            <div className="flex items-center gap-2 text-green-600">
              <span className="w-16">Public:</span>
              <span>{formatTime(status.google_public_at)}</span>
              <ExternalLink className="h-3 w-3" />
            </div>
          )}
        </div>
      </div>

      {/* Bing Status */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <img loading="lazy" decoding="async" 
            src="https://www.bing.com/favicon.ico" 
            alt="Bing" 
            className="h-4 w-4"
          />
          <span className="text-xs font-medium">Bing</span>
          <Badge variant="outline" className={`${bingConfig.color} ml-auto`}>
            {bingConfig.icon}
            <span className="ml-1">{bingConfig.label}</span>
          </Badge>
        </div>
        <div className="pl-6 space-y-0.5 text-xs text-muted-foreground">
          {status.bing_queued_at && (
            <div className="flex items-center gap-2">
              <span className="w-16">Queued:</span>
              <span>{formatTime(status.bing_queued_at)}</span>
            </div>
          )}
          {status.bing_scheduled_at && (
            <div className="flex items-center gap-2">
              <span className="w-16">Scheduled:</span>
              <span>{formatTime(status.bing_scheduled_at)}</span>
            </div>
          )}
          {status.bing_submitted_at && (
            <div className="flex items-center gap-2">
              <span className="w-16">Submitted:</span>
              <span>{formatTime(status.bing_submitted_at)}</span>
            </div>
          )}
          {status.bing_public_at && (
            <div className="flex items-center gap-2 text-green-600">
              <span className="w-16">Public:</span>
              <span>{formatTime(status.bing_public_at)}</span>
              <ExternalLink className="h-3 w-3" />
            </div>
          )}
        </div>
      </div>

      {/* Last Checked */}
      {(status.google_last_checked_at || status.bing_last_checked_at) && (
        <div className="text-xs text-muted-foreground border-t pt-2">
          Last checked: {formatTime(status.google_last_checked_at || status.bing_last_checked_at)}
        </div>
      )}
    </div>
  );
}

export default JobIndexingStatus;
