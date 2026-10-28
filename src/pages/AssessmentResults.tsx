import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  XCircle,
  Award,
  TrendingUp,
  Clock,
  Download,
  Share2,
  Loader2,
} from "lucide-react";
import { useSkillAssessments } from "@/hooks/useSkillAssessments";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { downloadCertificate } from "@/utils/certificateGenerator";
import type { UserAssessmentAttempt, SkillAssessment } from "@/types/assessment";
import { supabase } from "@/integrations/supabase/client";
import { SITE_CONFIG } from "@/config/siteConfig";

const AssessmentResults = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { issueCertificate, useUserCertificates } = useSkillAssessments();
  const { data: certificates } = useUserCertificates(user?.id);

  const [attempt, setAttempt] = useState<UserAssessmentAttempt | null>(location.state?.attempt);
  const [assessment, setAssessment] = useState<SkillAssessment | null>(location.state?.assessment);
  const [loading, setLoading] = useState(!attempt || !assessment);

  // Fetch data from Supabase if not available in state
  useEffect(() => {
    const fetchAssessmentData = async () => {
      if (!attemptId || (attempt && assessment)) return;
      
      setLoading(true);
      try {
        const { data: attemptData, error: attemptError } = await supabase
          .from('user_assessment_attempts')
          .select(`
            *,
            assessment:skill_assessments(*)
          `)
          .eq('id', attemptId)
          .single();

        if (attemptError) throw attemptError;

        setAttempt(attemptData as any);
        setAssessment(attemptData.assessment as any);
      } catch (error) {
        console.error('Error fetching assessment data:', error);
        toast.error("Failed to load assessment results");
      } finally {
        setLoading(false);
      }
    };

    fetchAssessmentData();
  }, [attemptId, attempt, assessment]);

  const issuedCertificate = certificates?.find((c) => c.attempt_id === attemptId);
  const hasCertificate = !!issuedCertificate;
  const passed = (attempt?.score ?? 0) >= (assessment?.passing_score ?? 70);

  const handleDownloadCertificate = async () => {
    if (!issuedCertificate || !user) return;
    try {
      await downloadCertificate(issuedCertificate, user.email || "User");
      toast.success("Certificate downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download certificate");
    }
  };

  const handleShareResult = () => {
    const url = `${SITE_CONFIG.PRODUCTION_DOMAIN}/verify-certificate/${issuedCertificate?.certificate_number}`;
    const text = `I've earned a ${levelInfo.level} level certification in ${assessment?.title} from Workly India with a score of ${attempt.score}%!`;

    if (navigator.share) {
      navigator
        .share({
          title: "My Assessment Result",
          text,
          url,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success("Result link copied to clipboard!");
    }
  };

  useEffect(() => {
    // Auto-issue certificate if passed and not already issued
    if (
      passed &&
      !attempt?.certificate_issued &&
      !hasCertificate &&
      user &&
      assessment &&
      attemptId &&
      !issueCertificate.isPending
    ) {
      issueCertificate.mutate({
        userId: user.id,
        assessmentId: assessment.id,
        attemptId,
        skillName: assessment.title,
        score: attempt.score ?? 0,
      });
    }
  }, [passed, attempt?.certificate_issued, hasCertificate, user, assessment, attemptId, issueCertificate.isPending]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading assessment results...</p>
        </div>
      </div>
    );
  }

  if (!attempt || !assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-foreground font-semibold mb-4">
            Assessment results not found
          </p>
          <Button onClick={() => navigate("/skill-assessment")}>
            Back to Assessments
          </Button>
        </div>
      </div>
    );
  }

  const getLevelBadge = (score: number) => {
    if (score >= 86) return { level: "Expert", color: "bg-purple-100 text-purple-800" };
    if (score >= 66) return { level: "Advanced", color: "bg-blue-100 text-blue-800" };
    if (score >= 41) return { level: "Intermediate", color: "bg-yellow-100 text-yellow-800" };
    return { level: "Beginner", color: "bg-green-100 text-green-800" };
  };

  const levelInfo = getLevelBadge(attempt.score ?? 0);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Results Card */}
        <Card className="p-8 text-center mb-6">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              passed ? "bg-green-100" : "bg-red-100"
            }`}
          >
            {passed ? (
              <CheckCircle className="w-10 h-10 text-green-600" />
            ) : (
              <XCircle className="w-10 h-10 text-red-600" />
            )}
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-2">
            {passed ? "Congratulations!" : "Keep Practicing!"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {passed
              ? "You've successfully completed the assessment"
              : "Don't give up! Try again to improve your score"}
          </p>

          <div className="flex items-center justify-center space-x-8 mb-6">
            <div>
              <div className="text-4xl font-bold text-primary mb-1">
                {attempt.score}%
              </div>
              <div className="text-sm text-muted-foreground">Your Score</div>
            </div>
            <div className="h-16 w-px bg-border"></div>
            <div>
              <Badge className={levelInfo.color}>{levelInfo.level}</Badge>
              <div className="text-sm text-muted-foreground mt-1">Level Achieved</div>
            </div>
          </div>

          <Progress value={attempt.score ?? 0} className="h-3 mb-6" />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center text-green-600 mb-1">
                <CheckCircle className="w-5 h-5 mr-1" />
                <span className="font-semibold">{attempt.correct_answers}</span>
              </div>
              <div className="text-xs text-muted-foreground">Correct</div>
            </div>
            <div>
              <div className="flex items-center justify-center text-red-600 mb-1">
                <XCircle className="w-5 h-5 mr-1" />
                <span className="font-semibold">
                  {attempt.total_questions - (attempt.correct_answers ?? 0)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">Incorrect</div>
            </div>
            <div>
              <div className="flex items-center justify-center text-muted-foreground mb-1">
                <Clock className="w-5 h-5 mr-1" />
                <span className="font-semibold">{attempt.time_taken_minutes} min</span>
              </div>
              <div className="text-xs text-muted-foreground">Time Taken</div>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {passed && hasCertificate && (
            <Button 
              className="rounded-xl" 
              size="lg"
              onClick={handleDownloadCertificate}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Certificate
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-xl"
            size="lg"
            onClick={() => navigate(`/take-assessment/${assessment.id}`)}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Retake Assessment
          </Button>
          {passed && hasCertificate && (
            <Button 
              variant="outline" 
              className="rounded-xl" 
              size="lg"
              onClick={handleShareResult}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Result
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-xl"
            size="lg"
            onClick={() => navigate("/skill-assessment")}
          >
            Back to Assessments
          </Button>
        </div>

        {/* Performance Insights */}
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center">
            <Award className="w-5 h-5 mr-2 text-primary" />
            Performance Insights
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Passing Score</span>
              <span className="text-sm font-medium text-foreground">
                {assessment.passing_score}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your Score</span>
              <span
                className={`text-sm font-medium ${
                  passed ? "text-green-600" : "text-red-600"
                }`}
              >
                {attempt.score}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Accuracy</span>
              <span className="text-sm font-medium text-foreground">
                {Math.round(
                  ((attempt.correct_answers ?? 0) / attempt.total_questions) * 100
                )}
                %
              </span>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default AssessmentResults;
