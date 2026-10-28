import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSkillAssessments } from "@/hooks/useSkillAssessments";
import { ArrowRight, Clock, Award } from "lucide-react";

interface AssessmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AssessmentDialog = ({ open, onOpenChange }: AssessmentDialogProps) => {
  const navigate = useNavigate();
  const { useCategories, useAssessmentsByCategory } = useSkillAssessments();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const { data: assessments, isLoading: assessmentsLoading } = useAssessmentsByCategory(selectedCategory);

  const handleStartAssessment = (assessmentId: string) => {
    onOpenChange(false);
    navigate(`/take-assessment/${assessmentId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose Your Skill Assessment</DialogTitle>
          <DialogDescription>
            Select a category and assessment to test your skills and earn certificates
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="all" onValueChange={(value) => setSelectedCategory(value === "all" ? undefined : value)}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            {categories?.slice(0, 3).map((category) => (
              <TabsTrigger key={category.id} value={category.id}>
                {category.title}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory || "all"} className="space-y-4 mt-4">
            {(categoriesLoading || assessmentsLoading) ? (
              <div className="text-center py-8 text-muted-foreground">Loading assessments...</div>
            ) : assessments && assessments.length > 0 ? (
              <div className="grid gap-4">
                {assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="border rounded-lg p-4 hover:shadow-soft transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground mb-1">{assessment.title}</h4>
                        <p className="text-sm text-muted-foreground mb-3">{assessment.description}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {assessment.duration_minutes} min
                          </Badge>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {assessment.difficulty}
                          </Badge>
                          <Badge variant="default" className="text-xs">
                            <Award className="w-3 h-3 mr-1" />
                            Pass: {assessment.passing_score}%
                          </Badge>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleStartAssessment(assessment.id)}
                        className="ml-4"
                      >
                        Start
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No assessments available in this category
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
