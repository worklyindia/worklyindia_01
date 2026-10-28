import { useState } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building, 
  Users, 
  TrendingUp, 
  CheckCircle,
  ArrowRight,
  Target,
  Award,
  Clock
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";

const CaseStudies = () => {
  const navigate = useNavigate();

  const caseStudies = [
    {
      id: 1,
      company: "TechCorp Solutions",
      industry: "Information Technology",
      challenge: "Needed to hire 50+ developers within 3 months for a major project expansion",
      solution: "Implemented our Volume Hiring solution with automated screening and bulk interview scheduling",
      results: [
        "Hired 52 qualified developers in 2.5 months",
        "Reduced time-to-hire by 40%",
        "Saved ₹15 lakhs in recruitment costs",
        "95% candidate retention after 1 year"
      ],
      testimonial: "The team delivered exactly what we needed, when we needed it. Their process was efficient and the quality of candidates was exceptional.",
      author: "Rajesh Kumar, HR Director",
      icon: Users,
      color: "from-blue-500 to-cyan-500"
    },
    {
      id: 2,
      company: "FinTech Ventures",
      industry: "Financial Services",
      challenge: "Required a senior CTO with blockchain expertise for strategic expansion",
      solution: "Utilized our Executive Search service with confidential headhunting and executive assessment",
      results: [
        "Found perfect CTO candidate in 6 weeks",
        "Conducted confidential search across 3 countries",
        "Comprehensive executive assessment completed",
        "Successful onboarding and immediate impact"
      ],
      testimonial: "Professional service from start to finish. They understood our unique requirements and delivered a candidate who exceeded expectations.",
      author: "Vikram Singh, CEO",
      icon: Target,
      color: "from-purple-500 to-pink-500"
    },
    {
      id: 3,
      company: "Manufacturing Co",
      industry: "Manufacturing",
      challenge: "Seasonal workforce of 200+ workers needed for 4-month production cycle",
      solution: "Deployed Volume Hiring solution with quick onboarding and progress tracking",
      results: [
        "Hired 210 workers in 3 weeks",
        "Streamlined onboarding process",
        "100% compliance with labor regulations",
        "Zero hiring-related production delays"
      ],
      testimonial: "They made bulk hiring feel effortless. The systematic approach and support throughout the process was outstanding.",
      author: "Sneha Reddy, VP Operations",
      icon: Award,
      color: "from-green-500 to-emerald-500"
    },
    {
      id: 4,
      company: "Digital Innovations",
      industry: "Digital Marketing",
      challenge: "Needed specialized tech talent for AI and machine learning projects",
      solution: "Applied Tech Recruitment solution with technical screening and coding assessments",
      results: [
        "Hired 8 ML engineers and 12 AI specialists",
        "Technical screening accuracy of 92%",
        "Reduced interview-to-hire ratio by 60%",
        "Strong cultural fit across all hires"
      ],
      testimonial: "Their understanding of technical roles is impressive. They pre-screened candidates so well that our technical interviews were highly productive.",
      author: "Priya Sharma, Talent Acquisition Lead",
      icon: TrendingUp,
      color: "from-orange-500 to-red-500"
    }
  ];

  const stats = [
    { label: "Case Studies", value: "25+", icon: Building },
    { label: "Industries", value: "12+", icon: Target },
    { label: "Success Rate", value: "98%", icon: TrendingUp },
    { label: "Avg. Time Saved", value: "40%", icon: Clock }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50">
      <PageHeader title="Case Studies" />
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Case Studies
            </h1>
          </div>
        </div>

        {/* Hero Section */}
        <Card className="p-8 mb-8 bg-primary/5 border-primary/20 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Real Results from Real Clients</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Discover how we've helped companies across industries solve their recruitment challenges 
            and achieve exceptional hiring outcomes
          </p>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="p-4 text-center bg-white">
              <stat.icon className="w-8 h-8 text-primary mx-auto mb-2" />
              <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* Case Studies */}
        <div className="space-y-8">
          {caseStudies.map((study, index) => (
            <Card key={study.id} className="p-6 md:p-8 hover:shadow-lg transition-shadow">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${study.color} rounded-lg flex items-center justify-center shrink-0`}>
                      <study.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">{study.company}</h3>
                      <Badge variant="outline" className="mt-2">{study.industry}</Badge>
                    </div>
                  </div>
                </div>

                {/* Challenge */}
                <div>
                  <h4 className="font-semibold text-foreground mb-2 flex items-center">
                    <Target className="w-5 h-5 text-primary mr-2" />
                    The Challenge
                  </h4>
                  <p className="text-muted-foreground">{study.challenge}</p>
                </div>

                {/* Solution */}
                <div>
                  <h4 className="font-semibold text-foreground mb-2 flex items-center">
                    <Building className="w-5 h-5 text-primary mr-2" />
                    Our Solution
                  </h4>
                  <p className="text-muted-foreground">{study.solution}</p>
                </div>

                {/* Results */}
                <div>
                  <h4 className="font-semibold text-foreground mb-3 flex items-center">
                    <TrendingUp className="w-5 h-5 text-primary mr-2" />
                    Results Achieved
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {study.results.map((result, resultIndex) => (
                      <div key={resultIndex} className="flex items-start space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">{result}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Testimonial */}
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <p className="text-muted-foreground italic mb-2">"{study.testimonial}"</p>
                  <p className="text-sm font-semibold text-foreground">— {study.author}</p>
                </Card>
              </div>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <Card className="p-8 mt-12 text-center bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-primary/20">
          <h3 className="text-2xl font-bold text-foreground mb-4">Ready to Write Your Success Story?</h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join these successful companies and transform your recruitment process with our proven solutions
          </p>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 justify-center">
            <Button 
              size="lg" 
              className="rounded-xl"
              onClick={() => navigate('/recruitment-solutions')}
            >
              Explore Solutions
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="rounded-xl"
              onClick={() => navigate('/contact-us')}
            >
              Contact Sales Team
            </Button>
          </div>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default CaseStudies;
