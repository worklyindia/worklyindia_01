import { Button } from "@/components/ui/button";
import { Edit, Download, Settings } from "lucide-react";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import { usePlatformStyle } from "@/hooks/usePlatformStyle";

interface ProfileActionBarProps {
  onEditProfile: () => void;
  onDownloadCV: () => void;
  onSettings: () => void;
}

export const ProfileActionBar = ({ 
  onEditProfile, 
  onDownloadCV, 
  onSettings 
}: ProfileActionBarProps) => {
  const { tapFeedback } = useNativeFeel();
  const { isIOS, buttonClass } = usePlatformStyle();

  const handleAction = (action: () => void) => {
    tapFeedback();
    action();
  };

  return (
    <div className="px-4 py-3">
      <div className="flex gap-2">
        <Button 
          onClick={() => handleAction(onEditProfile)}
          className={`flex-1 h-11 bg-primary text-primary-foreground font-medium ${buttonClass} active:scale-95 transition-transform`}
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => handleAction(onDownloadCV)}
          className={`h-11 px-4 ${buttonClass} active:scale-95 transition-transform`}
        >
          <Download className="w-4 h-4" />
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => handleAction(onSettings)}
          className={`h-11 px-4 ${buttonClass} active:scale-95 transition-transform`}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
