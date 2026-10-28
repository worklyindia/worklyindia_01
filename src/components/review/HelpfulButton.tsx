import { ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReviewHelpful } from "@/hooks/useReviewHelpful";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface HelpfulButtonProps {
  reviewId: string;
  helpfulCount: number;
  className?: string;
}

export const HelpfulButton = ({ reviewId, helpfulCount, className }: HelpfulButtonProps) => {
  const { isHelpful, loading, toggleHelpful } = useReviewHelpful(reviewId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const result = await toggleHelpful();
    
    if (result.needsAuth) {
      toast({
        title: "Login required",
        description: "Please login to mark reviews as helpful",
        variant: "destructive"
      });
      return;
    }

    if (!result.success) {
      toast({
        title: "Error",
        description: "Failed to update helpful status",
        variant: "destructive"
      });
    } else {
      console.log('✅ Helpful toggled successfully');
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-1 transition-colors", className)}
      onClick={handleClick}
      disabled={loading}
    >
      <ThumbsUp 
        className={cn(
          "w-4 h-4 transition-all",
          isHelpful && "fill-primary text-primary"
        )} 
      />
      <span className={cn(isHelpful && "text-primary font-medium")}>
        Helpful ({helpfulCount})
      </span>
    </Button>
  );
};
