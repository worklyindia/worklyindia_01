import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  UserPlus, 
  Search, 
  Send, 
  CheckCircle, 
  Building, 
  Shield, 
  CreditCard, 
  Users,
  ArrowRight,
  Phone,
  Mail,
  Clock,
  Verified
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";
import { BRAND_CONFIG } from "@/config/brandConfig";

const HowItWorks = () => {
  const navigate = useNavigate();

  const jobSeekerSteps = [
    {
      step: 1,
      title: "Create Your Profile",
      description: "Sign up for free and complete your professional profile with skills, experience, and preferences.",
      icon: UserPlus,
      details: [
        "Complete profile verification",
        "Upload resume and portfolio",
        "Set job preferences",
        "No registration fees"
      ]
    },
    {
      step: 2,
      title: "Browse & Search Jobs",
      description: "Use our advanced search filters to find remote opportunities that match your skills and experience.",
      icon: Search,
      details: [
        "Filter by salary, experience, location",
        "Save jobs for later",
        "Set up job alerts",
        "Access to verified companies"
      ]
    },
    {
      step: 3,
      title: "Apply Directly",
      description: "Submit applications directly to employers through our secure platform.",
      icon: Send,
      details: [
        "One-click applications",
        "Track application status",
        "Direct employer communication",
        "Application history"
      ]
    },
    {
      step: 4,
      title: "Get Hired",
      description: "Connect with employers, attend interviews, and start your remote career journey.",
      icon: CheckCircle,
      details: [
        "Interview scheduling",
        "Offer negotiations",
        "Background verification support",
        "Career guidance"
      ]
    }
  ];

  const employerSteps = [
    {
      step: 1,
      title: "Company Registration",
      description: "Register your company with proper verification and documentation.",
      icon: Building,
      details: [
        "Company profile creation",
        "Business verification",
        "Document submission",
        "Compliance check"
      ]
    },
    {
      step: 2,
      title: "Post Job Requirements",
      description: "Create detailed job postings with clear requirements and compensation details.",
      icon: Search,
      details: [
        "Detailed job descriptions",
        "Transparent salary ranges",
        "Skills requirements",
        "Company culture info"
      ]
    },
    {
      step: 3,
      title: "Review Applications",
      description: "Access qualified candidate profiles and manage the recruitment process.",
      icon: Users,
      details: [
        "Candidate screening",
        "Resume downloads",
        "Interview scheduling",
        "Application tracking"
      ]
    },
    {
      step: 4,
      title: "Hire Top Talent",
      description: "Complete the hiring process with our support and guidance.",
      icon: CheckCircle,
      details: [
        "Offer management",
        "Onboarding support",
        "Compliance assistance",
        "Post-hire follow-up"
      ]
    }
  ];

  const safetyFeatures = [
    {
      title: "Company Verification",
      description: "All companies go through strict verification process",
      icon: Verified,
      details: "GST verification, business registration, address verification"
    },
    {
      title: "Secure Payments",
      description: "No upfront fees for job seekers, secure payment processing",
      icon: Shield,
      details: "PCI DSS compliant, encrypted transactions, fraud protection"
    },
    {
      title: "Direct Communication",
      description: "Direct contact between employers and candidates",
      icon: Phone,
      details: "No intermediary payments, transparent communication, verified contacts"
    },
    {
      title: "Support System",
      description: "24/7 customer support for all users",
      icon: Mail,
      details: "Phone support, email assistance, live chat, complaint resolution"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title={`How It Works - ${BRAND_CONFIG.name} Jobs | Legitimate Remote Job Platform`}
        description={`Learn how ${BRAND_CONFIG.name} Jobs works. Transparent process for job seekers and employers. No hidden fees, verified companies, secure platform.`}
        keywords="how it works, remote jobs process, legitimate job platform, remote jobs India"
      />
      
      <PageHeader title="How It Works" />
      
      <main className="container mx-auto px-3 sm:px-4 py-6 pb-24 md:pb-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Badge variant="secondary" className="px-4 py-2">
              <Shield className="w-4 h-4 mr-2" />
              Transparent & Secure Platform
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            How {BRAND_CONFIG.name} Jobs Works
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            A transparent, legitimate platform connecting remote job seekers with verified employers. 
            No hidden fees, no false promises - just real opportunities.
          </p>
        </div>

        {/* Job Seekers Process */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">For Job Seekers</h2>
            <p className="text-muted-foreground">100% Free - No Registration Fees or Hidden Charges</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {jobSeekerSteps.map((step, index) => (
              <Card key={index} className="p-6 relative hover:shadow-lg transition-all duration-200">
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {step.step}
                </div>
                <div className="mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{step.description}</p>
                </div>
                <ul className="space-y-1">
                  {step.details.map((detail, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex items-center">
                      <CheckCircle className="w-3 h-3 text-green-600 mr-2 flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>

        {/* Employers Process */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">For Employers</h2>
            <p className="text-muted-foreground">Transparent Pricing - Pay Only for Successful Hires</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {employerSteps.map((step, index) => (
              <Card key={index} className="p-6 relative hover:shadow-lg transition-all duration-200">
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {step.step}
                </div>
                <div className="mb-4">
                  <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-3">
                    <step.icon className="w-6 h-6 text-secondary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{step.description}</p>
                </div>
                <ul className="space-y-1">
                  {step.details.map((detail, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex items-center">
                      <CheckCircle className="w-3 h-3 text-green-600 mr-2 flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>

        {/* Safety & Security Features */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Safety & Security</h2>
            <p className="text-muted-foreground">How we ensure a safe and legitimate platform</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {safetyFeatures.map((feature, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all duration-200">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{feature.description}</p>
                    <p className="text-xs text-green-700 bg-green-50 p-2 rounded">{feature.details}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Payment & Pricing Transparency */}
        <div className="mb-16">
          <Card className="p-8 bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Payment Transparency</h2>
              <p className="text-muted-foreground">Clear, honest pricing with no hidden fees</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-foreground mb-4">For Job Seekers</h3>
                <ul className="space-y-3">
                  <li className="flex items-center text-green-700">
                    <CheckCircle className="w-5 h-5 mr-3" />
                    <span>100% Free registration and job applications</span>
                  </li>
                  <li className="flex items-center text-green-700">
                    <CheckCircle className="w-5 h-5 mr-3" />
                    <span>No hidden charges or subscription fees</span>
                  </li>
                  <li className="flex items-center text-green-700">
                    <CheckCircle className="w-5 h-5 mr-3" />
                    <span>Premium features available with transparent pricing</span>
                  </li>
                  <li className="flex items-center text-green-700">
                    <CheckCircle className="w-5 h-5 mr-3" />
                    <span>No payment required before getting a job</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-foreground mb-4">For Employers</h3>
                <ul className="space-y-3">
                  <li className="flex items-center text-blue-700">
                    <CreditCard className="w-5 h-5 mr-3" />
                    <span>Pay only for successful job postings</span>
                  </li>
                  <li className="flex items-center text-blue-700">
                    <CreditCard className="w-5 h-5 mr-3" />
                    <span>Transparent pricing plans available</span>
                  </li>
                  <li className="flex items-center text-blue-700">
                    <CreditCard className="w-5 h-5 mr-3" />
                    <span>Secure payment processing</span>
                  </li>
                  <li className="flex items-center text-blue-700">
                    <CreditCard className="w-5 h-5 mr-3" />
                    <span>Money-back guarantee for verified companies</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* Support & Contact */}
        <div className="text-center">
          <Card className="p-8 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <h2 className="text-2xl font-bold text-foreground mb-4">Need Help?</h2>
            <p className="text-muted-foreground mb-6">
              Our support team is here to help you at every step of your journey
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button onClick={() => navigate('/contact-us')} className="flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                Contact Support: +91 9904923067
              </Button>
              <Button variant="outline" onClick={() => navigate('/faq')}>
                <Mail className="w-4 h-4 mr-2" />
                View FAQ
              </Button>
            </div>
            
            <div className="mt-4 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 inline mr-1" />
              Support Hours: Monday - Friday, 9 AM - 6 PM IST
            </div>
          </Card>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default HowItWorks;