import CopyPageButton from "@/components/docs/CopyPageButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap, DollarSign, Shield, Clock, TrendingUp, Users, CheckCircle, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const Benefits = () => {
  const navigate = useNavigate();

  const keyBenefits = [
    {
      title: "Lightning Fast Integration",
      description: "Get up and running in minutes, not days",
      icon: Zap,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      details: [
        "Simple REST API design",
        "Comprehensive SDK support",
        "Clear documentation",
        "Code examples for all languages",
        "Interactive API playground"
      ]
    },
    {
      title: "Cost Effective",
      description: "Free tier for testing, affordable Pro plans",
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
      details: [
        "Free tier: 100 requests/day",
        "No credit card required",
        "Pay only for what you use",
        "Volume discounts available",
        "Transparent pricing"
      ]
    },
    {
      title: "Enterprise Security",
      description: "Bank-level security for your data",
      icon: Shield,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      details: [
        "API key authentication",
        "Encrypted data transmission",
        "Rate limiting protection",
        "Audit logs",
        "GDPR compliant"
      ]
    },
    {
      title: "24/7 Reliability",
      description: "99.9% uptime SLA",
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      details: [
        "Distributed infrastructure",
        "Automatic failover",
        "Real-time health monitoring",
        "Scheduled maintenance windows",
        "Status page updates"
      ]
    },
    {
      title: "Scale Effortlessly",
      description: "Grow from startup to enterprise",
      icon: TrendingUp,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      details: [
        "Auto-scaling infrastructure",
        "Handle millions of requests",
        "No performance degradation",
        "Predictable latency",
        "Load balancing"
      ]
    },
    {
      title: "Developer Friendly",
      description: "Built by developers, for developers",
      icon: Users,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
      details: [
        "RESTful design principles",
        "JSON responses",
        "Comprehensive error messages",
        "Versioned API",
        "Active community support"
      ]
    }
  ];

  const comparisonFeatures = [
    { feature: "API Requests per Day", free: "100", pro: "10,000", enterprise: "Unlimited" },
    { feature: "API Keys", free: "1", pro: "2", enterprise: "Custom" },
    { feature: "Rate Limit Reset", free: "Daily", pro: "Hourly", enterprise: "Custom" },
    { feature: "Analytics Dashboard", free: "Basic", pro: "Advanced", enterprise: "Custom" },
    { feature: "Support", free: "Community", pro: "Email", enterprise: "Dedicated" },
    { feature: "SLA", free: "-", pro: "99.9%", enterprise: "99.99%" },
    { feature: "Webhooks", free: "-", pro: "✓", enterprise: "✓" },
    { feature: "Custom Integrations", free: "-", pro: "-", enterprise: "✓" }
  ];

  const useCases = [
    {
      title: "Job Aggregator Platforms",
      description: "Build job search engines that aggregate listings from multiple sources",
      benefits: ["Real-time job updates", "Rich job metadata", "Company information"],
      icon: Sparkles
    },
    {
      title: "HR Management Systems",
      description: "Integrate job posting capabilities into your HR platform",
      benefits: ["Automated job posting", "Application tracking", "Candidate management"],
      icon: Users
    },
    {
      title: "Recruitment Tools",
      description: "Create specialized recruitment tools and dashboards",
      benefits: ["Custom workflows", "Analytics integration", "Multi-channel posting"],
      icon: TrendingUp
    },
    {
      title: "Mobile Applications",
      description: "Power native mobile apps with our API",
      benefits: ["Lightweight responses", "Efficient pagination", "Mobile-optimized data"],
      icon: Zap
    }
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
          <CopyPageButton title="API Benefits" />
        </div>

        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <Badge className="mb-4">Why Choose Our API</Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              API Benefits & Features
            </h1>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              Everything you need to build powerful job platform integrations
            </p>
          </div>

          <Separator />

          {/* Key Benefits Grid */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Key Benefits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {keyBenefits.map((benefit, index) => (
                <Card key={index} className="p-6 hover:shadow-lg transition-all duration-200">
                  <div className={`w-14 h-14 ${benefit.bgColor} rounded-lg flex items-center justify-center mb-4`}>
                    <benefit.icon className={`w-7 h-7 ${benefit.color}`} />
                  </div>
                  <h3 className="font-semibold text-lg text-foreground mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{benefit.description}</p>
                  <ul className="space-y-2">
                    {benefit.details.map((detail, idx) => (
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

          {/* Pricing Comparison */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Tier Comparison</h2>
            <Card className="p-6 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Feature</th>
                    <th className="text-center py-3 px-4 font-semibold text-green-700">Free</th>
                    <th className="text-center py-3 px-4 font-semibold text-purple-700">Pro</th>
                    <th className="text-center py-3 px-4 font-semibold text-blue-700">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((row, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-muted-foreground">{row.feature}</td>
                      <td className="py-3 px-4 text-center font-medium">{row.free}</td>
                      <td className="py-3 px-4 text-center font-medium text-purple-700">{row.pro}</td>
                      <td className="py-3 px-4 text-center font-medium text-blue-700">{row.enterprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Use Cases */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Use Cases</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {useCases.map((useCase, index) => (
                <Card key={index} className="p-6 hover:shadow-lg transition-all duration-200">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <useCase.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-2">{useCase.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{useCase.description}</p>
                      <ul className="space-y-1">
                        {useCase.benefits.map((benefit, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-center">
                            <CheckCircle className="w-3 h-3 text-green-600 mr-2" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* ROI Calculator */}
          <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <h2 className="text-2xl font-bold text-foreground mb-4">Time to Value</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-3xl font-bold text-green-600 mb-2">5 mins</div>
                <p className="text-sm text-muted-foreground">Setup Time</p>
                <p className="text-xs text-muted-foreground mt-1">From signup to first API call</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-3xl font-bold text-blue-600 mb-2">2 hours</div>
                <p className="text-sm text-muted-foreground">Integration Time</p>
                <p className="text-xs text-muted-foreground mt-1">Full production integration</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-3xl font-bold text-purple-600 mb-2">10x</div>
                <p className="text-sm text-muted-foreground">Faster Development</p>
                <p className="text-xs text-muted-foreground mt-1">vs building from scratch</p>
              </div>
            </div>
          </Card>

          {/* CTA Section */}
          <Card className="p-8 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-foreground mb-4">Ready to Get Started?</h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Join hundreds of developers building amazing job platform integrations with our API
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" onClick={() => navigate('/owner-portal/api-docs')}>
                  Generate Free API Key
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/api-docs/how-it-works')}>
                  Learn How It Works
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Benefits;
