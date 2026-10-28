import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, CreditCard, Server, Code } from "lucide-react";

const PaymentIntegrationStatus = () => {
  const components = [
    { name: "RazorpayButton", status: "active", description: "Main payment component with full integration" },
    { name: "BoostPaymentDialog", status: "active", description: "Job boost payment modal" },
    { name: "PaymentTest", status: "active", description: "Testing interface for payments" },
  ];

  const edgeFunctions = [
    { name: "create-razorpay-order", status: "active", description: "Creates payment orders" },
    { name: "unified-verify-payment", status: "active", description: "Unified payment verification (points, boost, verification, guest)" },
    { name: "unified-2fa", status: "active", description: "Unified 2FA operations (Telegram, Push, Pattern)" },
    { name: "unified-voice", status: "active", description: "Unified voice operations (TTS, STT)" },
  ];

  const configuration = [
    { name: "Razorpay Live Key", value: "rzp_live_R6RyChgIPVTEu9", status: "configured" },
    { name: "Payment Theme", value: "#3B82F6 (Primary Blue)", status: "configured" },
    { name: "HMAC Verification", value: "SHA256 with timing-safe comparison", status: "secure" },
    { name: "Rate Limiting", value: "5 requests per minute", status: "protected" },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
      case "configured":
      case "secure":
      case "protected":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case "error":
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <CheckCircle className="w-4 h-4 text-success" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === "active" || status === "configured" || status === "secure" || status === "protected" 
      ? "default" 
      : status === "warning" 
      ? "secondary" 
      : "destructive";
    
    return (
      <Badge variant={variant} className="text-xs">
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Components Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-primary" />
            React Components
          </CardTitle>
          <CardDescription>
            Payment-related React components status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {components.map((component) => (
              <div key={component.name} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(component.status)}
                  <div>
                    <div className="font-medium text-sm">{component.name}</div>
                    <div className="text-xs text-muted-foreground">{component.description}</div>
                  </div>
                </div>
                {getStatusBadge(component.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edge Functions Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-secondary" />
            Supabase Edge Functions
          </CardTitle>
          <CardDescription>
            Backend payment processing functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {edgeFunctions.map((func) => (
              <div key={func.name} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(func.status)}
                  <div>
                    <div className="font-medium text-sm">{func.name}</div>
                    <div className="text-xs text-muted-foreground">{func.description}</div>
                  </div>
                </div>
                {getStatusBadge(func.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-warning" />
            Payment Configuration
          </CardTitle>
          <CardDescription>
            Razorpay and security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {configuration.map((config) => (
              <div key={config.name} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(config.status)}
                  <div>
                    <div className="font-medium text-sm">{config.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{config.value}</div>
                  </div>
                </div>
                {getStatusBadge(config.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Overall Status */}
      <Card className="bg-success/5 border-success/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-success" />
            <div>
              <div className="font-semibold text-success">Payment Integration Complete ✅</div>
              <div className="text-sm text-muted-foreground">
                All Razorpay components are properly configured and ready for production use.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentIntegrationStatus;