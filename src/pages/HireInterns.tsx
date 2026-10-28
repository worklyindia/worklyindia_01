import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, Trophy, Clock, ArrowRight, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HireInterns = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      title: "Fresh Perspectives",
      description: "Bring innovative ideas and latest academic knowledge to your projects",
      icon: GraduationCap
    },
    {
      title: "Cost Effective",
      description: "Budget-friendly way to expand your team with enthusiastic talent",
      icon: Trophy
    },
    {
      title: "Future Talent Pipeline",
      description: "Identify and nurture potential full-time employees",
      icon: Users
    },
    {
      title: "Quick Onboarding",
      description: "Fast hiring process with pre-screened candidates",
      icon: Clock
    }
  ];

  const packages = [
    {
      name: "Starter Package",
      price: "₹5,000",
      duration: "per month (for each intern)",
      features: [
        "5 job postings/month",
        "30 days active duration",
        "Access to intern database",
        "Basic profile matching",
        "Contact up to 50 candidates",
        "Email support",
        "Standard posting visibility"
      ],
      popular: false
    },
    {
      name: "Professional Package", 
      price: "₹8,000",
      duration: "per month (for each intern)",
      features: [
        "15 job postings/month",
        "45 days active duration",
        "Everything in Starter",
        "Advanced filtering & search",
        "Contact unlimited candidates",
        "Priority support",
        "Enhanced posting visibility",
        "Interview scheduling tools"
      ],
      popular: true
    },
    {
      name: "Enterprise Package",
      price: "₹12,000", 
      duration: "per month (for each intern)",
      features: [
        "Unlimited job postings",
        "60 days active duration",
        "Everything in Professional",
        "Dedicated account manager",
        "Custom onboarding program",
        "Performance tracking tools",
        "Bulk hiring discounts",
        "24/7 premium support"
      ],
      popular: false
    }
  ];

  const stats = [
    { label: "Active Interns", value: "10K+", description: "Ready to contribute" },
    { label: "Universities", value: "500+", description: "Partner institutions" },
    { label: "Success Rate", value: "95%", description: "Successful placements" },
    { label: "Average Duration", value: "6 months", description: "Typical internship" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Internship Program</Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Hire Talented Interns for Your Company
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect with bright, motivated students and recent graduates. 
            Build your future workforce with India's largest intern marketplace.
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {stats.map((stat, index) => (
            <Card key={index} className="p-6 text-center bg-gradient-to-br from-white to-gray-50 border border-border/50">
              <p className="text-2xl font-bold text-primary">{stat.value}</p>
              <p className="font-semibold text-foreground">{stat.label}</p>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </Card>
          ))}
        </div>

        {/* Benefits Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
            Why Hire Interns Through Workly India?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index} className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-primary/10 rounded-xl shrink-0">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Pricing Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Choose Your Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((pkg, index) => (
              <Card key={index} className={`p-6 relative ${pkg.popular ? 'border-primary shadow-lg' : 'border-border/50'} bg-gradient-to-br from-white to-gray-50`}>
                {pkg.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">{pkg.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-primary">{pkg.price}</span>
                    <span className="text-sm text-muted-foreground">/{pkg.duration}</span>
                  </div>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {pkg.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-sm">
                      <CheckCircle className="w-4 h-4 text-green-600 mr-2 shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className={`w-full ${pkg.popular ? 'bg-primary' : ''}`}
                  variant={pkg.popular ? 'default' : 'outline'}
                  onClick={() => navigate('/employer-portal')}
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                
                <p className="text-xs text-muted-foreground text-center mt-3">
                  📜 <button 
                    onClick={() => navigate('/refund-policy')}
                    className="underline hover:text-foreground transition-colors"
                  >
                    Refund & Cancellation Policy
                  </button>
                </p>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <Card className="p-8 bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Ready to Find Your Next Intern?
            </h2>
            <p className="text-muted-foreground mb-6">
              Join hundreds of companies who have successfully hired interns through our platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate('/employer-portal')}
              >
                Start Hiring Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate('/company-directory')}
              >
                View Success Stories
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default HireInterns;