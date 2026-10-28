import { Helmet } from 'react-helmet-async';
import GoogleIndexingAdmin from '@/components/admin/GoogleIndexingAdmin';
import IndexingStatusDashboard from '@/components/admin/IndexingStatusDashboard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';
import { Loader2, Send, BarChart3, Settings, Play, RefreshCw, CheckCircle } from 'lucide-react';
import { CANONICAL_URL } from '@/config/domainConfig';

const EMPLOYER_URLS = [
  `${CANONICAL_URL}/employer/referral`,
  `${CANONICAL_URL}/employer/monthly-competition`,
  `${CANONICAL_URL}/post-job`,
  `${CANONICAL_URL}/employer/interviews`,
  `${CANONICAL_URL}/ai-assistant?tab=ai-chat`,
  `${CANONICAL_URL}/employer-portal?tab=verification`,
  `${CANONICAL_URL}/hire-portal-points`,
];

export default function GoogleIndexing() {
  const [submitting, setSubmitting] = useState(false);
  const [processingSingle, setProcessingSingle] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const submitEmployerPages = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'indexing', urls: EMPLOYER_URLS, action: 'URL_UPDATED', priority: 10 }
      });

      if (error) throw error;

      toast.success(`${data?.submitted || 0} employer pages submitted for indexing!`);
      console.log('Indexing result:', data);
      setLastResult(data);
    } catch (error) {
      console.error('Indexing error:', error);
      toast.error('Failed to submit pages for indexing');
    } finally {
      setSubmitting(false);
    }
  };

  const processSingleJob = async () => {
    setProcessingSingle(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-single-job');

      if (error) throw error;

      if (data?.processed && data?.success) {
        toast.success(`✅ Indexed: ${data.url?.split('/').pop()}`);
      } else if (data?.reason === 'queue_empty') {
        toast.info('Queue is empty - no pending jobs');
      } else if (data?.reason === 'quota_exhausted') {
        toast.warning('Daily quota exhausted. Resumes at 1:30 PM IST');
      } else {
        toast.info(data?.reason || 'No job processed');
      }
      
      setLastResult(data);
      console.log('Single job result:', data);
    } catch (error) {
      console.error('Process single job error:', error);
      toast.error('Failed to process single job');
    } finally {
      setProcessingSingle(false);
    }
  };

  const runVerification = async () => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-indexing-status', {
        body: { limit: 10 }
      });

      if (error) throw error;

      toast.success(`Verified ${data?.checked || 0} URLs, ${data?.google_public || 0} now public`);
      setLastResult(data);
      console.log('Verification result:', data);
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to run verification');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Google Indexing Admin | Owner Portal</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="container max-w-6xl mx-auto py-6 px-4">
        <h1 className="text-2xl font-bold mb-6">Search Engine Indexing Management</h1>
        
        <Tabs defaultValue="status" className="space-y-4">
          <TabsList>
            <TabsTrigger value="status" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Status Dashboard
            </TabsTrigger>
            <TabsTrigger value="submit" className="gap-2">
              <Send className="h-4 w-4" />
              Submit URLs
            </TabsTrigger>
            <TabsTrigger value="process" className="gap-2">
              <Play className="h-4 w-4" />
              Process Queue
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <IndexingStatusDashboard />
          </TabsContent>

          <TabsContent value="submit" className="space-y-6">
            {/* Quick Submit Employer Pages */}
            <div className="p-4 border rounded-lg bg-card">
              <h2 className="font-semibold mb-2">Quick Submit: 7 Employer Pages</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Submit all employer pages for immediate Google indexing
              </p>
              <Button onClick={submitEmployerPages} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Submit Employer Pages ({EMPLOYER_URLS.length} URLs)
              </Button>
            </div>

            <GoogleIndexingAdmin />
          </TabsContent>

          <TabsContent value="process" className="space-y-6">
            {/* 1-by-1 Processing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Manual Queue Processing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Process queue one job at a time. Each click submits 1 pending URL to Google.
                  Daily limit: 200 URLs. Queue processes in FIFO order.
                </p>
                
                <div className="flex gap-3 flex-wrap">
                  <Button 
                    onClick={processSingleJob} 
                    disabled={processingSingle}
                    className="gap-2"
                  >
                    {processingSingle ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Process 1 Job
                  </Button>
                  
                  <Button 
                    onClick={runVerification} 
                    disabled={verifying}
                    variant="outline"
                    className="gap-2"
                  >
                    {verifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Run 24h Verification
                  </Button>
                </div>

                {lastResult && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <h4 className="text-sm font-medium mb-2">Last Result:</h4>
                    <pre className="text-xs overflow-auto max-h-40">
                      {JSON.stringify(lastResult, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Processing Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-2">
                  <span className="font-bold text-foreground">1.</span>
                  <span>Jobs are added to queue when posted/edited (FIFO order)</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-foreground">2.</span>
                  <span>Queue shows estimated processing date based on position</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-foreground">3.</span>
                  <span>200 URLs processed daily (1:30 PM IST quota reset)</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-foreground">4.</span>
                  <span>24-hour verification checks if URL is public on Google</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-foreground">5.</span>
                  <span>Re-indexing only triggers on job content edit (hash comparison)</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="p-4 border rounded-lg bg-card">
              <h2 className="font-semibold mb-4">Indexing Configuration</h2>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <h3 className="font-medium mb-2">Google Indexing API</h3>
                    <div className="space-y-1 text-muted-foreground">
                      <p>Daily Quota: <span className="text-foreground font-medium">200 URLs</span></p>
                      <p>Effective Limit: <span className="text-foreground font-medium">180 URLs</span> (20 buffer)</p>
                      <p>Quota Reset: <span className="text-foreground font-medium">1:30 PM IST</span></p>
                      <p>Service Account: <span className="text-green-600">Configured ✓</span></p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <h3 className="font-medium mb-2">IndexNow (Bing/Yandex)</h3>
                    <div className="space-y-1 text-muted-foreground">
                      <p>Daily Limit: <span className="text-foreground font-medium">Unlimited</span></p>
                      <p>Key: <code className="text-xs bg-muted px-1 rounded">ed2e1bf9c3074d8b992f21a2f6e2c80e</code></p>
                      <p>Status: <span className="text-green-600">Active ✓</span></p>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <h3 className="font-medium mb-2 text-blue-800 dark:text-blue-300">Processing Schedule</h3>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• <strong>1:30 PM IST:</strong> Daily quota reset + batch processing starts</li>
                    <li>• <strong>Every 5 min:</strong> Process 1 job (1:30 PM - 11:30 PM IST)</li>
                    <li>• <strong>Every 6 hours:</strong> 24h verification check</li>
                    <li>• <strong>On Job Post:</strong> Immediate IndexNow + Google queue</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}