import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { AssessmentDialog } from "@/components/career/AssessmentDialog";
import { useCareerPaths } from "@/hooks/useCareerPaths";
import { useSkillAssessments } from "@/hooks/useSkillAssessments";
import { useCareerPlanningProgress, useUpdateCareerProgress } from "@/hooks/useCareerPlanning";
import { supabase } from "@/integrations/supabase/client";
import { 
  Compass, 
  TrendingUp, 
  BookOpen, 
  Users, 
  Target,
  Award,
  ArrowRight,
  Clock,
  Star,
  Lightbulb
} from "lucide-react";

const CareerGuidance = () => {
  const navigate = useNavigate();
  const [showAssessmentDialog, setShowAssessmentDialog] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Fetch current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // Fetch career paths from Supabase
  const { data: careerPaths, isLoading: pathsLoading } = useCareerPaths();
  
  // Fetch skill categories and assessments
  const { useCategories, useAssessmentsByCategory } = useSkillAssessments();
  const { data: skillCategories } = useCategories();
  const { data: allAssessments } = useAssessmentsByCategory(undefined);
  
  // Fetch career planning progress
  const { data: planningProgress } = useCareerPlanningProgress(user?.id);
  const updateProgress = useUpdateCareerProgress();

  // Format salary range
  const formatSalary = (min: number, max: number) => {
    const formatNum = (num: number) => {
      if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
      if (num >= 100000) return `₹${(num / 100000).toFixed(0)}L`;
      return `₹${(num / 1000).toFixed(0)}K`;
    };
    return `${formatNum(min)}-${formatNum(max)}`;
  };

  // Handle explore jobs button
  const handleExploreJobs = (category: string | null) => {
    if (category) {
      navigate(`/jobs?q=${encodeURIComponent(category)}`);
    } else {
      navigate("/jobs");
    }
  };

  // Handle career planning step toggle
  const handleStepToggle = (stepNumber: number, stepName: string, currentStatus: boolean) => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    updateProgress.mutate({
      userId: user.id,
      stepNumber,
      stepName,
      isCompleted: !currentStatus,
    });
  };

  // Check if step is completed
  const isStepCompleted = (stepNumber: number) => {
    return planningProgress?.find(p => p.step_number === stepNumber)?.is_completed || false;
  };

  const careerTips = [
    {
      title: "Set Clear Goals",
      description: "Define your short-term and long-term career objectives",
      icon: Target
    },
    {
      title: "Build Your Network",
      description: "Connect with professionals in your field and attend industry events",
      icon: Users
    },
    {
      title: "Keep Learning",
      description: "Stay updated with industry trends and continuously upgrade your skills",
      icon: BookOpen
    },
    {
      title: "Seek Mentorship",
      description: "Find experienced professionals who can guide your career journey",
      icon: Star
    },
    {
      title: "Take Calculated Risks",
      description: "Don't be afraid to step out of your comfort zone for growth",
      icon: TrendingUp
    },
    {
      title: "Document Achievements",
      description: "Keep track of your accomplishments and build a strong portfolio",
      icon: Award
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Career Guidance" />
      
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-8 max-w-7xl">

        <Tabs defaultValue="paths" className="w-full" onValueChange={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <TabsList className="sticky top-14 z-30 shadow-sm grid w-full grid-cols-4 h-12 p-1 bg-muted gap-1 mb-4">
            <TabsTrigger value="paths" className="text-xs sm:text-sm px-2 sm:px-4 py-3 whitespace-nowrap rounded-lg">
              <span className="hidden sm:inline">Career </span>Paths
            </TabsTrigger>
            <TabsTrigger value="skills" className="text-xs sm:text-sm px-2 sm:px-4 py-3 whitespace-nowrap rounded-lg">
              <span className="hidden sm:inline">Skill </span>Development
            </TabsTrigger>
            <TabsTrigger value="tips" className="text-xs sm:text-sm px-2 sm:px-4 py-3 whitespace-nowrap rounded-lg">
              <span className="hidden sm:inline">Career </span>Tips
            </TabsTrigger>
            <TabsTrigger value="planning" className="text-xs sm:text-sm px-2 sm:px-4 py-3 whitespace-nowrap rounded-lg">
              <span className="hidden sm:inline">Career </span>Planning
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paths" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Explore Career Paths</h2>
              <Button 
                variant="outline" 
                className="rounded-xl"
                onClick={() => setShowAssessmentDialog(true)}
              >
                <Target className="w-4 h-4 mr-2" />
                Take Assessment
              </Button>
            </div>

            {pathsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading career paths...</div>
            ) : careerPaths && careerPaths.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {careerPaths.map((path) => (
                  <Card key={path.id} className="p-4 hover:shadow-soft transition-shadow">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-foreground">{path.title}</h3>
                        <Badge variant={path.growth_rate === "High" ? "default" : "secondary"}>
                          {path.growth_rate} Growth
                        </Badge>
                      </div>
                      
                      {path.description && (
                        <p className="text-sm text-muted-foreground">{path.description}</p>
                      )}
                      
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">Popular Roles:</p>
                        <div className="flex flex-wrap gap-1">
                          {path.popular_roles.slice(0, 4).map((role, roleIndex) => (
                            <Badge key={roleIndex} variant="outline" className="text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">Average Salary:</p>
                        <p className="text-primary font-semibold">
                          {formatSalary(path.avg_salary_min, path.avg_salary_max)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">Key Skills:</p>
                        <div className="flex flex-wrap gap-1">
                          {path.key_skills.slice(0, 3).map((skill, skillIndex) => (
                            <Badge key={skillIndex} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <Button 
                        className="w-full rounded-xl"
                        onClick={() => handleExploreJobs(path.job_category)}
                      >
                        Explore {path.title} Jobs
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No career paths available at the moment
              </div>
            )}
          </TabsContent>

          <TabsContent value="skills" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Skill Development Guide</h2>
              <Button 
                variant="outline"
                onClick={() => setShowAssessmentDialog(true)}
              >
                View All Assessments
              </Button>
            </div>
            
            {skillCategories && skillCategories.length > 0 ? (
              <div className="space-y-3">
                {skillCategories.map((category) => {
                  const categoryAssessments = allAssessments?.filter(
                    a => a.category_id === category.id
                  ) || [];
                  
                  return (
                    <Card key={category.id} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-foreground">{category.title}</h3>
                        <Badge>{categoryAssessments.length} Assessments</Badge>
                      </div>
                      
                      {category.description && (
                        <p className="text-sm text-muted-foreground mb-4">{category.description}</p>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categoryAssessments.slice(0, 4).map((assessment) => (
                          <button type="button" key={assessment.id} onClick={() => navigate(user ? `/take-assessment/${assessment.id}` : "/login")} className="flex items-start space-x-3 p-3 border rounded-lg text-left w-full hover:bg-muted/50 transition-colors">
                            <Lightbulb className="w-4 h-4 text-primary mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{assessment.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {assessment.duration_minutes}m
                                </Badge>
                                <Badge variant="secondary" className="text-xs capitalize">
                                  {assessment.difficulty}
                                </Badge>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      
                      {categoryAssessments.length > 4 && (
                        <Button 
                          variant="ghost" 
                          className="w-full mt-4"
                          onClick={() => setShowAssessmentDialog(true)}
                        >
                          View {categoryAssessments.length - 4} more assessments
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No skill assessments available right now
              </div>
            )}
          </TabsContent>

          <TabsContent value="tips" className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Expert Career Tips</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {careerTips.map((tip, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <tip.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">{tip.title}</h3>
                      <p className="text-sm text-muted-foreground">{tip.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="planning" className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Career Planning Framework</h2>
            
            <div className="space-y-3">
              <Card className="p-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">The 5-Step Career Planning Process</h3>
                {!user && (
                  <p className="text-sm text-muted-foreground mb-4">
                    <button type="button" onClick={() => navigate("/login")} className="text-primary underline">Login</button> to track your progress
                  </p>
                )}
                
                <div className="space-y-4">
                  {[
                    {
                      step: "Self-Assessment",
                      description: "Understand your interests, values, skills, and personality",
                      timeframe: "1-2 weeks"
                    },
                    {
                      step: "Career Exploration",
                      description: "Research different career options and industries",
                      timeframe: "2-4 weeks"
                    },
                    {
                      step: "Goal Setting",
                      description: "Set specific, measurable, achievable career goals",
                      timeframe: "1 week"
                    },
                    {
                      step: "Action Planning",
                      description: "Create a detailed plan with steps to achieve your goals",
                      timeframe: "1-2 weeks"
                    },
                    {
                      step: "Implementation & Review",
                      description: "Execute your plan and regularly review your progress",
                      timeframe: "Ongoing"
                    }
                  ].map((step, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = isStepCompleted(stepNumber);
                    
                    return (
                      <div key={index} className="flex items-start space-x-4">
                        <div className="flex items-center gap-3">
                          {user && (
                            <Checkbox
                              checked={isCompleted}
                              onCheckedChange={() => handleStepToggle(stepNumber, step.step, isCompleted)}
                            />
                          )}
                          <div className={`w-8 h-8 ${isCompleted ? 'bg-primary' : 'bg-muted'} ${isCompleted ? 'text-primary-foreground' : 'text-muted-foreground'} rounded-full flex items-center justify-center text-sm font-semibold transition-colors`}>
                            {stepNumber}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className={`font-medium ${isCompleted ? 'text-foreground' : 'text-foreground'}`}>
                              {step.step}
                            </h4>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Clock className="w-4 h-4 mr-1" />
                              {step.timeframe}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-start space-x-3">
                  <Target className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Career Success Formula</h3>
                    <p className="text-sm text-muted-foreground">
                      Career Success = (Skills + Experience + Network) × Opportunity × Timing. 
                      Focus on building skills, gaining relevant experience, and expanding your network 
                      while staying alert to opportunities and timing.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>


      <AssessmentDialog open={showAssessmentDialog} onOpenChange={setShowAssessmentDialog} />
    </div>
  );
};

export default CareerGuidance;