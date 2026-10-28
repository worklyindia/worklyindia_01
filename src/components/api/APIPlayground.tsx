import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateMockResponse, getMockErrorResponse } from "./mockResponses";
import { 
  Play, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Copy,
  Zap,
  Server
} from "lucide-react";

interface Parameter {
  name: string;
  type: string;
  description: string;
  required?: boolean;
}

interface APIPlaygroundProps {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  parameters?: Parameter[];
  baseUrl?: string;
}

interface ResponseData {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
  duration: number;
}

export const APIPlayground = ({ 
  endpoint, 
  method, 
  parameters = [],
  baseUrl = 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1'
}: APIPlaygroundProps) => {
  const [apiKey, setApiKey] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState('{\n  \n}');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(true);

  // Pre-fill request body based on endpoint
  const getInitialRequestBody = () => {
    if (endpoint === '/api/jobs/boost' || endpoint.includes('boost-wallet')) {
      return '{\n  "job_id": "uuid-here",\n  "boost_package_id": "uuid-here"\n}';
    }
    if (endpoint === '/api/jobs/extend' || endpoint.includes('extend-wallet')) {
      return '{\n  "job_id": "uuid-here",\n  "duration_months": 3\n}';
    }
    return '{\n  \n}';
  };

  // Update request body when endpoint changes
  useEffect(() => {
    if (method !== 'GET') {
      setRequestBody(getInitialRequestBody());
    }
  }, [endpoint, method]);

  const handleParamChange = (paramName: string, value: string) => {
    setParamValues(prev => ({ ...prev, [paramName]: value }));
  };

  const buildUrl = () => {
    let url = `${baseUrl}${endpoint}`;
    
    if (method === 'GET' && Object.keys(paramValues).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(paramValues).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
      const queryString = queryParams.toString();
      if (queryString) url += `?${queryString}`;
    }
    
    return url;
  };

  const executeDemoRequest = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    const startTime = Date.now();
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    
    const duration = Date.now() - startTime;
    const mockData = generateMockResponse(endpoint, method, paramValues);
    
    const mockHeaders = {
      'content-type': 'application/json',
      'x-request-id': 'req_' + Math.random().toString(36).substring(7),
      'x-response-time': duration + 'ms',
      'x-demo-mode': 'true'
    };

    setResponse({
      status: 200,
      statusText: 'OK',
      data: mockData,
      headers: mockHeaders,
      duration
    });

    toast.success(`Demo request successful (${duration}ms)`, {
      description: 'This is a mock response. Enable Live Mode to test real APIs.'
    });
    
    setLoading(false);
  };

  const executeLiveRequest = async () => {
    if (!isDemoMode && !apiKey.trim()) {
      toast.error('Please enter your API key for Live Mode');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    const startTime = Date.now();

    try {
      // Build function name from endpoint
      const functionName = endpoint.replace('/api/', '').replace(/\//g, '-');
      
      const requestData: any = {
        method,
        endpoint,
        parameters: paramValues
      };

      if (method !== 'GET' && requestBody) {
        try {
          requestData.body = JSON.parse(requestBody);
        } catch (e) {
          toast.error('Invalid JSON in request body');
          setLoading(false);
          return;
        }
      }

      const { data, error: invokeError } = await supabase.functions.invoke(functionName, {
        body: requestData,
        headers: apiKey ? { 'X-API-Key': apiKey } : {}
      });

      const duration = Date.now() - startTime;

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      const mockHeaders = {
        'content-type': 'application/json',
        'x-request-id': 'req_' + Math.random().toString(36).substring(7),
        'x-response-time': duration + 'ms'
      };

      setResponse({
        status: data?.status || 200,
        statusText: data?.statusText || 'OK',
        data: data?.data || data,
        headers: mockHeaders,
        duration
      });

      if (data?.status >= 200 && data?.status < 300) {
        toast.success(`Request successful (${duration}ms)`);
      } else {
        toast.error(`Request failed with status ${data?.status || 'Unknown'}`);
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      setError(err.message || 'Request failed');
      toast.error('Request failed: ' + err.message);
      setResponse({
        status: 0,
        statusText: 'Error',
        data: { error: err.message },
        headers: {},
        duration
      });
    } finally {
      setLoading(false);
    }
  };

  const executeRequest = () => {
    if (isDemoMode) {
      executeDemoRequest();
    } else {
      executeLiveRequest();
    }
  };

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
      toast.success('Response copied to clipboard');
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 400 && status < 500) return 'text-orange-600';
    if (status >= 500) return 'text-red-600';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="w-5 h-5 text-primary" />
          <h4 className="font-semibold text-lg">Try it out</h4>
        </div>
        
        {/* Demo/Live Mode Toggle */}
        <div className="flex items-center gap-3 bg-muted/50 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-2">
            {isDemoMode ? (
              <Zap className="w-4 h-4 text-amber-500" />
            ) : (
              <Server className="w-4 h-4 text-green-500" />
            )}
            <span className="text-sm font-medium">
              {isDemoMode ? 'Demo Mode' : 'Live Mode'}
            </span>
          </div>
          <Switch
            checked={!isDemoMode}
            onCheckedChange={(checked) => setIsDemoMode(!checked)}
          />
        </div>
      </div>

      {/* Mode Info Banner */}
      <Card className={isDemoMode ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            {isDemoMode ? (
              <>
                <strong>Demo Mode:</strong> Returns mock data instantly without making real API calls. 
                Perfect for testing UI and exploring responses.
              </>
            ) : (
              <>
                <strong>Live Mode:</strong> Connects to real Supabase Edge Functions. 
                Requires valid API key and active endpoints.
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="params" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="params">Parameters</TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="auth">Auth</TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="space-y-4 mt-4">
          {parameters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No parameters required</p>
          ) : (
            <div className="space-y-3">
              {parameters.map((param) => (
                <div key={param.name} className="space-y-2">
                  <Label htmlFor={param.name} className="flex items-center gap-2">
                    {param.name}
                    {param.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                    <span className="text-xs text-muted-foreground">({param.type})</span>
                  </Label>
                  <Input
                    id={param.name}
                    placeholder={param.description}
                    value={paramValues[param.name] || ''}
                    onChange={(e) => handleParamChange(param.name, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="body" className="space-y-4 mt-4">
          {method === 'GET' ? (
            <p className="text-sm text-muted-foreground">Request body not applicable for GET requests</p>
          ) : (
            <div className="space-y-4">
              {/* Show helper info for specific endpoints */}
              {(endpoint.includes('boost') || endpoint.includes('extend')) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-700 font-medium mb-2">
                    {endpoint.includes('boost') ? '🚀 Boost Job Endpoint' : '⏰ Extend Job Endpoint'}
                  </p>
                  <p className="text-xs text-blue-600">
                    {endpoint.includes('boost') 
                      ? 'Provide a valid job_id and boost_package_id. Points will be deducted from your wallet balance.'
                      : 'Provide a valid job_id and duration_months (1, 2, 3, or 6). Cost: 50 points per month.'}
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="requestBody">Request Body (JSON)</Label>
                <Textarea
                  id="requestBody"
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder='{"key": "value"}'
                  className="font-mono text-sm min-h-[200px]"
                />
              </div>

              {/* Quick fill buttons for specific endpoints */}
              {endpoint.includes('extend') && (
                <div className="flex gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground w-full">Quick fill duration:</p>
                  {[1, 2, 3, 6].map(months => (
                    <Button
                      key={months}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        try {
                          const body = JSON.parse(requestBody);
                          body.duration_months = months;
                          setRequestBody(JSON.stringify(body, null, 2));
                        } catch (e) {
                          setRequestBody(`{\n  "job_id": "uuid-here",\n  "duration_months": ${months}\n}`);
                        }
                      }}
                    >
                      {months} {months === 1 ? 'month' : 'months'} ({months * 50} pts)
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="auth" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="wfh_xxxxxxxxxxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your API key will be sent in the Authorization header
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Request Preview */}
      <Card className="p-4 bg-muted/50">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {isDemoMode ? 'Mock Endpoint:' : 'Request URL:'}
          </p>
          <code className="text-xs break-all block">
            {isDemoMode ? `[DEMO] ${endpoint}` : buildUrl()}
          </code>
        </div>
      </Card>

      {/* Execute Button */}
      <Button 
        onClick={executeRequest} 
        disabled={loading}
        className="w-full gap-2"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending Request...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Send Request
          </>
        )}
      </Button>

      {/* Response Section */}
      {response && (
        <div className="space-y-4 animate-in fade-in-50">
          {/* Response Status */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              {response.status >= 200 && response.status < 300 ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <p className={`font-semibold ${getStatusColor(response.status)}`}>
                  {response.status} {response.statusText}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{response.duration}ms</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={copyResponse}>
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
          </div>

          {/* Response Tabs */}
          <Tabs defaultValue="body" className="w-full">
            <TabsList>
              <TabsTrigger value="body">Response Body</TabsTrigger>
              <TabsTrigger value="headers">Headers</TabsTrigger>
            </TabsList>

            <TabsContent value="body" className="mt-4">
              <div className="bg-muted p-4 rounded-lg overflow-x-auto">
                <pre className="text-xs">
                  <code>{JSON.stringify(response.data, null, 2)}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="headers" className="mt-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                {Object.entries(response.headers).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="font-semibold">{key}:</span> {value}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Request Failed</p>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
