import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "@/components/BottomNavigation";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Target, 
  TrendingUp, 
  Shield, 
  Clock,
  CheckCircle,
  Star,
  Award,
  BarChart3,
  Zap,
  Globe,
  Phone
} from "lucide-react";
import { useRecruitmentSolutions } from "@/hooks/useRecruitmentSolutions";
import { useRecruitmentTestimonials } from "@/hooks/useRecruitmentTestimonials";
import { useRecruitmentStats } from "@/hooks/useRecruitmentStats";
import { RecruitmentInquiryDialog } from "@/components/recruitment/RecruitmentInquiryDialog";
import { supabase } from "@/integrations/supabase/client";

const RecruitmentSolutions = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inquiryType, setInquiryType] = useState<'demo' | 'contact_sales' | 'get_started' | 'case_study' | 'learn_more'>('get_started');

  const { data: solutions, isLoading: loadingSolutions } = useRecruitmentSolutions();
  const { data: testimonials, isLoading: loadingTestimonials } = useRecruitmentTestimonials();
  const { data: stats, isLoading: loadingStats } = useRecruitmentStats();

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('recruitment-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recruitment_solutions' },
        () => {
          console.log('Recruitment solutions updated');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recruitment_testimonials' },
        () => {
          console.log('Recruitment testimonials updated');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openDialog = (type: typeof inquiryType) => {
    setInquiryType(type);
    setDialogOpen(true);
  };

  // Icon mapping
  const iconMap: Record<string, any> = {
    Users,
    Target,
    Zap,
    Award,
    Shield,
    Clock,
    TrendingUp,
    BarChart3,
    Globe
  };

  // Static data as fallback (removed original static data)
  const staticSolutions = [
    {
      id: 1,
      title: "Volume Hiring",
      description: "Efficiently hire large numbers of candidates for seasonal or expansion needs",
      features: ["Automated screening", "Bulk interview scheduling", "Quick onboarding", "Progress tracking"],
      icon: Users,
      price: "Custom Pricing",
      popular: false
    },
    {
      id: 2,
      title: "Executive Search",
      description: "Find and recruit top-level executives and senior management positions",
      features: ["Headhunting services", "Confidential search", "Executive assessment", "Success guarantee"],
      icon: Target,
      price: "Premium Service",
      popular: true
    },
    {
      id: 3,
      title: "Tech Recruitment",
      description: "Specialized recruitment for technical roles and IT positions",
      features: ["Technical screening", "Coding assessments", "Portfolio review", "Cultural fit analysis"],
      icon: Zap,
      price: "Starting ₹50K",
      popular: false
    },
    {
      id: 4,
      title: "Campus Recruitment",
      description: "Connect with fresh graduates from top colleges and universities",
      features: ["Campus partnerships", "Student assessments", "Internship programs", "Graduate tracking"],
      icon: Award,
      price: "Package deals",
      popular: false
    }
  ];

  const displayedSolutions = solutions || staticSolutions;


  const displayStats = [
    { 
      label: "Companies Served", 
      value: loadingStats ? "..." : `${stats?.companies_served || 0}+`, 
      icon: Users 
    },
    { 
      label: "Successful Placements", 
      value: loadingStats ? "..." : `${stats?.successful_placements || 0}+`, 
      icon: Target 
    },
    { 
      label: "Average Time to Hire", 
      value: loadingStats ? "..." : `${stats?.avg_time_to_hire || 15} Days`, 
      icon: Clock 
    },
    { 
      label: "Client Satisfaction", 
      value: loadingStats ? "..." : `${stats?.client_satisfaction || 95}%`, 
      icon: Star 
    }
  ];

  const staticTestimonials = [
    {
      id: '1',
      name: "Rajesh Kumar",
      position: "HR Director",
      company: "TechCorp Solutions",
      feedback: "Their recruitment solutions helped us scale our team efficiently. The quality of candidates was excellent.",
      rating: 5,
      is_verified: true
    },
    {
      id: '2',
      name: "Priya Sharma",
      position: "Talent Acquisition Lead",
      company: "Digital Innovations",
      feedback: "The executive search service found us the perfect CTO. Their process was thorough and professional.",
      rating: 5,
      is_verified: true
    },
    {
      id: '3',
      name: "Amit Patel",
      position: "Founder",
      company: "StartUp Hub",
      feedback: "Great support for our startup's hiring needs. They understood our culture and found candidates that fit perfectly.",
      rating: 4,
      is_verified: false
    }
  ];

  const displayedTestimonials = testimonials || staticTestimonials;

  return (
    <>
      <RecruitmentInquiryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        inquiryType={inquiryType}
      />
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50">
      <PageHeader title="Recruitment Solutions" />
      
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-7xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Recruitment Solutions</h1>
        </div>

        {/* Hero Section */}
        <Card className="p-8 mb-8 bg-primary/5 border-primary/20">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-foreground">Enterprise Hiring Solutions</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Streamline your recruitment process with our comprehensive hiring solutions. 
              From volume hiring to executive search, we've got you covered.
            </p>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 justify-center">
              <Button 
                size="sm" 
                className="rounded-xl px-6 py-2"
                onClick={() => openDialog('get_started')}
              >
                Get Started
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="rounded-xl px-6 py-2"
                onClick={() => openDialog('demo')}
              >
                <Phone className="w-4 h-4 mr-2" />
                Schedule Demo
              </Button>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {displayStats.map((stat, index) => (
            <Card key={index} className="p-4 text-center">
              {loadingStats ? (
                <>
                  <Skeleton className="w-8 h-8 mx-auto mb-2 rounded-full" />
                  <Skeleton className="h-8 w-16 mx-auto mb-2" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                </>
              ) : (
                <>
                  <stat.icon className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </>
              )}
            </Card>
          ))}
        </div>

        <Tabs defaultValue="solutions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="solutions">Solutions</TabsTrigger>
            <TabsTrigger value="process">Our Process</TabsTrigger>
            <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
          </TabsList>

          <TabsContent value="solutions" className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Our Recruitment Solutions</h2>
            
            {loadingSolutions ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-32 w-full mb-4" />
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {displayedSolutions.map((solution) => {
                  const IconComponent = iconMap[solution.icon_name] || Users;
                  return (
                    <Card key={solution.id} className={`p-6 hover:shadow-soft transition-shadow ${solution.is_popular ? 'border-primary bg-primary/5' : ''}`}>
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                              <IconComponent className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">{solution.title}</h3>
                              {solution.is_popular && (
                                <Badge className="text-xs">Most Popular</Badge>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline">{solution.price}</Badge>
                        </div>

                        <p className="text-sm text-muted-foreground">{solution.description}</p>

                        <div className="space-y-2">
                          <h4 className="font-medium text-foreground">Key Features:</h4>
                          <ul className="space-y-1">
                            {solution.features.map((feature, index) => (
                              <li key={index} className="flex items-center text-sm text-muted-foreground">
                                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Button 
                          className="w-full rounded-xl"
                          onClick={() => openDialog('learn_more')}
                        >
                          Learn More
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="process" className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Our Recruitment Process</h2>
            
            <div className="space-y-6">
              {[
                {
                  step: "1",
                  title: "Requirement Analysis",
                  description: "We start by understanding your specific hiring needs, company culture, and role requirements in detail.",
                  icon: Target
                },
                {
                  step: "2",
                  title: "Candidate Sourcing",
                  description: "Our team sources candidates from multiple channels including our database, job boards, and networks.",
                  icon: Users
                },
                {
                  step: "3",
                  title: "Screening & Assessment",
                  description: "Comprehensive screening process including skills assessment, background checks, and cultural fit evaluation.",
                  icon: Shield
                },
                {
                  step: "4",
                  title: "Interview Coordination",
                  description: "We coordinate and schedule interviews between shortlisted candidates and your hiring team.",
                  icon: Clock
                },
                {
                  step: "5",
                  title: "Offer & Onboarding",
                  description: "Support with offer negotiation, acceptance, and smooth onboarding of selected candidates.",
                  icon: CheckCircle
                }
              ].map((process, index) => (
                <Card key={index} className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-lg font-semibold">
                      {process.step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <process.icon className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-semibold text-foreground">{process.title}</h3>
                      </div>
                      <p className="text-muted-foreground">{process.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="testimonials" className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">What Our Clients Say</h2>
            
            {loadingTestimonials ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-24 w-full mb-4" />
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedTestimonials.map((testimonial) => (
                  <Card key={testimonial.id} className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, starIndex) => (
                          <Star 
                            key={starIndex} 
                            className={`w-4 h-4 ${starIndex < testimonial.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} 
                          />
                        ))}
                      </div>
                      
                      <p className="text-muted-foreground italic">"{testimonial.feedback}"</p>
                      
                      <div>
                        <h4 className="font-semibold text-foreground flex items-center gap-2">
                          {testimonial.name}
                          {testimonial.is_verified && (
                            <Badge variant="secondary" className="text-xs">Verified</Badge>
                          )}
                        </h4>
                        <p className="text-sm text-muted-foreground">{testimonial.position}</p>
                        <p className="text-sm text-primary">{testimonial.company}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <Card className="p-8 text-center bg-primary/5 border-primary/20">
              <h3 className="text-xl font-semibold text-foreground mb-4">Ready to Get Started?</h3>
              <p className="text-muted-foreground mb-6">
                Join hundreds of companies who trust us with their recruitment needs
              </p>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 justify-center">
                <Button 
                  size="sm" 
                  className="rounded-xl px-6 py-2"
                  onClick={() => navigate('/contact-us')}
                >
                  Contact Sales Team
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="rounded-xl px-6 py-2"
                  onClick={() => navigate('/case-studies')}
                >
                  View Case Studies
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

        <BottomNavigation />
      </div>
    </>
  );
};

export default RecruitmentSolutions;