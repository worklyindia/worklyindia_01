import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { QuickActionsSheet } from "@/components/QuickActionsSheet";

interface FloatingActionButtonProps {
  onLocationFilterClick?: () => void;
  onAIChatClick?: () => void;
}

const FloatingActionButton = ({ onLocationFilterClick, onAIChatClick }: FloatingActionButtonProps = {}) => {
  const [showQuickActions, setShowQuickActions] = useState(false);

  return (
    <>
      <div className="fixed bottom-24 right-4 z-40 md:bottom-20">
        {/* AI FAB */}
        <Button
          onClick={() => setShowQuickActions(true)}
          className="w-14 h-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-110 active:scale-95"
        >
          <Plus className="w-6 h-6 text-white" />
        </Button>
      </div>

      {/* Quick Actions Sheet */}
      <QuickActionsSheet 
        open={showQuickActions} 
        onClose={() => setShowQuickActions(false)}
        onLocationFilterClick={onLocationFilterClick}
        onAIChatClick={onAIChatClick}
      />
    </>
  );
};

export default FloatingActionButton;
