import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useWebhookMonitoring } from "@/hooks/useWebhookMonitoring";
import { Badge } from "@/components/ui/badge";
import { Webhook, CheckCircle2, AlertCircle, Clock, Activity, Copy, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import { toast } from "sonner";
import { formatDateWithSeconds } from "@/utils/dateFormatUtils";

export const WebhookMonitoringCard = () => {
  const { data, isLoading, error, refetch } = useWebhookMonitoring();
  const [copied, setCopied] = useState(false);

  const copyWebhookUrl = async () => {
    if (data?.webhook_url) {
      await navigator.clipboard.writeText(data.webhook_url);
      setCopied(true);
      toast.success("Webhook URL copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Razorpay Webhook Monitoring
          </CardTitle>
          <CardDescription>Real-time webhook health & payment tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load webhook monitoring data. Please check edge function logs.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Razorpay Webhook Monitoring
          </CardTitle>
          <CardDescription>Real-time webhook health & payment tracking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isHealthy = data?.webhook_health === "operational";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Razorpay Webhook Monitoring
            </CardTitle>
            <CardDescription>Real-time webhook health & payment tracking</CardDescription>
          </div>
          <Badge variant={isHealthy ? "default" : "destructive"} className="flex items-center gap-1">
            {isHealthy ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Operational
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3" />
                Issue Detected
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
            <div className="p-2 rounded-full bg-success/20">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Successful (Last Hour)</p>
              <p className="text-2xl font-bold text-success">
                {data?.last_hour.successful_payments || 0}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20">
            <div className="p-2 rounded-full bg-warning/20">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Payments</p>
              <p className="text-2xl font-bold text-warning">
                {data?.last_hour.pending_payments || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Environment Checks */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Environment Configuration
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="flex items-center justify-between p-2 rounded bg-muted/50">
              <span className="text-xs text-muted-foreground">Webhook Secret</span>
              {data?.status_checks.environment_variables.webhook_secret ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-muted/50">
              <span className="text-xs text-muted-foreground">Supabase URL</span>
              {data?.status_checks.environment_variables.supabase_url ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-muted/50">
              <span className="text-xs text-muted-foreground">Supabase Key</span>
              {data?.status_checks.environment_variables.supabase_key ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
          </div>
        </div>

        {/* Webhook URL */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Webhook Endpoint</p>
            <button
              onClick={copyWebhookUrl}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Copy webhook URL"
            >
              {copied ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          </div>
          <code className="text-xs break-all">{data?.webhook_url}</code>
        </div>

        {/* Last Updated */}
        {data?.timestamp && (
          <p className="text-xs text-muted-foreground text-center">
            Last updated: {formatDateWithSeconds(data.timestamp)}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
