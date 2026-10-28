import CopyPageButton from "@/components/docs/CopyPageButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, Code, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Troubleshooting = () => {
  const navigate = useNavigate();

  const commonIssues = [
    {
      title: "API Key Not Working",
      severity: "high",
      symptoms: ["Getting 401 Unauthorized errors", "Authentication failed messages", "Invalid API key responses"],
      causes: [
        "Missing or incorrect X-Api-Key header",
        "API key has been revoked or deleted",
        "Using wrong header name (e.g., 'Authorization' instead of 'X-Api-Key')",
        "Extra spaces or characters in API key",
        "Key copied incorrectly from documentation"
      ],
      solutions: [
        "Verify header name is exactly 'X-Api-Key' (case-sensitive)",
        "Check key hasn't been revoked in API Documentation page",
        "Copy key again from API Documentation (regenerate if needed)",
        "Remove any trailing/leading whitespace from key",
        "Test with cURL first to isolate application issues",
        "Check if key was created for correct environment"
      ],
      example: `// ✅ CORRECT
headers: {
  'X-Api-Key': 'wfh_abc123...',
  'Content-Type': 'application/json'
}

// ❌ WRONG
headers: {
  'Authorization': 'Bearer wfh_abc123...',  // Wrong header name
  'api-key': 'wfh_abc123...'                // Wrong header name
}`
    },
    {
      title: "Getting 429 Rate Limit Errors",
      severity: "medium",
      symptoms: ["429 Too Many Requests response", "Rate limit exceeded errors", "Requests being throttled"],
      causes: [
        "Exceeded daily request limit (100 for Free, 10,000 for Pro)",
        "Too many requests in short time period",
        "Multiple clients using same API key",
        "No rate limit handling in application",
        "Polling instead of using webhooks"
      ],
      solutions: [
        "Implement exponential backoff retry logic",
        "Check X-RateLimit-Remaining header before making requests",
        "Use Retry-After header value for wait time",
        "Cache frequently accessed data",
        "Switch to webhooks for real-time updates",
        "Upgrade to Pro plan for higher limits",
        "Implement request queueing in your application",
        "Batch multiple operations when possible"
      ],
      example: `// Exponential backoff implementation
async function makeRequestWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    
    return response;
  }
  throw new Error('Max retries exceeded');
}`
    },
    {
      title: "Webhook Not Receiving Events",
      severity: "medium",
      symptoms: ["Webhook endpoint not being called", "Missing webhook events", "No notifications received"],
      causes: [
        "Webhook URL not publicly accessible",
        "Incorrect URL format or typo",
        "Webhook endpoint returns non-200 status",
        "Firewall blocking webhook requests",
        "SSL certificate issues on webhook endpoint",
        "Webhook not configured in settings"
      ],
      solutions: [
        "Test webhook URL with webhook.site first",
        "Ensure webhook endpoint returns 200 OK",
        "Use ngrok for local testing",
        "Check firewall and security group settings",
        "Verify SSL certificate is valid",
        "Add webhook logging to debug issues",
        "Check webhook signature verification logic",
        "Ensure endpoint accepts POST requests"
      ],
      example: `// Webhook endpoint example
app.post('/webhooks/jobs', async (req, res) => {
  // 1. Verify webhook signature
  const signature = req.headers['x-webhook-signature'];
  // ... verify signature ...
  
  // 2. Process webhook data
  const event = req.body;
  console.log('Webhook received:', event);
  
  // 3. Return 200 OK immediately
  res.status(200).send('OK');
  
  // 4. Process event asynchronously
  processWebhookAsync(event);
});`
    },
    {
      title: "Slow API Response Times",
      severity: "low",
      symptoms: ["Requests taking >5 seconds", "Timeout errors", "Poor user experience"],
      causes: [
        "Fetching too much data at once",
        "No pagination implemented",
        "Multiple sequential requests instead of batching",
        "Network latency issues",
        "No caching implemented",
        "Complex queries without optimization"
      ],
      solutions: [
        "Implement pagination (limit results to 20-50 per page)",
        "Use caching for frequently accessed data",
        "Make parallel requests when possible",
        "Optimize database queries",
        "Use CDN for static assets",
        "Implement request timeouts",
        "Consider upgrading instance size (if using Lovable Cloud)",
        "Profile and optimize slow code paths"
      ],
      example: `// Parallel requests example
async function fetchJobData(jobIds) {
  // ✅ FAST - Parallel requests
  const promises = jobIds.map(id => 
    fetch(\`\${BASE_URL}/jobs/\${id}\`, { headers })
  );
  return Promise.all(promises);
  
  // ❌ SLOW - Sequential requests
  // const results = [];
  // for (const id of jobIds) {
  //   results.push(await fetch(\`\${BASE_URL}/jobs/\${id}\`, { headers }));
  // }
}`
    },
    {
      title: "CORS Errors in Browser",
      severity: "medium",
      symptoms: ["CORS policy blocked", "No 'Access-Control-Allow-Origin' header", "Preflight request failed"],
      causes: [
        "Making API call from different domain",
        "Browser blocking cross-origin request",
        "Missing CORS headers in response",
        "Incorrect request method or headers"
      ],
      solutions: [
        "CORS is enabled - check request format",
        "Ensure Content-Type is application/json",
        "Use a backend proxy for production apps",
        "Check browser console for specific error",
        "Test with Postman/cURL to isolate CORS issue",
        "Ensure API key is in headers, not URL"
      ],
      example: `// ✅ CORRECT - Headers for CORS
const response = await fetch(url, {
  method: 'GET',
  headers: {
    'X-Api-Key': API_KEY,
    'Content-Type': 'application/json'
  }
});

// 💡 TIP: For production, use a backend proxy
// Frontend -> Your Backend -> Our API
// This is more secure and avoids exposing API keys`
    }
  ];

  const debugChecklist = [
    "Verify API key is correct and active in API Documentation",
    "Check request headers include 'X-Api-Key' and 'Content-Type'",
    "Ensure request body format matches documentation examples",
    "Confirm all required parameters are included",
    "Test with cURL to rule out application-specific issues",
    "Check API Health Monitor for service status",
    "Review error response for specific error codes",
    "Check rate limit headers in response",
    "Verify endpoint URL is correct",
    "Look for typos in parameter names or values"
  ];

  const errorCodes = [
    { code: 401, name: "Unauthorized", description: "Invalid or missing API key", solution: "Check X-Api-Key header" },
    { code: 403, name: "Forbidden", description: "Account banned or insufficient permissions", solution: "Contact support" },
    { code: 404, name: "Not Found", description: "Endpoint or resource doesn't exist", solution: "Check URL spelling" },
    { code: 429, name: "Too Many Requests", description: "Rate limit exceeded", solution: "Implement backoff logic" },
    { code: 422, name: "Unprocessable Entity", description: "Validation error in request data", solution: "Check parameter format" },
    { code: 500, name: "Internal Server Error", description: "Server-side error", solution: "Retry or contact support" },
    { code: 503, name: "Service Unavailable", description: "Temporary service issue", solution: "Wait and retry" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate('/owner-portal/api-docs')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to API Documentation
          </Button>
            <CopyPageButton title="API Troubleshooting" />
          </div>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Troubleshooting Guide</h1>
              <p className="text-muted-foreground mt-1">Solve common API integration issues quickly</p>
            </div>
          </div>
        </div>

        {/* Debug Checklist */}
        <Card className="mb-8 border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-500" />
              Quick Debug Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Before diving deep, run through this checklist:
            </p>
            <div className="grid md:grid-cols-2 gap-2">
              {debugChecklist.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Common Issues */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Common Issues & Solutions</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {commonIssues.map((issue, idx) => (
                <AccordionItem key={idx} value={`issue-${idx}`}>
                  <AccordionTrigger className="hover:text-primary">
                    <div className="flex items-center gap-3 text-left">
                      <Badge variant={issue.severity === 'high' ? 'destructive' : issue.severity === 'medium' ? 'default' : 'secondary'}>
                        {issue.severity.toUpperCase()}
                      </Badge>
                      <span>{issue.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      {/* Symptoms */}
                      <div>
                        <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          Symptoms
                        </h4>
                        <ul className="space-y-1 ml-6">
                          {issue.symptoms.map((symptom, sIdx) => (
                            <li key={sIdx} className="text-sm text-muted-foreground list-disc">
                              {symptom}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Causes */}
                      <div>
                        <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          Common Causes
                        </h4>
                        <ul className="space-y-1 ml-6">
                          {issue.causes.map((cause, cIdx) => (
                            <li key={cIdx} className="text-sm text-muted-foreground list-disc">
                              {cause}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Solutions */}
                      <div>
                        <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Solutions
                        </h4>
                        <ol className="space-y-1 ml-6">
                          {issue.solutions.map((solution, solIdx) => (
                            <li key={solIdx} className="text-sm text-muted-foreground list-decimal">
                              {solution}
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Code Example */}
                      {issue.example && (
                        <div>
                          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                            <Code className="h-4 w-4 text-blue-500" />
                            Code Example
                          </h4>
                          <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-xs">
                            <code>{issue.example}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Error Codes Reference */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>HTTP Error Codes Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {errorCodes.map((error, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                  <Badge variant="outline" className="text-base font-mono">
                    {error.code}
                  </Badge>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-1">{error.name}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{error.description}</p>
                    <p className="text-sm text-primary">
                      <strong>Solution:</strong> {error.solution}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Need More Help */}
        <Card className="bg-gradient-to-br from-primary/10 via-purple-50 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">Still Having Issues?</h3>
              <p className="text-muted-foreground mb-4">
                Our support team is here to help you resolve any problems.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate('/contact-us')}>
                  Contact Support
                </Button>
                <Button variant="outline" onClick={() => navigate('/api-docs/faq')}>
                  View FAQ
                </Button>
                <Button variant="outline" onClick={() => navigate('/owner-portal/api-docs')}>
                  <Zap className="h-4 w-4 mr-2" />
                  API Health Monitor
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Troubleshooting;
