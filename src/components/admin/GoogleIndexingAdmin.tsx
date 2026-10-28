import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CANONICAL_URL } from '@/config/domainConfig';
import { 
  Globe, 
  Send, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface QuotaInfo {
  date: string;
  quota_used: number;
  quota_limit: number;
  indexnow_fallback_count?: number;
}

interface IndexingResult {
  success: boolean;
  submitted?: number;
  failed?: number;
  queued?: number;
  indexnow_fallback?: number;
  quota?: QuotaInfo;
  errors?: string[];
  message?: string;
}

const EMPLOYER_PAGES = [
  { url: '/employer/referral', label: 'Employer Referral' },
  { url: '/employer/monthly-competition', label: 'Monthly Competition' },
  { url: '/employer/interviews', label: 'Interviews' },
  { url: '/post-job', label: 'Post Job' },
  { url: '/employer-portal?tab=verification', label: 'Employer Verification' },
  { url: '/ai-assistant?tab=ai-chat', label: 'AI Assistant' },
];

const SITE_URL = CANONICAL_URL;

export default function GoogleIndexingAdmin() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [lastResult, setLastResult] = useState<IndexingResult | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);

  const submitToIndexing = async (urls: string[], type?: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-google-api', {
        body: type ? { service: 'indexing', type } : { service: 'indexing', urls, action: 'URL_UPDATED', priority: 10 }
      });

      if (error) throw error;

      setLastResult(data);
      setQuota(data.quota);

      toast({
        title: data.success ? 'Indexing Submitted' : 'Indexing Failed',
        description: `Submitted: ${data.submitted || 0}, Failed: ${data.failed || 0}, Queued: ${data.queued || 0}`,
        variant: data.success ? 'default' : 'destructive'
      });

      return data;
    } catch (error: any) {
      console.error('Indexing error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit for indexing',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitEmployerPages = () => {
    submitToIndexing([], 'employer-pages');
  };

  const handleSubmitStaticPages = () => {
    submitToIndexing([], 'static-pages');
  };

  const handleSubmitAllJobs = () => {
    submitToIndexing([], 'all');
  };

  const handleSubmitCustomUrl = () => {
    if (!customUrl.trim()) return;
    const fullUrl = customUrl.startsWith('http') ? customUrl : `${SITE_URL}${customUrl}`;
    submitToIndexing([fullUrl]);
    setCustomUrl('');
  };

  const handleSubmitSelected = () => {
    if (selectedUrls.length === 0) return;
    const fullUrls = selectedUrls.map(url => `${SITE_URL}${url}`);
    submitToIndexing(fullUrls);
    setSelectedUrls([]);
  };

  const toggleUrlSelection = (url: string) => {
    setSelectedUrls(prev => 
      prev.includes(url) 
        ? prev.filter(u => u !== url)
        : [...prev, url]
    );
  };

  const quotaPercentage = quota ? (quota.quota_used / quota.quota_limit) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Google Indexing API Admin
          </CardTitle>
          <CardDescription>
            Submit URLs to Google for faster indexing. Daily limit: 200 URLs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Quota Display */}
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Daily Quota Usage</span>
              <span className="text-sm">
                {quota ? `${quota.quota_used} / ${quota.quota_limit}` : 'Loading...'}
              </span>
            </div>
            <Progress value={quotaPercentage} className="h-2" />
            {quota?.indexnow_fallback_count && quota.indexnow_fallback_count > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                IndexNow fallback used: {quota.indexnow_fallback_count} URLs
              </p>
            )}
          </div>

          <Tabs defaultValue="quick">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="quick">Quick Submit</TabsTrigger>
              <TabsTrigger value="pages">Select Pages</TabsTrigger>
              <TabsTrigger value="custom">Custom URL</TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="space-y-4 mt-4">
              <div className="grid gap-3">
                <Button 
                  onClick={handleSubmitEmployerPages} 
                  disabled={isLoading}
                  className="w-full justify-start"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Submit Employer Pages (7 URLs)
                </Button>
                <Button 
                  onClick={handleSubmitStaticPages} 
                  disabled={isLoading}
                  variant="secondary"
                  className="w-full justify-start"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                  Submit All Static Pages (21 URLs)
                </Button>
                <Button 
                  onClick={handleSubmitAllJobs} 
                  disabled={isLoading}
                  variant="outline"
                  className="w-full justify-start"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                  Submit All Active Jobs (up to 200)
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="pages" className="space-y-4 mt-4">
              <div className="space-y-2">
                {EMPLOYER_PAGES.map((page) => (
                  <div 
                    key={page.url}
                    onClick={() => toggleUrlSelection(page.url)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedUrls.includes(page.url) 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{page.label}</span>
                      {selectedUrls.includes(page.url) && (
                        <CheckCircle className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{page.url}</p>
                  </div>
                ))}
              </div>
              {selectedUrls.length > 0 && (
                <Button onClick={handleSubmitSelected} disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Submit {selectedUrls.length} Selected URLs
                </Button>
              )}
            </TabsContent>

            <TabsContent value="custom" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Enter URL (e.g., /job/frontend-developer)" 
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitCustomUrl()}
                />
                <Button onClick={handleSubmitCustomUrl} disabled={isLoading || !customUrl.trim()}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a path (e.g., /job/xyz) or full URL. It will be submitted to Google Indexing API.
              </p>
            </TabsContent>
          </Tabs>

          {/* Last Result Display */}
          {lastResult && (
            <div className="mt-6 p-4 border rounded-lg">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                {lastResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                Last Submission Result
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
                  <div className="text-lg font-bold text-green-600">{lastResult.submitted || 0}</div>
                  <div className="text-xs text-muted-foreground">Submitted</div>
                </div>
                <div className="text-center p-2 bg-red-50 dark:bg-red-950 rounded">
                  <div className="text-lg font-bold text-red-600">{lastResult.failed || 0}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
                <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                  <div className="text-lg font-bold text-yellow-600">{lastResult.queued || 0}</div>
                  <div className="text-xs text-muted-foreground">Queued</div>
                </div>
                <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  <div className="text-lg font-bold text-blue-600">{lastResult.indexnow_fallback || 0}</div>
                  <div className="text-xs text-muted-foreground">IndexNow</div>
                </div>
              </div>
              {lastResult.errors && lastResult.errors.length > 0 && (
                <div className="mt-3 p-2 bg-red-50 dark:bg-red-950 rounded text-sm">
                  <p className="font-medium text-red-600 mb-1">Errors:</p>
                  {lastResult.errors.slice(0, 3).map((err, i) => (
                    <p key={i} className="text-xs text-red-500 truncate">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-500" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• <strong>Google Indexing API:</strong> Directly notifies Google about URL changes (fastest method)</p>
          <p>• <strong>Daily Limit:</strong> 200 URLs per day. We reserve 20 for buffer.</p>
          <p>• <strong>Auto Fallback:</strong> If quota exceeded, URLs are submitted via IndexNow (Bing, Yandex)</p>
          <p>• <strong>Job Auto-Indexing:</strong> New jobs are automatically submitted when posted</p>
          <p>• <strong>Queue System:</strong> Excess URLs are queued and processed next day</p>
        </CardContent>
      </Card>
    </div>
  );
}
