import { Briefcase, Calendar, Building2, Edit } from "lucide-react";
import { ProfileSection } from "./ProfileSection";
import { Button } from "@/components/ui/button";
import { useNativeFeel } from "@/hooks/useNativeFeel";

interface Experience {
  id: string;
  position: string;
  company: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  experience_years?: number;
  description?: string;
}

interface ProfileExperienceSectionProps {
  experiences: Experience[];
  loading: boolean;
  onEditPress: () => void;
}

export const ProfileExperienceSection = ({ 
  experiences, 
  loading, 
  onEditPress 
}: ProfileExperienceSectionProps) => {
  const { tapFeedback } = useNativeFeel();

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <ProfileSection title="Work Experience" icon={Briefcase}>
        <div className="px-4 py-8 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      </ProfileSection>
    );
  }

  if (!experiences || experiences.length === 0) {
    return (
      <ProfileSection title="Work Experience" icon={Briefcase}>
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">No work experience added yet</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { tapFeedback(); onEditPress(); }}
            className="active:scale-95 transition-transform"
          >
            <Edit className="w-4 h-4 mr-2" />
            Add Experience
          </Button>
        </div>
      </ProfileSection>
    );
  }

  return (
    <ProfileSection title="Work Experience" icon={Briefcase}>
      <div className="divide-y divide-border/50">
        {experiences.map((exp) => (
          <div key={exp.id} className="px-4 py-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground">{exp.position}</h4>
                <p className="text-sm text-primary font-medium">{exp.company}</p>
                
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {formatDate(exp.start_date)} - {exp.is_current ? 'Present' : formatDate(exp.end_date)}
                  </span>
                  {exp.experience_years && (
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">
                      {exp.experience_years}y
                    </span>
                  )}
                </div>
                
                {exp.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {exp.description}
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
