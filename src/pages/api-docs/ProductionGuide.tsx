import CopyPageButton from "@/components/docs/CopyPageButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Rocket, CheckCircle, Shield, Zap, AlertTriangle, Code } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProductionGuide = () => {
  const navigate = useNavigate();

  const prelaunchChecklist = [
    {
      category: "Authentication & Security",
      icon: Shield,
      items: [
        { task: "Store API keys in environment variables", critical: true },
        { task: "Never expose API keys in frontend code", critical: true },
        { task: "Rotate API keys regularly (every 90 days)", critical: false },
        { task: "Use different API keys for dev/staging/prod", critical: true },
        { task: "Enable 2FA on your Lovable account", critical: true },
        { task: "Implement webhook signature verification", critical: true },
        { task: "Set up API key usage monitoring", critical: false }
      ]
    },
    {
      category: "Error Handling",
      icon: AlertTriangle,
      items: [
        { task: "Implement comprehensive error handling", critical: true },
        { task: "Set up error logging and monitoring", critical: true },
        { task: "Handle rate limit (429) errors gracefully", critical: true },
        { task: "Implement exponential backoff for retries", critical: true },
        { task: "Add user-friendly error messages", critical: false },
        { task: "Set up alerts for critical errors", critical: true },
        { task: "Test error scenarios thoroughly", critical: true }
      ]
    },
    {
      category: "Performance",
      icon: Zap,
      items: [
        { task: "Implement request caching strategy", critical: false },
        { task: "Set appropriate request timeouts", critical: true },
        { task: "Use pagination for large datasets", critical: true },
        { task: "Batch API requests when possible", critical: false },
        { task: "Monitor API response times", critical: false },
        { task: "Optimize database queries", critical: true },
        { task: "Set up CDN for static assets", critical: false }
      ]
    },
    {
      category: "Monitoring & Analytics",
      icon: Code,
      items: [
        { task: "Set up API usage tracking", critical: true },
        { task: "Monitor rate limit usage", critical: true },
        { task: "Track API error rates", critical: true },
        { task: "Set up uptime monitoring", critical: true },
        { task: "Monitor webhook delivery success", critical: false },
        { task: "Track application performance metrics", critical: false },
        { task: "Set up automated health checks", critical: true }
      ]
    }
  ];

  const deploymentPhases = [
    {
      phase: "Development Environment",
      description: "Local development and initial testing",
      steps: [
        "Generate Free tier API key for development",
        "Set up local environment variables",
        "Implement core API integration",
        "Add comprehensive error handling",
        "Write unit tests for API calls",
        "Test with mock data first",
        "Document your API integration"
      ],
      tips: [
        "Use .env.local for local secrets",
        "Test error scenarios thoroughly",
        "Keep API keys out of version control"
      ]
    },
    {
      phase: "Staging Environment",
      description: "Pre-production testing with real data",
      steps: [
        "Generate separate API key for staging",
        "Deploy to staging environment",
        "Test with production-like data volume",
        "Verify webhook endpoints work",
        "Load test your integration",
        "Test rate limit handling",
        "Review all error logs"
      ],
      tips: [
        "Use Pro tier for accurate rate limit testing",
        "Test with realistic data volumes",
        "Involve QA team for thorough testing"
      ]
    },
    {
      phase: "Production Environment",
      description: "Live deployment serving real users",
      steps: [
        "Generate production API key",
        "Update production environment variables",
        "Deploy to production",
        "Monitor error logs closely",
        "Set up uptime monitoring",
        "Enable real-time alerting",
        "Create rollback plan"
      ],
      tips: [
        "Deploy during low-traffic hours",
        "Have team ready for monitoring",
        "Keep rollback script ready"
      ]
    }
  ];

  const scalingStrategies = [
    {
      title: "When to Upgrade from Free to Pro",
      indicators: [
        "Consistently hitting 100 requests/day limit",
        "Need for faster rate limits",
        "Building production applications",
        "Serving multiple users/clients",
        "Require priority support"
      ],
      action: "Upgrade to Pro (10,000 requests/day) in API Documentation"
    },
    {
      title: "When to Consider Enterprise",
      indicators: [
        "Exceeding 10,000 requests/day regularly",
        "Need for custom SLAs",
        "Require dedicated support",
        "Need IP whitelisting",
        "Custom integrations needed",
        "High-volume B2B applications"
      ],
      action: "Contact sales team for Enterprise plan"
    },
    {
      title: "Performance Optimization",
      indicators: [
        "API response times >2 seconds",
        "High server load",
        "Frequent timeout errors",
        "Database query slowness"
      ],
      action: "Upgrade Lovable Cloud instance size in Settings → Cloud → Advanced"
    }
  ];

  const bestPractices = [
    {
      title: "Caching Strategy",
      description: "Reduce API calls and improve performance",
      examples: [
        "Cache job listings for 5-10 minutes",
        "Cache company data for 1 hour",
        "Use browser localStorage for user preferences",
        "Implement Redis for server-side caching",
        "Set appropriate Cache-Control headers"
      ]
    },
    {
      title: "Rate Limit Management",
      description: "Stay within limits and handle overages gracefully",
      examples: [
        "Track remaining requests in response headers",
        "Implement request queue for high-volume apps",
        "Use webhooks instead of polling",
        "Batch multiple operations when possible",
        "Implement exponential backoff on 429 errors"
      ]
    },
    {
      title: "Security Best Practices",
      description: "Protect your integration and user data",
      examples: [
        "Never expose API keys in frontend code",
        "Use environment variables for all secrets",
        "Implement request signing for webhooks",
        "Validate all user inputs before API calls",
        "Use HTTPS for all API requests",
        "Rotate API keys every 90 days"
      ]
    },
    {
      title: "Error Recovery",
      description: "Handle failures gracefully and recover automatically",
      examples: [
        "Retry failed requests with exponential backoff",
        "Implement circuit breaker pattern",
        "Queue failed webhook deliveries for retry",
        "Log all errors with request IDs",
        "Set up automated alerts for critical errors",
        "Provide user-friendly error messages"
      ]
    }
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
            <CopyPageButton title="Production Guide" />
          </div>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Rocket className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Production Deployment Guide</h1>
              <p className="text-muted-foreground mt-1">Launch your API integration with confidence</p>
            </div>
          </div>
        </div>

        {/* Pre-Launch Checklist */}
        <Card className="mb-8 border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-primary" />
              Pre-Launch Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {prelaunchChecklist.map((section, idx) => (
                <AccordionItem key={idx} value={`section-${idx}`}>
                  <AccordionTrigger className="hover:text-primary">
                    <div className="flex items-center gap-2">
                      <section.icon className="h-5 w-5" />
                      <span>{section.category}</span>
                      <Badge variant="outline">
                        {section.items.filter(i => i.critical).length} Critical
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-4">
                      {section.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <span className="text-sm text-foreground">{item.task}</span>
                            {item.critical && (
                              <Badge variant="destructive" className="ml-2 text-xs">
                                CRITICAL
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Deployment Phases */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Deployment Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {deploymentPhases.map((phase, idx) => (
                <div key={idx} className="relative">
                  {/* Phase Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{phase.phase}</h3>
                      <p className="text-sm text-muted-foreground">{phase.description}</p>
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="ml-14 mb-4">
                    <h4 className="font-semibold text-foreground mb-2">Steps:</h4>
                    <ol className="space-y-1">
                      {phase.steps.map((step, stepIdx) => (
                        <li key={stepIdx} className="text-sm text-muted-foreground list-decimal ml-5">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Tips */}
                  <div className="ml-14 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">💡 Pro Tips:</h4>
                    <ul className="space-y-1">
                      {phase.tips.map((tip, tipIdx) => (
                        <li key={tipIdx} className="text-sm text-blue-900">
                          • {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Connector line */}
                  {idx < deploymentPhases.length - 1 && (
                    <div className="ml-5 w-0.5 h-8 bg-border my-4" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scaling Strategies */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Scaling Your Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {scalingStrategies.map((strategy, idx) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-foreground mb-3">{strategy.title}</h3>
                  <div className="mb-3">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Indicators:</p>
                    <ul className="space-y-1">
                      {strategy.indicators.map((indicator, indIdx) => (
                        <li key={indIdx} className="text-sm text-muted-foreground flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-orange-500" />
                          {indicator}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm font-semibold text-primary">
                      ✅ Action: {strategy.action}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Production Best Practices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {bestPractices.map((practice, idx) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-foreground mb-2">{practice.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{practice.description}</p>
                  <ul className="space-y-1">
                    {practice.examples.map((example, exIdx) => (
                      <li key={exIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{example}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Launch Day Tips */}
        <Card className="bg-gradient-to-br from-green-50 via-white to-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Rocket className="h-8 w-8 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-foreground mb-2">🚀 Launch Day Checklist</h3>
                <div className="grid md:grid-cols-2 gap-3 mb-4">
                  <div className="text-sm">✅ All team members ready</div>
                  <div className="text-sm">✅ Monitoring tools active</div>
                  <div className="text-sm">✅ Rollback plan documented</div>
                  <div className="text-sm">✅ Support team briefed</div>
                  <div className="text-sm">✅ API keys verified</div>
                  <div className="text-sm">✅ Error alerts configured</div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => navigate('/owner-portal/api-docs')}>
                    View API Dashboard
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/contact-us')}>
                    Contact Support
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductionGuide;
