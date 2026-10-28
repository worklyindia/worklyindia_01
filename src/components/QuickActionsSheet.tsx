import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Search, Briefcase, User, LogIn, Bell, Heart, Clock, MapPin, MessageCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface QuickActionsSheetProps {
  open: boolean;
  onClose: () => void;
  onLocationFilterClick?: () => void;
  onAIChatClick?: () => void;
}

export const QuickActionsSheet = ({ open, onClose, onLocationFilterClick, onAIChatClick }: QuickActionsSheetProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Check if we're on Jobs page "For You" tab
  const isForYouTab = location.pathname === '/jobs' || location.pathname === '/';

  const handleAction = (path: string) => {
    navigate(path);
    onClose();
  };

  type ActionItem = {
    icon: any;
    label: string;
    description: string;
    path: string;
    color: string;
    action?: (() => void) | null;
  };

  const quickActions: ActionItem[] = [
    {
      icon: MessageCircle,
      label: "AI Career Chat",
      description: "Get career guidance & job help",
      path: "/ai-assistant?audience=job_seeker",
      color: "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700",
      action: null,
    },
    {
      icon: User,
      label: "Resume",
      description: "View and manage your resume",
      path: "/resume-builder",
      color: "bg-orange-500 hover:bg-orange-600",
      action: null,
    },
  ];

  // Add location filter option if on For You tab and callback provided
  const actions: ActionItem[] = [...quickActions];
  
  if (isForYouTab && onLocationFilterClick) {
    actions.splice(1, 0, {
      icon: MapPin,
      label: "Location Filter",
      description: "Filter jobs by location",
      path: "",
      color: "bg-indigo-500 hover:bg-indigo-600",
      action: onLocationFilterClick,
    });
  }

  const handleActionClick = (action: ActionItem) => {
    if (action.action) {
      // If it's a custom action (like location filter), execute it
      action.action();
      onClose();
    } else {
      // Navigate to path
      handleAction(action.path);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent 
        side="bottom" 
        className="h-auto max-h-[75vh] overflow-y-auto rounded-t-3xl p-6 pb-10 [&>button]:hidden"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-bold">Quick Actions</SheetTitle>
        </SheetHeader>
        
        <div className="grid grid-cols-1 gap-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              onClick={() => handleActionClick(action)}
              variant="outline"
              className="h-auto p-4 flex items-start gap-4 hover:border-primary hover:bg-primary/5 transition-all duration-200 border-2"
            >
              <div className={`${action.color} text-white p-3 rounded-lg flex-shrink-0 shadow-md`}>
                <action.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-foreground">{action.label}</div>
                <div className="text-sm text-muted-foreground">{action.description}</div>
              </div>
            </Button>
          ))}
        </div>

      </SheetContent>
    </Sheet>
  );
};
