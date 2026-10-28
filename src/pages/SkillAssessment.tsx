import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  Code, 
  Presentation, 
  Palette, 
  TrendingUp,
  Clock,
  Trophy,
  Play,
  BarChart3,
  CheckCircle,
  Star,
  Award,
  Plus,
  Download
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSkillAssessments } from "@/hooks/useSkillAssessments";
import { useAuth } from "@/contexts/AuthContext";
import { AssessmentCard } from "@/components/assessment/AssessmentCard";
import { downloadCertificate } from "@/utils/certificateGenerator";
import { toast } from "sonner";
import * as LucideIcons from "lucide-react";

const SkillAssessment = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    useCategories, 
    useAssessmentsByCategory,
    useUserAttempts, 
    useUserCertificates 
  } = useSkillAssessments();

  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: allAssessments } = useAssessmentsByCategory();
  const { data: userAttempts } = useUserAttempts(user?.id);
  const { data: userCertificates } = useUserCertificates(user?.id);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const getIconComponent = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || Code;
    return Icon;
  };

  const handleStartAssessment = (assessment: any) => {
    navigate(`/take-assessment/${assessment.id}`);
  };

  const handleDownloadCertificate = async (certificate: any) => {
    try {
      const userName = user?.email || "User";
      await downloadCertificate(certificate, userName);
      toast.success("Certificate downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download certificate");
    }
  };

  const getCompletedAssessments = () => {
    if (!userAttempts) return [];
    
    return userAttempts
      .filter((attempt: any) => attempt.status === 'completed' && attempt.assessment)
      .map((attempt: any) => ({
        id: attempt.id,
        skill: attempt.assessment.title,
        score: attempt.score,
        level: getLevelFromScore(attempt.score),
        completedDate: getRelativeTime(attempt.completed_at),
        certificate: attempt.certificate_issued,
        attemptId: attempt.id
      }));
  };

  const getLevelFromScore = (score: number) => {
    if (score >= 86) return "Expert";
    if (score >= 66) return "Advanced";
    if (score >= 41) return "Intermediate";
    return "Beginner";
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  const overallScore = getCompletedAssessments().reduce((acc, curr) => acc + curr.score, 0) / 
    (getCompletedAssessments().length || 1);

  const myAssessments = getCompletedAssessments();

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Skill Assessment" />
      
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-7xl">
        <div className="flex items-center space-x-3 mb-6">
          <Brain className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Skill Assessment</h1>
        </div>

        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="my-results">My Results</TabsTrigger>
            <TabsTrigger value="practice">Practice</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-6">
            {categoriesLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading categories...</p>
              </div>
            ) : selectedCategory ? (
              <>
                {(() => {
                  const category = categories?.find(c => c.id === selectedCategory);
                  const Icon = category ? getIconComponent(category.icon_name) : Code;
                  const categoryAssessments = allAssessments?.filter((a) => a.category_id === selectedCategory) || [];
                  
                  return (
                    <>
                      <Button 
                        variant="outline" 
                        onClick={() => setSelectedCategory(null)}
                        className="mb-4"
                      >
                        ← Back to Categories
                      </Button>
                      
                      {category && (
                        <Card className="p-6 mb-6 bg-gradient-to-br from-primary/5 to-primary/10">
                          <div className="flex items-start space-x-4">
                            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                              <Icon className="w-8 h-8 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h2 className="text-2xl font-bold text-foreground mb-2">
                                {category.title}
                              </h2>
                              <p className="text-muted-foreground mb-3">
                                {category.description}
                              </p>
                              <div className="flex flex-wrap gap-3 text-sm">
                                <Badge variant="outline">{category.difficulty}</Badge>
                                <div className="flex items-center text-muted-foreground">
                                  <Clock className="w-4 h-4 mr-1" />
                                  {category.duration}
                                </div>
                                <div className="text-muted-foreground">
                                  {categoryAssessments.length} {categoryAssessments.length === 1 ? 'Assessment' : 'Assessments'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {categoryAssessments.map((assessment) => (
                          <AssessmentCard
                            key={assessment.id}
                            assessment={assessment}
                            onStart={handleStartAssessment}
                          />
                        ))}
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">Assessment Categories</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {categories?.map((category) => {
                    const Icon = getIconComponent(category.icon_name);
                    const assessmentCount = allAssessments?.filter(
                      (a) => a.category_id === category.id
                    ).length || 0;

                    return (
                      <Card key={category.id} className="p-6 hover:shadow-soft transition-shadow">
                        <div className="space-y-4">
                          <div className="flex items-start space-x-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                              <Icon className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-foreground">
                                {category.title}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {category.description}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Difficulty:</span>
                              <Badge variant="outline">{category.difficulty}</Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Duration:</span>
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-1 text-muted-foreground" />
                                <span className="text-muted-foreground">{category.duration}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Assessments:</span>
                              <Badge>{assessmentCount}</Badge>
                            </div>
                          </div>

                          <Button 
                            className="w-full rounded-xl"
                            onClick={() => setSelectedCategory(category.id)}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            View Assessments
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="my-results" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">My Assessment Results</h2>
              <div className="flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-yellow-600" />
                <span className="text-sm font-medium text-foreground">
                  Overall Score: {Math.round(overallScore)}%
                </span>
              </div>
            </div>

            {myAssessments.length === 0 ? (
              <Card className="p-12 text-center">
                <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No Assessment Results Yet
                </h3>
                <p className="text-muted-foreground mb-6">
                  Complete your first assessment to see your results here
                </p>
                <Button onClick={() => setSelectedCategory(null)}>
                  Browse Assessments
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4">
                {myAssessments.map((assessment, index) => (
                  <Card key={index} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-foreground">{assessment.skill}</h3>
                        <p className="text-sm text-muted-foreground">
                          Completed {assessment.completedDate}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge variant={assessment.level === "Expert" ? "default" : "secondary"}>
                          {assessment.level}
                        </Badge>
                        {assessment.certificate && (
                          <Award className="w-5 h-5 text-yellow-600" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Score</span>
                        <span className="font-medium text-foreground">{assessment.score}%</span>
                      </div>
                      <Progress value={assessment.score} className="w-full" />
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => navigate(`/assessment-results/${assessment.attemptId}`)}
                      >
                        View Details
                      </Button>
                      {assessment.certificate && (
                        <Button 
                          size="sm" 
                          className="rounded-xl"
                          onClick={async () => {
                            const cert = userCertificates?.find(c => c.attempt_id === assessment.attemptId);
                            if (cert) await handleDownloadCertificate(cert);
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Certificate
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="practice" className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Practice Assessments</h2>
              <Badge variant="outline">No Time Limit</Badge>
            </div>
            
            {allAssessments && allAssessments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {allAssessments.map((assessment) => (
                  <Card key={assessment.id} className="p-6 hover:shadow-soft transition-shadow">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground mb-1">
                            {assessment.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {assessment.description}
                          </p>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {assessment.difficulty}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{assessment.total_questions} questions</span>
                        <span>Practice mode</span>
                      </div>

                      <Button
                        className="w-full rounded-xl"
                        variant="outline"
                        onClick={() => navigate(`/practice-mode/${assessment.id}`)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start Practice
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  No Assessments Available
                </h2>
                <p className="text-muted-foreground mb-6">
                  Check back later for practice assessments
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="certificates" className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">My Certificates</h2>
            
            {userCertificates && userCertificates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userCertificates.map((cert, index) => (
                  <Card key={index} className="p-6 text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Award className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {cert.skill_name} Certification
                    </h3>
                    <Badge className="mb-2">{cert.level}</Badge>
                    <p className="text-sm text-muted-foreground mb-2">Score: {cert.score}%</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Issued {getRelativeTime(cert.issued_at)}
                    </p>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="rounded-xl flex-1"
                        onClick={() => navigate(cert.verification_url || '#')}
                      >
                        View
                      </Button>
                      <Button 
                        size="sm" 
                        className="rounded-xl flex-1"
                        onClick={() => handleDownloadCertificate(cert)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </Card>
                ))}
                
                <Card className="p-6 text-center border-dashed">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Earn More Certificates</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Complete assessments to earn skill certificates
                  </p>
                  <Button 
                    size="sm" 
                    className="rounded-xl"
                    onClick={() => document.querySelector('[value="categories"]')?.dispatchEvent(new MouseEvent('click'))}
                  >
                    Browse Assessments
                  </Button>
                </Card>
              </div>
            ) : (
              <Card className="p-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No Certificates Yet
                </h3>
                <p className="text-muted-foreground mb-6">
                  Complete assessments with passing scores to earn certificates
                </p>
                <Button 
                  className="rounded-xl"
                  onClick={() => document.querySelector('[value="categories"]')?.dispatchEvent(new MouseEvent('click'))}
                >
                  Browse Assessments
                </Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default SkillAssessment;