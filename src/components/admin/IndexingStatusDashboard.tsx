import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, CheckCircle2, Clock, Send, AlertCircle, Calendar, Zap, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import IndexingQuotaWidget from './IndexingQuotaWidget';
import { CANONICAL_URL } from '@/config/domainConfig';

interface IndexingStats {
  total: number;
  queued: number;
  scheduled: number;
  submitted: number;
  public: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface QueueItem {
  id: string;
  url: string;
  job_id: string | null;
  status: string;
  queued_at: string | null;
  scheduled_at: string | null;
  submitted_at: string | null;
  public_at: string | null;
  is_public: boolean;
  error_message: string | null;
  queue_position: number | null;
  queue_date: string | null;
  estimated_process_date: string | null;
  verification_attempt_count: number | null;
}

export default function IndexingStatusDashboard() {
  const [googleStats, setGoogleStats] = useState<IndexingStats>({ 
    total: 0, queued: 0, scheduled: 0, submitted: 0, public: 0, 
    pending: 0, processing: 0, completed: 0, failed: 0 
  });
  const [bingStats, setBingStats] = useState<IndexingStats>({ 
    total: 0, queued: 0, scheduled: 0, submitted: 0, public: 0,
    pending: 0, processing: 0, completed: 0, failed: 0
  });
  const [googleQueue, setGoogleQueue] = useState<QueueItem[]>([]);
  const [bingQueue, setBingQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchStats = async () => {
    try {
      // Fetch Google stats with enhanced columns
      const { data: googleData } = await supabase
        .from('google_indexing_queue')
        .select('id, status, google_status, is_google_public');

      if (googleData) {
        const stats = googleData.reduce((acc, item) => {
          acc.total++;
          // Track by status
          const status = item.status?.toLowerCase() || 'pending';
          if (status === 'pending') acc.pending++;
          else if (status === 'processing') acc.processing++;
          else if (status === 'completed') acc.completed++;
          else if (status === 'failed') acc.failed++;
          
          // Track by google_status
          const gStatus = (item.google_status || 'queued') as keyof IndexingStats;
          if (gStatus in acc) acc[gStatus]++;
          
          if (item.is_google_public) acc.public++;
          
          return acc;
        }, { total: 0, queued: 0, scheduled: 0, submitted: 0, public: 0, pending: 0, processing: 0, completed: 0, failed: 0 });
        setGoogleStats(stats);
      }

      // Fetch Bing stats
      const { data: bingData } = await supabase
        .from('bing_indexing_queue')
        .select('id, bing_status, is_bing_public');

      if (bingData) {
        const stats = bingData.reduce((acc, item) => {
          acc.total++;
          const status = (item.bing_status || 'queued') as keyof IndexingStats;
          if (status in acc) acc[status]++;
          if (item.is_bing_public) acc.public++;
          return acc;
        }, { total: 0, queued: 0, scheduled: 0, submitted: 0, public: 0, pending: 0, processing: 0, completed: 0, failed: 0 });
        setBingStats(stats);
      }

      // Fetch recent queue items with enhanced columns
      const { data: googleQueueData } = await supabase
        .from('google_indexing_queue')
        .select('id, url, job_id, status, google_status, google_queued_at, google_scheduled_at, google_submitted_at, google_public_at, is_google_public, error_message, queue_position, queue_date, estimated_process_date')
        .order('queue_position', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (googleQueueData) {
        setGoogleQueue(googleQueueData.map(item => ({
          id: item.id,
          url: item.url,
          job_id: item.job_id,
          status: item.status || 'pending',
          queued_at: item.google_queued_at,
          scheduled_at: item.google_scheduled_at,
          submitted_at: item.google_submitted_at,
          public_at: item.google_public_at,
          is_public: item.is_google_public || false,
          error_message: item.error_message,
          queue_position: item.queue_position,
          queue_date: item.queue_date,
          estimated_process_date: item.estimated_process_date,
          verification_attempt_count: null
        })));
      }

      const { data: bingQueueData } = await supabase
        .from('bing_indexing_queue')
        .select('id, url, job_id, bing_status, bing_queued_at, bing_scheduled_at, bing_submitted_at, bing_public_at, is_bing_public, error_message')
        .order('created_at', { ascending: false })
        .limit(50);

      if (bingQueueData) {
        setBingQueue(bingQueueData.map(item => ({
          id: item.id,
          url: item.url,
          job_id: item.job_id,
          status: item.bing_status || 'queued',
          queued_at: item.bing_queued_at,
          scheduled_at: item.bing_scheduled_at,
          submitted_at: item.bing_submitted_at,
          public_at: item.bing_public_at,
          is_public: item.is_bing_public || false,
          error_message: item.error_message,
          queue_position: null,
          queue_date: null,
          estimated_process_date: null,
          verification_attempt_count: null
        })));
      }

    } catch (error) {
      console.error('Error fetching indexing stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncStatus = async () => {
    setSyncing(true);
    try {
      await fetchStats();
      toast.success('Status refreshed successfully');
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync indexing status');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yy HH:mm');
    } catch {
      return '-';
    }
  };

  const getStatusBadge = (item: QueueItem) => {
    if (item.is_public || item.status === 'public') {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Public</Badge>;
    }
    
    if (item.status === 'completed' && item.submitted_at) {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Send className="h-3 w-3 mr-1" />Submitted</Badge>;
    }
    
    if (item.status === 'processing') {
      return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"><Zap className="h-3 w-3 mr-1 animate-pulse" />Processing</Badge>;
    }
    
    if (item.status === 'failed') {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    }
    
    if (item.status === 'pending' && item.queue_date) {
      const queueDate = new Date(item.queue_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysDiff = Math.ceil((queueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 0) {
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"><Clock className="h-3 w-3 mr-1" />Today</Badge>;
      } else if (daysDiff === 1) {
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"><Calendar className="h-3 w-3 mr-1" />Tomorrow</Badge>;
      } else {
        return <Badge variant="secondary"><Calendar className="h-3 w-3 mr-1" />Day {daysDiff}</Badge>;
      }
    }
    
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Queued</Badge>;
  };

  const calculateProgress = (stats: IndexingStats) => {
    if (stats.total === 0) return 0;
    return Math.round((stats.public / stats.total) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Indexing Status Dashboard</h2>
        <Button onClick={syncStatus} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          Sync Status
        </Button>
      </div>

      {/* Quota Widget */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <IndexingQuotaWidget />
        
        {/* Google Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <img loading="lazy" decoding="async" src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
              Google Indexing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Progress value={calculateProgress(googleStats)} className="flex-1" />
              <span className="text-sm font-medium">{calculateProgress(googleStats)}%</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center text-xs">
              <div className="p-1.5 rounded bg-muted">
                <div className="font-bold">{googleStats.pending}</div>
                <div className="text-muted-foreground">Pending</div>
              </div>
              <div className="p-1.5 rounded bg-purple-100 dark:bg-purple-900/30">
                <div className="font-bold">{googleStats.processing}</div>
                <div className="text-purple-800 dark:text-purple-400">Processing</div>
              </div>
              <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/30">
                <div className="font-bold">{googleStats.completed}</div>
                <div className="text-blue-800 dark:text-blue-400">Submitted</div>
              </div>
              <div className="p-1.5 rounded bg-green-100 dark:bg-green-900/30">
                <div className="font-bold">{googleStats.public}</div>
                <div className="text-green-800 dark:text-green-400">Public</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bing Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <img loading="lazy" decoding="async" src="https://www.bing.com/favicon.ico" alt="Bing" className="h-5 w-5" />
              Bing Indexing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Progress value={calculateProgress(bingStats)} className="flex-1" />
              <span className="text-sm font-medium">{calculateProgress(bingStats)}%</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center text-xs">
              <div className="p-1.5 rounded bg-muted">
                <div className="font-bold">{bingStats.queued}</div>
                <div className="text-muted-foreground">Queued</div>
              </div>
              <div className="p-1.5 rounded bg-yellow-100 dark:bg-yellow-900/30">
                <div className="font-bold">{bingStats.scheduled}</div>
                <div className="text-yellow-800 dark:text-yellow-400">Scheduled</div>
              </div>
              <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/30">
                <div className="font-bold">{bingStats.submitted}</div>
                <div className="text-blue-800 dark:text-blue-400">Submitted</div>
              </div>
              <div className="p-1.5 rounded bg-green-100 dark:bg-green-900/30">
                <div className="font-bold">{bingStats.public}</div>
                <div className="text-green-800 dark:text-green-400">Public</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Tables */}
      <Tabs defaultValue="google" className="w-full">
        <TabsList>
          <TabsTrigger value="google">Google Queue ({googleQueue.length})</TabsTrigger>
          <TabsTrigger value="bing">Bing Queue ({bingQueue.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="google">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="w-[280px]">URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Queue Date</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Public</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {googleQueue.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.queue_position || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[280px]" title={item.url}>
                        {item.url.replace(CANONICAL_URL, '')}
                      </TableCell>
                      <TableCell>{getStatusBadge(item)}</TableCell>
                      <TableCell className="text-xs">
                        {item.queue_date ? format(new Date(item.queue_date), 'dd/MM') : '-'}
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(item.submitted_at)}</TableCell>
                      <TableCell className="text-xs">{formatDate(item.public_at)}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-[150px] truncate" title={item.error_message || ''}>
                        {item.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bing">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Queued</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Public</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bingQueue.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs truncate max-w-[300px]" title={item.url}>
                        {item.url.replace(CANONICAL_URL, '')}
                      </TableCell>
                      <TableCell>{getStatusBadge(item)}</TableCell>
                      <TableCell className="text-xs">{formatDate(item.queued_at)}</TableCell>
                      <TableCell className="text-xs">{formatDate(item.scheduled_at)}</TableCell>
                      <TableCell className="text-xs">{formatDate(item.submitted_at)}</TableCell>
                      <TableCell className="text-xs">{formatDate(item.public_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
