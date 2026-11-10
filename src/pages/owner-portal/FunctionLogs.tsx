import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorFallback from "@/components/ErrorFallback";
import RealTimeSync from "@/components/platform/RealTimeSync";
import { useSupabaseDownload } from "@/hooks/useSupabaseDownload";
import { 
  Activity, 
  Search, 
  Filter, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  FileText,
  Download
} from "lucide-react";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface FunctionLog {
  id: string;
  function_name: string;
  execution_id: string;
  status: string;
  execution_time_ms: number;
  error_message?: string;
  request_data?: any;
  response_data?: any;
  created_at: string;
}

const FunctionLogs = () => {
  const [logs, setLogs] = useState<FunctionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [functionFilter, setFunctionFilter] = useState<string>('all');
  const [functions, setFunctions] = useState<string[]>([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchLogs();
    fetchFunctions();
  }, []);

  const fetchLogs = async () => {
    try {
      setError(null);
      setLoading(true);
      
      // Fetch real logs from database
      let query = supabase
        .from('function_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (functionFilter !== 'all') {
        query = query.eq('function_name', functionFilter);
      }

      const { data: logs, error: logsError } = await query;
      
      if (logsError) {
        throw logsError;
      }

      setLogs(logs || []);
      
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      setError(error?.message || 'Failed to fetch function logs');
      toast.error('Failed to fetch function logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchFunctions = async () => {
    try {
      // Get unique function names from function_logs table
      const { data: logs, error } = await supabase
        .from('function_logs')
        .select('function_name')
        .order('function_name');

      if (error) {
        console.error('Error fetching functions:', error);
        return;
      }

      // Get unique function names
      const uniqueFunctions = [...new Set(logs?.map(log => log.function_name) || [])];
      setFunctions(uniqueFunctions.sort());
    } catch (error) {
      console.error('Error fetching functions:', error);
    }
  };

  const filteredLogs = logs.filter(log =>
    log.function_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.error_message && log.error_message.toLowerCase().includes(searchTerm.toLowerCase())) ||
    log.execution_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'timeout': return <Clock className="w-4 h-4 text-orange-500" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      success: "default",
      error: "destructive",
      timeout: "secondary"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const { downloadCSV, isDownloading } = useSupabaseDownload();

  const exportLogs = async () => {
    const csvData = filteredLogs.map(log => ({
      Function: log.function_name,
      Status: log.status,
      'Execution Time (ms)': log.execution_time_ms,
      Error: log.error_message || '',
      Timestamp: new Date(log.created_at).toISOString()
    }));

    await downloadCSV(`function-logs-${new Date().toISOString().split('T')[0]}`, csvData);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
        <LoadingSpinner size="lg" className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
        <ErrorFallback 
          title="Failed to load Function Logs"
          description={error}
          resetError={() => {
            setError(null);
            setLoading(true);
            fetchLogs();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Function Logs</h1>
            <p className="text-muted-foreground">Monitor edge function execution logs and performance</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportLogs} size={isMobile ? "sm" : "default"} disabled={isDownloading}>
              <Download className="w-4 h-4 mr-2" />
              {isDownloading ? "Exporting..." : isMobile ? "Export" : "Export CSV"}
            </Button>
            <Button onClick={fetchLogs} size={isMobile ? "sm" : "default"}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Executions</p>
                  <p className="text-2xl font-bold">{logs.length}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Successful</p>
                  <p className="text-2xl font-bold text-green-600">
                    {logs.filter(l => l.status === 'success').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Errors</p>
                  <p className="text-2xl font-bold text-red-600">
                    {logs.filter(l => l.status === 'error').length}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Time</p>
                  <p className="text-2xl font-bold">
                    {logs.length > 0 
                      ? Math.round(logs.reduce((acc, l) => acc + (l.execution_time_ms || 0), 0) / logs.length)
                      : 0
                    }ms
                  </p>
                </div>
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <div className="absolute left-3 top-3 pointer-events-none"><LottieSearchIcon size={16} /></div>
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                </SelectContent>
              </Select>
              <Select value={functionFilter} onValueChange={setFunctionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by function" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Functions</SelectItem>
                  {functions.map(func => (
                    <SelectItem key={func} value={func}>{func}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setFunctionFilter('all');
                  fetchLogs();
                }}
              >
                <Filter className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Real-time sync component */}
        <RealTimeSync onFunctionLogsUpdate={fetchLogs} />

        {/* Logs List */}
        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Logs Found</h3>
                <p className="text-muted-foreground mb-4">
                  {logs.length === 0 
                    ? "No function executions have been logged yet"
                    : "No logs match your current filters"
                  }
                </p>
                {logs.length === 0 && (
                  <Button onClick={fetchLogs}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Logs
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredLogs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(log.status)}
                      <div>
                        <h3 className="text-lg font-semibold">{log.function_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {log.execution_id && `ID: ${log.execution_id.slice(0, 8)}...`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(log.status)}
                      <Badge variant="outline">
                        {log.execution_time_ms}ms
                      </Badge>
                    </div>
                  </div>

                  {log.error_message && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <h4 className="font-medium text-destructive mb-1">Error Message</h4>
                      <p className="text-sm text-destructive/80 font-mono">{log.error_message}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {log.request_data && (
                      <div>
                        <h4 className="font-medium mb-1">Request Data</h4>
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-32">
                          {JSON.stringify(log.request_data, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.response_data && (
                      <div>
                        <h4 className="font-medium mb-1">Response Data</h4>
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-32">
                          {JSON.stringify(log.response_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {new Date(log.created_at).toLocaleString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FunctionLogs;