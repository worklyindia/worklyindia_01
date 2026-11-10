import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock, TrendingUp, Calendar, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface QuotaStatus {
  date: string;
  total_pending: number;
  today_used: number | null;
  effective_daily_limit: number;
  total_daily_limit: number;
  remaining_today: number | null;
  pending_today: number | null;
  pending_tomorrow: number | null;
  estimated_days_to_clear: number | null;
  next_processing_date: string | null;
  last_queue_date: string | null;
  indexed_today: number | null;
  total_public: number | null;
}

export default function IndexingQuotaWidget() {
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQuotaStatus = async () => {
    try {
      // Fetch from the enhanced quota dashboard view
      const { data, error } = await supabase
        .from('indexing_quota_dashboard')
        .select('*')
        .single();

      if (error) {
        console.error('Error fetching quota dashboard:', error);
        // Fallback to manual query
        const today = new Date().toISOString().split('T')[0];
        
        const [pendingResult, quotaResult] = await Promise.all([
          supabase
            .from('google_indexing_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')
            .lt('retry_count', 5),
          supabase
            .from('indexing_daily_quota')
            .select('quota_used, quota_limit')
            .eq('date', today)
            .single()
        ]);

        const pending = pendingResult.count || 0;
        const quotaData = quotaResult.data;
        const used = quotaData?.quota_used ?? 0;

        setQuota({
          date: today,
          total_pending: pending,
          today_used: used,
          effective_daily_limit: 180,
          total_daily_limit: 200,
          remaining_today: 180 - used,
          pending_today: 0,
          pending_tomorrow: 0,
          estimated_days_to_clear: Math.ceil(pending / 180),
          next_processing_date: null,
          last_queue_date: null,
          indexed_today: 0,
          total_public: 0
        });
      } else {
        setQuota(data);
      }
    } catch (error) {
      console.error('Error fetching quota:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchQuotaStatus();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchQuotaStatus();
    // Refresh every 5 minutes
    const interval = setInterval(fetchQuotaStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-8 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quota) return null;

  const usedPercent = quota.effective_daily_limit 
    ? Math.round(((quota.today_used || 0) / quota.effective_daily_limit) * 100) 
    : 0;
  const remainingToday = quota.remaining_today ?? (180 - (quota.today_used || 0));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Google Indexing Quota
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Daily Quota Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Today's Usage</span>
            <span className="font-medium">
              {quota.today_used || 0} / {quota.effective_daily_limit}
            </span>
          </div>
          <Progress value={usedPercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{remainingToday} slots remaining</span>
            <span>{usedPercent}% used</span>
          </div>
        </div>

        {/* Enhanced Queue Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="h-3 w-3" />
              Total Pending
            </div>
            <div className="text-2xl font-bold">{quota.total_pending}</div>
            {quota.pending_today && quota.pending_today > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {quota.pending_today} scheduled today
              </div>
            )}
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3 w-3" />
              Days to Clear
            </div>
            <div className="text-2xl font-bold">
              {quota.estimated_days_to_clear || 0}
            </div>
            {quota.indexed_today && quota.indexed_today > 0 && (
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                ✓ {quota.indexed_today} indexed today
              </div>
            )}
          </div>
        </div>

        {/* Tomorrow's Queue Info */}
        {quota.pending_tomorrow && quota.pending_tomorrow > 0 && (
          <div className="p-2 rounded bg-yellow-50 dark:bg-yellow-900/20 text-xs">
            <span className="text-yellow-700 dark:text-yellow-400">
              📅 {quota.pending_tomorrow} jobs scheduled for tomorrow
            </span>
          </div>
        )}

        {/* Queue Dates */}
        {quota.total_pending > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Next Processing
              </span>
              <Badge variant="outline">
                {quota.next_processing_date 
                  ? format(new Date(quota.next_processing_date), 'dd MMMM yyyy')
                  : 'Today'}
              </Badge>
            </div>
            
            {quota.last_queue_date && quota.last_queue_date !== quota.next_processing_date && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Queue Ends</span>
                <Badge variant="secondary">
                  {format(new Date(quota.last_queue_date), 'dd MMMM yyyy')}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Status Badge */}
        <div className="flex justify-center">
          {remainingToday > 0 ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Processing Active
            </Badge>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              Quota Exhausted - Resumes 1:30 PM IST
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
