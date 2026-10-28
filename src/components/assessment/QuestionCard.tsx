import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AssessmentQuestion } from "@/types/assessment";

interface QuestionCardProps {
  question: AssessmentQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: number | null;
  onSelectAnswer: (index: number) => void;
  showExplanation?: boolean;
}

export const QuestionCard = ({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer,
  showExplanation = false,
}: QuestionCardProps) => {
  return (
    <Card className="p-8">
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground mb-2">
              Question {questionNumber} of {totalQuestions}
            </div>
            <h3 className="text-lg font-semibold text-foreground whitespace-pre-wrap">
              {question.question_text}
            </h3>
          </div>
        </div>

        <div className="space-y-3">
          {question.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = index === question.correct_answer_index;
            const showCorrectness = showExplanation;

            return (
              <Button
                key={index}
                variant="outline"
                className={cn(
                  "w-full justify-start text-left p-4 h-auto min-h-[60px] rounded-xl transition-all",
                  isSelected && !showCorrectness && "border-primary bg-primary/5",
                  showCorrectness && isCorrect && "border-green-500 bg-green-50 dark:bg-green-950",
                  showCorrectness &&
                    isSelected &&
                    !isCorrect &&
                    "border-red-500 bg-red-50 dark:bg-red-950"
                )}
                onClick={() => !showExplanation && onSelectAnswer(index)}
                disabled={showExplanation}
              >
                <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium mr-3 shrink-0">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="flex-1 whitespace-normal break-words text-sm sm:text-base">
                  {option.text}
                </span>
              </Button>
            );
          })}
        </div>

        {showExplanation && question.explanation && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium text-foreground mb-2">
              Explanation:
            </p>
            <p className="text-sm text-muted-foreground">
              {question.explanation}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
