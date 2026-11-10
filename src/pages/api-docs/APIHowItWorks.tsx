import CopyPageButton from "@/components/docs/CopyPageButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Zap, Shield, CheckCircle, Code } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const APIHowItWorks = () => {
  const navigate = useNavigate();

  const steps = [
    {
      step: 1,
      title: "Get API Key",
      description: "Generate your API key from the API Documentation page",
      icon: Shield,
      details: [
        "Sign up or login to your account",
        "Navigate to API Documentation",
        "Click 'Generate API Key'",
        "Choose Free or Pro tier",
        "Copy and save your key securely"
      ]
    },
    {
      step: 2,
      title: "Integrate SDK",
      description: "Choose your preferred SDK and integrate with your application",
      icon: Code,
      details: [
        "Select JavaScript, Python, or cURL",
        "Follow SDK-specific documentation",
        "Add API key to your code",
        "Configure base URL",
        "Test your first API call"
      ]
    },
    {
      step: 3,
      title: "Make API Calls",
      description: "Start making authenticated requests to our endpoints",
      icon: Zap,
      details: [
        "Search for jobs programmatically",
        "Create job postings via API",
        "Submit applications",
        "Fetch company information",
        "Monitor API usage"
      ]
    },
    {
      step: 4,
      title: "Production Ready",
      description: "Scale your integration with production best practices",
      icon: CheckCircle,
      details: [
        "Handle rate limits properly",
        "Implement error handling",
        "Monitor API analytics",
        "Upgrade to Pro for higher limits",
        "Use webhooks for events"
      ]
    }
  ];

  const flowDiagram = [
    { from: "Your App", to: "API Request", action: "HTTP Request with API Key" },
    { from: "API Request", to: "Authentication", action: "Validate API Key" },
    { from: "Authentication", to: "Rate Limiting", action: "Check Usage Limits" },
    { from: "Rate Limiting", to: "Processing", action: "Execute Request" },
    { from: "Processing", to: "Your App", action: "JSON Response" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/owner-portal/api-docs')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to API Documentation
        </Button>
          <CopyPageButton title="How the API Works" />
        </div>

        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              How the API Works
            </h1>
            <p className="text-muted-foreground text-lg">
              Understand the complete flow from integration to production
            </p>
          </div>

          <Separator />

          {/* Step-by-Step Guide */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Getting Started in 4 Steps</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {steps.map((step, index) => (
                <Card key={index} className="p-6 relative hover:shadow-lg transition-all duration-200">
                  <div className="absolute -top-3 -left-3 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                    {step.step}
                  </div>
                  <div className="mb-4">
                    <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <step.icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{step.description}</p>
                  </div>
                  <ul className="space-y-2">
                    {step.details.map((detail, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>

          {/* API Request Flow */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">API Request Flow</h2>
            <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="space-y-4">
                {flowDiagram.map((flow, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div className="px-4 py-2 bg-white rounded-lg shadow-sm border border-border">
                            <p className="font-semibold text-foreground">{flow.from}</p>
                          </div>
                          <div className="flex-1 flex items-center">
                            <div className="h-0.5 bg-primary flex-1" />
                            <ArrowRight className="w-5 h-5 text-primary mx-2" />
                          </div>
                          <div className="px-4 py-2 bg-white rounded-lg shadow-sm border border-border">
                            <p className="font-semibold text-foreground">{flow.to}</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 ml-4">{flow.action}</p>
                      </div>
                    </div>
                    {index < flowDiagram.length - 1 && (
                      <div className="w-0.5 h-6 bg-primary/30 ml-20 my-1" />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Authentication Details */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Authentication</h2>
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">API Key Authentication</h3>
                  <p className="text-muted-foreground mb-4">
                    All API requests must include your API key in the request headers:
                  </p>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`headers: {
  'X-Api-Key': 'your-api-key-here',
  'Content-Type': 'application/json'
}`}
                  </pre>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">✓ Free Tier</h4>
                    <ul className="text-sm text-green-800 space-y-1">
                      <li>• 100 requests per day</li>
                      <li>• 1 API key allowed</li>
                      <li>• Basic endpoints access</li>
                      <li>• Community support</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h4 className="font-semibold text-purple-900 mb-2">★ Pro Tier</h4>
                    <ul className="text-sm text-purple-800 space-y-1">
                      <li>• 10,000 requests per day</li>
                      <li>• 2 API keys allowed</li>
                      <li>• All endpoints access</li>
                      <li>• Priority support</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Rate Limiting */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Rate Limiting</h2>
            <Card className="p-6">
              <p className="text-muted-foreground mb-4">
                API requests are rate-limited based on your tier. When you exceed the limit, you'll receive a 429 status code.
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">Rate Limit Headers</h4>
                <pre className="text-sm overflow-x-auto">
{`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
Retry-After: 3600`}
                </pre>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Always check the <code className="bg-muted px-2 py-1 rounded">X-RateLimit-Remaining</code> header to monitor your usage.
              </p>
            </Card>
          </div>

          {/* Error Handling */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Error Responses</h2>
            <Card className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-semibold text-red-900">401 Unauthorized</p>
                    <p className="text-sm text-red-700">Invalid or missing API key</p>
                  </div>
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="font-semibold text-orange-900">429 Too Many Requests</p>
                    <p className="text-sm text-orange-700">Rate limit exceeded</p>
                  </div>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="font-semibold text-yellow-900">400 Bad Request</p>
                    <p className="text-sm text-yellow-700">Invalid request parameters</p>
                  </div>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="font-semibold text-gray-900">500 Server Error</p>
                    <p className="text-sm text-gray-700">Internal server error</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Next Steps */}
          <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <h3 className="text-xl font-bold text-foreground mb-4">Ready to Start?</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => navigate('/owner-portal/api-docs')}>
                Generate API Key
              </Button>
              <Button variant="outline" onClick={() => navigate('/api-docs/javascript-sdk')}>
                View JavaScript SDK
              </Button>
              <Button variant="outline" onClick={() => navigate('/api-docs/python-sdk')}>
                View Python SDK
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default APIHowItWorks;
