import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Bug, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DebugResult {
  step: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

interface APIDebuggerProps {
  apiKey: string;
}

export const APIDebugger = ({ apiKey }: APIDebuggerProps) => {
  const [debugging, setDebugging] = useState(false);
  const [results, setResults] = useState<DebugResult[]>([]);

  const runDiagnostics = async () => {
    setDebugging(true);
    setResults([]);
    const newResults: DebugResult[] = [];

    // Step 1: Check if API key format is valid
    if (!apiKey || apiKey.trim() === '') {
      newResults.push({
        step: '1. API Key Format',
        status: 'error',
        message: 'No API key provided',
        details: 'Please enter your API key to continue debugging'
      });
      setResults(newResults);
      setDebugging(false);
      return;
    }

    if (!apiKey.startsWith('wfh_')) {
      newResults.push({
        step: '1. API Key Format',
        status: 'warning',
        message: 'API key should start with "wfh_"',
        details: `Your key starts with: ${apiKey.substring(0, 4)}`
      });
    } else {
      newResults.push({
        step: '1. API Key Format',
        status: 'success',
        message: 'API key format is correct'
      });
    }
    setResults([...newResults]);

    // Step 2: Check if key exists in database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        newResults.push({
          step: '2. Authentication',
          status: 'error',
          message: 'You must be logged in to debug API keys'
        });
        setResults([...newResults]);
        setDebugging(false);
        return;
      }

      const { data: keyData, error: keyError } = await supabase
        .from('api_keys')
        .select('*')
        .eq('api_key', apiKey)
        .eq('user_id', user.id)
        .maybeSingle();

      if (keyError) {
        newResults.push({
          step: '2. Database Check',
          status: 'error',
          message: 'Error checking API key in database',
          details: keyError.message
        });
      } else if (!keyData) {
        newResults.push({
          step: '2. Database Check',
          status: 'error',
          message: 'API key not found in database',
          details: 'This key does not exist or does not belong to your account'
        });
      } else {
        newResults.push({
          step: '2. Database Check',
          status: 'success',
          message: 'API key found in database',
          details: {
            name: keyData.key_name,
            tier: keyData.rate_limit_tier,
            active: keyData.is_active,
            usage: keyData.usage_count
          }
        });

        // Step 3: Check if key is active
        if (!keyData.is_active) {
          newResults.push({
            step: '3. Key Status',
            status: 'error',
            message: 'API key is inactive',
            details: 'This key has been revoked or deactivated'
          });
        } else {
          newResults.push({
            step: '3. Key Status',
            status: 'success',
            message: 'API key is active'
          });
        }

        // Step 4: Check rate limits
        const tierLimits: any = {
          'free': 1000,
          'pro': 10000
        };
        const limit = tierLimits[keyData.rate_limit_tier] || 1000;
        const usagePercent = Math.round((keyData.usage_count / limit) * 100);

        if (usagePercent >= 100) {
          newResults.push({
            step: '4. Rate Limits',
            status: 'error',
            message: 'Rate limit exceeded',
            details: `Used ${keyData.usage_count} of ${limit} requests/hour (${usagePercent}%)`
          });
        } else if (usagePercent >= 80) {
          newResults.push({
            step: '4. Rate Limits',
            status: 'warning',
            message: 'Approaching rate limit',
            details: `Used ${keyData.usage_count} of ${limit} requests/hour (${usagePercent}%)`
          });
        } else {
          newResults.push({
            step: '4. Rate Limits',
            status: 'success',
            message: 'Rate limit OK',
            details: `Used ${keyData.usage_count} of ${limit} requests/hour (${usagePercent}%)`
          });
        }
      }
      setResults([...newResults]);
    } catch (error: any) {
      newResults.push({
        step: '2. Database Check',
        status: 'error',
        message: 'Failed to check database',
        details: error.message
      });
      setResults([...newResults]);
    }

    // Step 5: Test edge function connectivity
    try {
      const testUrl = 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-search?limit=1';
      const testResponse = await fetch(testUrl, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (testResponse.status === 401) {
        newResults.push({
          step: '5. Edge Function Test',
          status: 'error',
          message: 'Authentication failed',
          details: 'Edge function rejected the API key'
        });
      } else if (testResponse.ok) {
        newResults.push({
          step: '5. Edge Function Test',
          status: 'success',
          message: 'Edge function connection successful',
          details: `Status: ${testResponse.status}`
        });
      } else {
        newResults.push({
          step: '5. Edge Function Test',
          status: 'warning',
          message: `Edge function returned ${testResponse.status}`,
          details: await testResponse.text()
        });
      }
    } catch (error: any) {
      newResults.push({
        step: '5. Edge Function Test',
        status: 'error',
        message: 'Failed to connect to edge function',
        details: error.message
      });
    }

    setResults([...newResults]);
    setDebugging(false);

    const hasErrors = newResults.some(r => r.status === 'error');
    if (hasErrors) {
      toast.error('Diagnostics found issues with your API key');
    } else {
      toast.success('All diagnostics passed!');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default:
        return null;
    }
  };

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-blue-500" />
          API Connection Debugger
        </CardTitle>
        <CardDescription>
          Run diagnostics to check your API key and connection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={runDiagnostics}
          disabled={debugging || !apiKey}
          className="w-full"
        >
          {debugging ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Diagnostics...
            </>
          ) : (
            'Run Diagnostics'
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => (
              <Alert key={index} className={
                result.status === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
                result.status === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-950' :
                'border-orange-500 bg-orange-50 dark:bg-orange-950'
              }>
                <div className="flex items-start gap-3">
                  {getStatusIcon(result.status)}
                  <AlertDescription className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold">{result.step}</p>
                      <Badge variant={
                        result.status === 'success' ? 'default' :
                        result.status === 'error' ? 'destructive' : 'secondary'
                      }>
                        {result.status}
                      </Badge>
                    </div>
                    <p className="text-sm mb-1">{result.message}</p>
                    {result.details && (
                      <pre className="text-xs mt-2 p-2 bg-white dark:bg-slate-900 rounded overflow-auto">
                        {typeof result.details === 'object' 
                          ? JSON.stringify(result.details, null, 2)
                          : result.details
                        }
                      </pre>
                    )}
                  </AlertDescription>
                </div>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
