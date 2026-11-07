import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { SITE_CONFIG } from "@/config/siteConfig";
import { shareText as shareNativeText } from "@/utils/openExternalShareUrl";

interface ShareReviewButtonProps {
  reviewId: string;
  userName: string;
  rating: number;
  reviewText?: string | null;
}

export const ShareReviewButton = ({ userName, rating, reviewText }: ShareReviewButtonProps) => {
  const handleShare = async () => {
    const shareText = `Check out this ${rating}-star review on Workly India App!\n\n${userName} says: "${reviewText || "Great app!"}"\n\nDownload: ${SITE_CONFIG.PRODUCTION_DOMAIN}`;

    try {
      const shared = await shareNativeText(
        `${rating}-star Review - Workly India`,
        shareText,
        SITE_CONFIG.PRODUCTION_DOMAIN
      );
      if (shared) {
        toast({
          title: "Share sheet opened",
          description: "Choose WhatsApp, Messages or another app to share this review"
        });
      } else {
        // Fallback for browsers without a share target.
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "Review link copied!",
          description: "Share link has been copied to clipboard"
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      // Silent fail for user cancellation
    }
  };

  return (
    <Button 
      size="icon" 
      variant="ghost" 
      className="rounded-xl h-8 w-8"
      onClick={handleShare}
    >
      <Share2 className="w-4 h-4" />
    </Button>
  );
};
