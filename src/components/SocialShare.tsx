import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Share2, Facebook, Twitter, Linkedin, Instagram, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { copyText, openExternalShareUrl } from "@/utils/openExternalShareUrl";

interface SocialShareProps {
  url?: string;
  title?: string;
  description?: string;
  variant?: "default" | "small" | "floating";
  className?: string;
}

const SocialShare = ({ 
  url = window.location.href, 
  title = "Workly India - Remote Jobs", 
  description = "Find the best Workly India opportunities in India. Join thousands of professionals working from home.",
  variant = "default",
  className = ""
}: SocialShareProps) => {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    openExternalShareUrl(shareLinks[platform]);
    setIsOpen(false);
    
    // Track sharing for off-page SEO analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'share', {
        method: platform,
        content_type: 'job_portal',
        item_id: url
      });
    }
  };

  const copyToClipboard = async () => {
    try {
      const copiedSuccessfully = await copyText(url);
      if (!copiedSuccessfully) throw new Error("Clipboard unavailable");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const buttonVariants = {
    default: "w-full",
    small: "p-2",
    floating: "fab"
  };

  const iconSize = variant === "small" ? "w-4 h-4" : "w-5 h-5";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={variant === "floating" ? "default" : "outline"} 
          className={`${buttonVariants[variant]} ${className}`}
        >
          <Share2 className={iconSize} />
          {variant !== "small" && variant !== "floating" && <span className="ml-2">Share</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Share Workly India</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="flex items-center space-x-2 h-12"
              onClick={() => handleShare('facebook')}
            >
              <Facebook className="w-5 h-5 text-blue-600" />
              <span>Facebook</span>
            </Button>
            <Button
              variant="outline"
              className="flex items-center space-x-2 h-12"
              onClick={() => handleShare('twitter')}
            >
              <Twitter className="w-5 h-5 text-blue-400" />
              <span>Twitter</span>
            </Button>
            <Button
              variant="outline"
              className="flex items-center space-x-2 h-12"
              onClick={() => handleShare('linkedin')}
            >
              <Linkedin className="w-5 h-5 text-blue-700" />
              <span>LinkedIn</span>
            </Button>
            <Button
              variant="outline"
              className="flex items-center space-x-2 h-12"
              onClick={() => handleShare('whatsapp')}
            >
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">W</span>
              </div>
              <span>WhatsApp</span>
            </Button>
          </div>
          
          <div className="border-t pt-4">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={url}
                readOnly
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-muted/50"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="flex items-center space-x-2"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>{copied ? "Copied" : "Copy"}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SocialShare;