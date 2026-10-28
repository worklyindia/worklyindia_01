import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Award } from "lucide-react";
import type { SkillAssessment } from "@/types/assessment";

interface AssessmentCardProps {
  assessment: SkillAssessment;
  onStart: (assessment: SkillAssessment) => void;
}

export const AssessmentCard = ({ assessment, onStart }: AssessmentCardProps) => {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "beginner":
        return "bg-green-100 text-green-800";
      case "intermediate":
        return "bg-yellow-100 text-yellow-800";
      case "advanced":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="p-6 hover:shadow-soft transition-shadow">
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
          <Badge
            variant="outline"
            className={getDifficultyColor(assessment.difficulty)}
          >
            {assessment.difficulty}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-muted-foreground">
            <Clock className="w-4 h-4 mr-1" />
            <span>{assessment.duration_minutes} mins</span>
          </div>
          <div className="flex items-center text-muted-foreground">
            <Award className="w-4 h-4 mr-1" />
            <span>{assessment.total_questions} questions</span>
          </div>
        </div>

        <Button
          className="w-full rounded-xl"
          onClick={() => onStart(assessment)}
        >
          <Play className="w-4 h-4 mr-2" />
          Start Assessment
        </Button>
      </div>
    </Card>
  );
};
