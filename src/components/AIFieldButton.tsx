import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AIFieldButtonProps {
  onClick: () => Promise<void>;
  tooltip?: string;
  className?: string;
  disabled?: boolean;
  disabledReason?: string;
  size?: "sm" | "default" | "lg" | "icon";
  // New: Show remaining credits
  remainingCredits?: number;
  isLimitReached?: boolean;
}

const AIFieldButton = ({ 
  onClick, 
  tooltip = "Generate with AI",
  className,
  disabled = false,
  disabledReason,
  size = "icon",
  remainingCredits,
  isLimitReached = false,
}: AIFieldButtonProps) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Determine if button should be disabled
  const isDisabled = disabled || isLimitReached || loading;

  const handleClick = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent touch event propagation to avoid page freeze on mobile
    e.stopPropagation();
    e.preventDefault();
    
    if (isDisabled) return;
    
    setLoading(true);
    setSuccess(false);
    
    try {
      await onClick();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error) {
      console.error("AI generation error:", error);
    } finally {
      setLoading(false);
    }
  }, [isDisabled, onClick]);

  // Build tooltip text
  let displayTooltip = tooltip;
  if (isLimitReached) {
    displayTooltip = "AI limit reached - Upgrade your plan";
  } else if (disabled && disabledReason) {
    displayTooltip = disabledReason;
  } else if (remainingCredits !== undefined && remainingCredits < 999999) {
    displayTooltip = `${tooltip} (${remainingCredits} credits left)`;
  }

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={size}
          onClick={handleClick}
          onTouchEnd={handleClick}
          disabled={isDisabled}
          className={cn(
            "relative h-8 w-8 p-0 transition-all duration-300 touch-manipulation",
            isDisabled
              ? "opacity-40 cursor-not-allowed hover:bg-transparent" 
              : "hover:bg-primary/10 hover:text-primary active:scale-95",
            success && "text-green-500 hover:text-green-500",
            className
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : isLimitReached ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : disabled ? (
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Sparkles 
              className={cn(
                "h-4 w-4 transition-all duration-300",
                success ? "text-green-500 scale-110" : "text-primary hover:scale-110"
              )} 
            />
          )}
          {/* Success ripple effect */}
          {success && (
            <span className="absolute inset-0 rounded-md animate-ping bg-green-500/20" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className={cn(
        isLimitReached ? "bg-destructive text-destructive-foreground" :
        disabled ? "bg-muted text-muted-foreground" : 
        "bg-primary text-primary-foreground"
      )}>
        <p className="text-xs font-medium">{displayTooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default AIFieldButton;
