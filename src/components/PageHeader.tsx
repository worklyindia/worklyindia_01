import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { goBack } from "@/lib/goBack";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  backTo?: string;
  onBack?: () => void;
  action?: ReactNode;
}

/**
 * Compact page header used on informational pages.
 * Shows a back arrow and the page name instead of the full website header.
 */
export const PageHeader = ({ title, backTo, onBack, action }: PageHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    // Return to the page the user came from; backTo is only the fallback for direct opens.
    goBack(navigate, backTo || "/");
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center gap-3 px-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleBack}
          aria-label="Go back"
          className="h-10 w-10 shrink-0 rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="truncate text-base font-semibold text-foreground">
          {title}
        </span>
        {action && <div className="ml-auto">{action}</div>}
      </div>
    </header>
  );
};

export default PageHeader;
