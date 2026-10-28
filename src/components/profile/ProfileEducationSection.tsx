import { GraduationCap, Calendar, School, Edit } from "lucide-react";
import { ProfileSection } from "./ProfileSection";
import { Button } from "@/components/ui/button";
import { useNativeFeel } from "@/hooks/useNativeFeel";

interface Education {
  id: string;
  degree: string;
  institution?: string;
  field_of_study?: string;
  start_year?: number;
  end_year?: number;
  grade?: string;
  description?: string;
}

interface ProfileEducationSectionProps {
  educationEntries: Education[];
  loading: boolean;
  onEditPress: () => void;
}

export const ProfileEducationSection = ({ 
  educationEntries, 
  loading, 
  onEditPress 
}: ProfileEducationSectionProps) => {
  const { tapFeedback } = useNativeFeel();

  if (loading) {
    return (
      <ProfileSection title="Education" icon={GraduationCap}>
        <div className="px-4 py-8 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      </ProfileSection>
    );
  }

  if (!educationEntries || educationEntries.length === 0) {
    return (
      <ProfileSection title="Education" icon={GraduationCap}>
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">No education added yet</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { tapFeedback(); onEditPress(); }}
            className="active:scale-95 transition-transform"
          >
            <Edit className="w-4 h-4 mr-2" />
            Add Education
          </Button>
        </div>
      </ProfileSection>
    );
  }

  return (
    <ProfileSection title="Education" icon={GraduationCap}>
      <div className="divide-y divide-border/50">
        {educationEntries.map((edu) => (
          <div key={edu.id} className="px-4 py-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                <School className="w-5 h-5 text-secondary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground">{edu.degree}</h4>
                {edu.institution && (
                  <p className="text-sm text-primary font-medium">{edu.institution}</p>
                )}
                
                <div className="flex items-center flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                  {edu.field_of_study && (
                    <span className="px-1.5 py-0.5 bg-muted rounded">{edu.field_of_study}</span>
                  )}
                  {(edu.start_year || edu.end_year) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {edu.start_year || 'Start'} - {edu.end_year || 'End'}
                    </span>
                  )}
                  {edu.grade && (
                    <span className="px-1.5 py-0.5 bg-success/10 text-success rounded">
                      {edu.grade}
                    </span>
                  )}
                </div>
                
                {edu.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {edu.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
};
