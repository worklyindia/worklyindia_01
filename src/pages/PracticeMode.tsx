import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuestionCard } from "@/components/assessment/QuestionCard";
import { useSkillAssessments } from "@/hooks/useSkillAssessments";
import { ChevronLeft, ChevronRight, RotateCcw, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const PracticeMode = () => {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();

  const { useAssessmentQuestions, useAssessmentsByCategory } = useSkillAssessments();

  const { data: questions, isLoading } = useAssessmentQuestions(assessmentId);
  const { data: assessments } = useAssessmentsByCategory();
  
  const assessment = assessments?.find((a) => a.id === assessmentId);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [showExplanation, setShowExplanation] = useState(false);

  const handleSelectAnswer = (index: number) => {
    if (!questions) return;
    const currentQuestion = questions[currentQuestionIndex];
    setAnswers(new Map(answers.set(currentQuestion.id, index)));
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (!questions) return;
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowExplanation(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setShowExplanation(!!answers.has(questions![currentQuestionIndex - 1].id));
    }
  };

  const handleReset = () => {
    setAnswers(new Map());
    setCurrentQuestionIndex(0);
    setShowExplanation(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading practice mode...</p>
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
  const correctCount = Array.from(answers.entries()).filter(
    ([qId, answerIdx]) => {
      const q = questions.find(qu => qu.id === qId);
      return q && q.correct_answer_index === answerIdx;
    }
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-foreground">
                  {assessment.title}
                </h1>
                <Badge variant="secondary">Practice Mode</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {answeredCount} of {questions.length} answered · {correctCount} correct
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="rounded-xl"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
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
          showExplanation={showExplanation}
        />

        {/* Answer Feedback */}
        {showExplanation && (
          <Card className="mt-6 p-6">
            <div className="flex items-start gap-4">
              {answers.get(currentQuestion.id) === currentQuestion.correct_answer_index ? (
                <div className="w-12 h-12 bg-green-100 dark:bg-green-950 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-red-100 dark:bg-red-950 rounded-full flex items-center justify-center shrink-0">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-2">
                  {answers.get(currentQuestion.id) === currentQuestion.correct_answer_index
                    ? "Correct!"
                    : "Incorrect"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {currentQuestion.explanation || "Keep practicing to improve your skills!"}
                </p>
              </div>
            </div>
          </Card>
        )}

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

          <Button
            onClick={handleNext}
            disabled={currentQuestionIndex === questions.length - 1}
            className="rounded-xl"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Question Grid */}
        <div className="mt-8 p-4 sm:p-6 bg-muted/50 rounded-xl">
          <p className="text-sm font-medium text-foreground mb-4">
            Question Navigation
          </p>
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {questions.map((q, index) => {
              const isAnswered = answers.has(q.id);
              const isCorrect = isAnswered && answers.get(q.id) === q.correct_answer_index;
              
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentQuestionIndex(index);
                    setShowExplanation(isAnswered);
                  }}
                  className={cn(
                    "aspect-square rounded-lg text-xs sm:text-sm font-medium transition-all",
                    currentQuestionIndex === index
                      ? "bg-primary text-primary-foreground"
                      : isAnswered && isCorrect
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100"
                      : isAnswered && !isCorrect
                      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats Card */}
        {answeredCount > 0 && (
          <Card className="mt-6 p-6">
            <h3 className="font-semibold text-foreground mb-4">Practice Stats</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{answeredCount}</div>
                <div className="text-xs text-muted-foreground">Attempted</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{correctCount}</div>
                <div className="text-xs text-muted-foreground">Correct</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">Accuracy</div>
              </div>
            </div>
          </Card>
        )}

        {/* Back Button */}
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={() => navigate("/skill-assessment")}
            className="rounded-xl"
          >
            Back to Assessments
          </Button>
        </div>
      </main>
    </div>
  );
};

export default PracticeMode;
