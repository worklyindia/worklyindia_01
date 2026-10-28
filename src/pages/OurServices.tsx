import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Users, 
  FileText, 
  Award, 
  Building, 
  GraduationCap, 
  Target, 
  BarChart3,
  ArrowRight,
  CheckCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const OurServices = () => {
  const navigate = useNavigate();

  const services = [
    {
      title: "Job Search & Placement",
      description: "Find your perfect remote job with our AI-powered matching system",
      icon: Search,
      features: [
        "Smart job recommendations", 
        "Advanced filtering options",
        "Real-time job alerts",
        "Application tracking"
      ],
      path: "/jobs",
      color: "bg-gradient-to-br from-blue-500 to-blue-600"
    },
    {
      title: "Recruitment Solutions",
      description: "Complete hiring solutions for businesses of all sizes",
      icon: Users,
      features: [
        "Candidate sourcing",
        "Interview scheduling", 
        "Skills assessment",
        "Bulk hiring support"
      ],
      path: "/recruitment-solutions",
      color: "bg-gradient-to-br from-green-500 to-green-600"
    },
    {
      title: "Resume Building",
      description: "Create professional resumes that get you noticed",
      icon: FileText,
      features: [
        "ATS-friendly templates",
        "Professional formatting",
        "Industry-specific examples",
        "Export in multiple formats"
      ],
      path: "/resume-builder",
      color: "bg-gradient-to-br from-purple-500 to-purple-600"
    },
    {
      title: "Skill Assessment",
      description: "Validate your skills with certified assessments",
      icon: Award,
      features: [
        "Industry-standard tests",
        "Instant results",
        "Skill verification certificates",
        "Performance analytics"
      ],
      path: "/skill-assessment",
      color: "bg-gradient-to-br from-orange-500 to-orange-600"
    },
    {
      title: "Company Profiles",
      description: "Showcase your company culture and attract top talent",
      icon: Building,
      features: [
        "Enhanced company pages",
        "Culture showcasing",
        "Employee testimonials",
        "Performance metrics"
      ],
      path: "/company-directory",
      color: "bg-gradient-to-br from-indigo-500 to-indigo-600"
    },
    {
      title: "Internship Programs",
      description: "Connect students with meaningful internship opportunities",
      icon: GraduationCap,
      features: [
        "University partnerships",
        "Mentorship programs",
        "Project-based learning",
        "Career guidance"
      ],
      path: "/hire-interns",
      color: "bg-gradient-to-br from-pink-500 to-pink-600"
    },
    {
      title: "Career Guidance",
      description: "Expert advice and mentorship for career growth",
      icon: Target,
      features: [
        "One-on-one mentoring",
        "Career path planning",
        "Industry insights",
        "Personal branding"
      ],
      path: "/career-guidance",
      color: "bg-gradient-to-br from-teal-500 to-teal-600"
    },
    {
      title: "Analytics & Insights",
      description: "Data-driven insights for better hiring decisions",
      icon: BarChart3,
      features: [
        "Market trend analysis",
        "Salary benchmarking",
        "Hiring analytics",
        "Performance tracking"
      ],
      path: "/employer-portal",
      color: "bg-gradient-to-br from-red-500 to-red-600"
    }
  ];

  const plans = [
    {
      name: "Job Seeker",
      price: "Free",
      description: "Perfect for individual job seekers",
      features: [
        "Access to all job listings",
        "Basic profile creation",
        "Job alerts",
        "Application tracking",
        "Resume builder (basic)"
      ],
      popular: false
    },
    {
      name: "Professional",
      price: "₹999/month",
      description: "Enhanced features for serious job seekers",
      features: [
        "Everything in Free",
        "Priority job recommendations",
        "Advanced resume templates",
        "Skill assessments",
        "Career guidance sessions"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom Pricing",
      description: "Complete solutions for businesses",
      features: [
        "Unlimited job postings",
        "Advanced recruitment tools",
        "Dedicated account manager",
        "Custom integrations",
        "Analytics dashboard"
      ],
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Our Services</Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Complete Workly India Solutions
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From job searching to hiring, skill development to career growth - 
            we provide everything you need for Workly India success.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {services.map((service, index) => (
            <Card 
              key={index} 
              className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50 hover:shadow-lg transition-all duration-200 cursor-pointer group"
              onClick={() => navigate(service.path)}
            >
              <div className="text-center space-y-4">
                <div className={`w-16 h-16 ${service.color} rounded-2xl mx-auto flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <service.icon className="w-8 h-8 text-white" />
                </div>
                
                <div>
                  <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {service.description}
                  </p>
                </div>
                
                <div className="space-y-2">
                  {service.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center text-xs text-muted-foreground">
                      <CheckCircle className="w-3 h-3 text-green-600 mr-2 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                
                <Button variant="outline" size="sm" className="w-full mt-4">
                  Learn More
                  <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Pricing Section */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-4">Choose Your Plan</h2>
            <p className="text-muted-foreground">
              Flexible pricing for individuals and businesses
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, index) => (
              <Card key={index} className={`p-6 relative ${plan.popular ? 'border-primary shadow-lg scale-105' : 'border-border/50'} bg-gradient-to-br from-white to-gray-50`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-3xl font-bold text-primary">{plan.price}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-sm">
                      <CheckCircle className="w-4 h-4 text-green-600 mr-2 shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className={`w-full ${plan.popular ? 'bg-primary' : ''}`}
                  variant={plan.popular ? 'default' : 'outline'}
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <Card className="p-8 bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Ready to Transform Your Workly India Experience?
            </h2>
            <p className="text-muted-foreground mb-6">
              Join thousands of professionals and companies who trust Workly India for their Workly India needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate('/jobs')}
              >
                Start Job Searching
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate('/employer-portal')}
              >
                Post a Job
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default OurServices;