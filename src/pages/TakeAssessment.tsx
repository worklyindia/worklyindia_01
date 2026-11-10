import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuestionCard } from "@/components/assessment/QuestionCard";
import { useSkillAssessments } from "@/hooks/useSkillAssessments";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UserAnswer } from "@/types/assessment";

const TakeAssessment = () => {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    useAssessmentQuestions,
    useAssessmentsByCategory,
    startAssessment,
    completeAssessment,
  } = useSkillAssessments();

  const { data: questions, isLoading } = useAssessmentQuestions(assessmentId);
  const { data: assessments } = useAssessmentsByCategory();
  
  const assessment = assessments?.find((a) => a.id === assessmentId);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [startTime] = useState(Date.now());

  // Start assessment attempt on mount
  useEffect(() => {
    if (assessment && questions && user && !attemptId) {
      startAssessment.mutate(
        {
          assessmentId: assessment.id,
          userId: user.id,
          totalQuestions: questions.length,
        },
        {
          onSuccess: (data) => {
            setAttemptId(data.id);
            setTimeLeft(assessment.duration_minutes * 60);
          },
        }
      );
    }
  }, [assessment, questions, user]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleSelectAnswer = (index: number) => {
    if (!questions) return;
    const currentQuestion = questions[currentQuestionIndex];
    setAnswers(new Map(answers.set(currentQuestion.id, index)));
  };

  const handleNext = () => {
    if (!questions) return;
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!questions || !attemptId || !assessment) return;

    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const userAnswers: UserAnswer[] = questions.map((q) => ({
      question_id: q.id,
      selected_index: answers.get(q.id) ?? -1,
      is_correct: answers.get(q.id) === q.correct_answer_index,
      time_spent_seconds: Math.floor(timeTaken / questions.length),
    }));

    completeAssessment.mutate(
      {
        attemptId,
        answers: userAnswers,
        questions,
        timeTaken,
      },
      {
        onSuccess: (data) => {
          navigate(`/assessment-results/${attemptId}`, {
            state: { attempt: data, assessment },
          });
        },
      }
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (!questions || questions.length === 0 || !assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground font-semibold mb-2">Assessment not found</p>
          <Button onClick={() => navigate("/skill-assessment")}>
            Back to Assessments
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredCount = answers.size;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {assessment.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {answeredCount} of {questions.length} answered
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 px-4 py-2 bg-primary/10 rounded-lg">
                <Clock className="w-5 h-5 text-primary" />
                <span className="font-mono font-semibold text-foreground">
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Question */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <QuestionCard
          question={currentQuestion}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={questions.length}
          selectedAnswer={answers.get(currentQuestion.id) ?? null}
          onSelectAnswer={handleSelectAnswer}
        />

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="rounded-xl"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          {currentQuestionIndex === questions.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={answeredCount < questions.length}
              className="rounded-xl"
            >
              <Check className="w-4 h-4 mr-2" />
              Submit Assessment
            </Button>
          ) : (
            <Button onClick={handleNext} className="rounded-xl">
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>

        {/* Question Grid */}
        <div className="mt-8 p-4 sm:p-6 bg-muted/50 rounded-xl">
          <p className="text-sm font-medium text-foreground mb-4">
            Question Navigation
          </p>
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(index)}
                className={cn(
                  "aspect-square rounded-lg text-xs sm:text-sm font-medium transition-all",
                  currentQuestionIndex === index
                    ? "bg-primary text-primary-foreground"
                    : answers.has(q.id)
                    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TakeAssessment;
