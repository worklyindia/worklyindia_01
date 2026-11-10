import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Send, CheckCircle2, XCircle, Clock, TrendingUp, Globe, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface QueueItem {
  id: string;
  url: string;
  action: string;
  status: string;
  created_at: string;
  processed_at: string | null;
  error_message: string | null;
  retry_count: number;
}

export const GoogleIndexingDashboard = () => {
  const queryClient = useQueryClient();
  const [isIndexingAll, setIsIndexingAll] = useState(false);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, failed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);

  // Fetch queue data
  const fetchQueueData = async () => {
    try {
      setIsLoading(true);
      
      // Try to fetch from the queue table
      const { data, error } = await supabase
        .from('function_logs')
        .select('*')
        .eq('function_name', 'google-indexing-api')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching logs:', error);
      }

      // Calculate stats from function logs as fallback
      const logs = data || [];
      const successLogs = logs.filter(l => l.status === 'success').length;
      const partialLogs = logs.filter(l => l.status === 'partial').length;
      const errorLogs = logs.filter(l => l.status === 'error').length;

      setStats({
        total: logs.length,
        pending: 0,
        completed: successLogs,
        failed: errorLogs + partialLogs
      });

      // Transform logs to queue items format
      const items: QueueItem[] = logs.map(log => ({
        id: log.id,
        url: (log.request_data as { type?: string })?.type || 'batch',
        action: 'URL_UPDATED',
        status: log.status,
        created_at: log.created_at,
        processed_at: log.created_at,
        error_message: log.error_message,
        retry_count: 0
      }));

      setQueueItems(items);
      setTableExists(true);
    } catch (err) {
      console.error('Error:', err);
      setTableExists(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
    const interval = setInterval(fetchQueueData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch active jobs count
  const { data: activeJobsCount } = useQuery({
    queryKey: ['active-jobs-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      
      if (error) throw error;
      return count || 0;
    }
  });

  // Index all jobs mutation
  const indexAllMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'indexing', type: 'all', action: 'URL_UPDATED' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Indexed ${data?.submitted || 0} URLs successfully`);
      fetchQueueData();
    },
    onError: (error) => {
      toast.error(`Indexing failed: ${error.message}`);
    }
  });

  // Index new jobs mutation
  const indexNewMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'indexing', type: 'new-jobs', action: 'URL_UPDATED' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Indexed ${data?.submitted || 0} new jobs`);
      fetchQueueData();
    },
    onError: (error) => {
      toast.error(`Indexing failed: ${error.message}`);
    }
  });

  // Ping sitemap mutation
  const pingSitemapMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sitemap-ping');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sitemap pinged! Google: ${data?.google}, Bing: ${data?.bing}`);
    },
    onError: (error) => {
      toast.error(`Sitemap ping failed: ${error.message}`);
    }
  });

  const handleIndexAll = async () => {
    setIsIndexingAll(true);
    try {
      await indexAllMutation.mutateAsync();
    } finally {
      setIsIndexingAll(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>;
      case 'error':
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-yellow-500"><AlertCircle className="w-3 h-3 mr-1" />Partial</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Google Indexing Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Monitor and manage automatic Google indexing for jobs
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => pingSitemapMutation.mutate()}
            disabled={pingSitemapMutation.isPending}
          >
            {pingSitemapMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
            Ping Sitemap
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => indexNewMutation.mutate()}
            disabled={indexNewMutation.isPending}
          >
            {indexNewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Index New Jobs
          </Button>
          <Button
            size="sm"
            onClick={handleIndexAll}
            disabled={isIndexingAll}
          >
            {isIndexingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Index All Jobs
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Auto-Indexing Active</AlertTitle>
        <AlertDescription>
          New jobs are automatically submitted to Google Indexing API when created or updated. 
          Use manual buttons for bulk operations.
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Jobs</CardDescription>
            <CardTitle className="text-2xl">{activeJobsCount ?? '-'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Ready to index</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Requests</CardDescription>
            <CardTitle className="text-2xl">{isLoading ? '-' : stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Recent activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Successful</CardDescription>
            <CardTitle className="text-2xl text-green-600">{isLoading ? '-' : stats.completed}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Successfully indexed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed/Partial</CardDescription>
            <CardTitle className="text-2xl text-red-600">{isLoading ? '-' : stats.failed}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Indexing Activity
          </CardTitle>
          <CardDescription>Last 20 indexing requests from function logs</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : queueItems.length > 0 ? (
            <div className="space-y-3">
              {queueItems.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-muted/50 rounded-lg gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Batch: {item.url}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), 'MMMM d, yyyy HH:mm')}
                    </p>
                    {item.error_message && (
                      <p className="text-xs text-red-500 mt-1 truncate">{item.error_message}</p>
                    )}
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No indexing activity yet. Run "Index All Jobs" to start.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleIndexingDashboard;
