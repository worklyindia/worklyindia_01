import { User, Edit } from "lucide-react";
import { ProfileSection } from "./ProfileSection";
import { Button } from "@/components/ui/button";
import { useNativeFeel } from "@/hooks/useNativeFeel";

interface ProfileAboutSectionProps {
  bio?: string;
  onEditPress: () => void;
}

export const ProfileAboutSection = ({ bio, onEditPress }: ProfileAboutSectionProps) => {
  const { tapFeedback } = useNativeFeel();

  return (
    <ProfileSection title="About" icon={User}>
      {bio ? (
        <div className="px-4 py-4">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {bio}
          </p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { tapFeedback(); onEditPress(); }}
            className="mt-3 text-primary active:scale-95 transition-transform"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit About
          </Button>
        </div>
      ) : (
        <div className="px-4 py-6 text-center">
          <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Tell others about yourself! Share your professional story.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { tapFeedback(); onEditPress(); }}
            className="active:scale-95 transition-transform"
          >
            <Edit className="w-4 h-4 mr-2" />
            Write About
          </Button>
        </div>
      )}
    </ProfileSection>
  );
};
