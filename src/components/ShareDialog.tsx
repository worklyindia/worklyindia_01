import { useState } from "react";
import { Share2, MessageCircle, Facebook, Twitter, ChevronDown, Linkedin, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useShareTracking, SharePlatform } from "@/hooks/useShareTracking";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  formatWhatsAppShare, 
  formatTwitterShare,
  formatFacebookShare,
  formatCopyShare,
  getPlatformShareUrl 
} from "@/utils/platformShareFormatters";
import { getJobShareUrl, getExternalJobShareUrl } from "@/config/domainConfig";
import { useShortExternalJobUrl } from "@/hooks/useShortExternalJobUrl";

interface ShareDialogProps {
  jobTitle: string;
  company: string;
  jobId: string;
  shortId?: string;
  publicSlug?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  city?: string;
  state?: string;
  location?: string;
  job_type?: string;
  experience_level?: string;
  category?: string;
  onShare?: () => void;
  children?: React.ReactNode;
  /** When true, `externalJob` is used to build a self-contained /ej share URL
   *  so recipients without sessionStorage can still open the job. */
  isExternal?: boolean;
  externalJob?: Parameters<typeof getExternalJobShareUrl>[0];
}

const ShareDialog = ({ 
  jobTitle, 
  company, 
  jobId, 
  shortId, 
  publicSlug,
  salary_min,
  salary_max,
  salary_currency,
  salary_period,
  city,
  state,
  location,
  job_type,
  experience_level,
  category,
  onShare, 
  children 
  , isExternal
  , externalJob
}: ShareDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { trackShare } = useShareTracking();
  
  // Create job data object for formatters
  const jobData = {
    id: jobId,
    title: jobTitle,
    company_name: company,
    short_id: shortId,
    public_slug: publicSlug,
    salary_min,
    salary_max,
    salary_currency,
    salary_period,
    city,
    state,
    location,
    job_type,
    experience_level,
    category,
  };
  
  // Get referral code from user
  const referralCode = user?.id ? user.id.slice(0, 8) : undefined;
  
  // For external jobs, resolve a compact `/ej/s/:shortId` URL via the shorten
  // edge function once the share sheet opens. Falls back to the long
  // self-hydrating URL until the round-trip completes.
  const shortExternalBase = useShortExternalJobUrl(externalJob, !!(isExternal && externalJob && isOpen));

  // Get base job URL for copy
  const jobUrl = isExternal && externalJob
    ? shortExternalBase + (referralCode ? `${shortExternalBase.includes('?') ? '&' : '?'}ref=${referralCode}` : '')
    : getJobShareUrl(jobData) + (referralCode ? `?ref=${referralCode}` : '');

  const shareOptions = [
    {
      name: "WhatsApp",
      platform: "whatsapp" as SharePlatform,
      icon: MessageCircle,
      color: "text-white",
      bgColor: "bg-green-500 hover:bg-green-600",
      getUrl: () => isExternal
        ? `https://wa.me/?text=${encodeURIComponent(`${jobTitle} at ${company}\n\n${jobUrl}`)}`
        : getPlatformShareUrl('whatsapp', jobData, referralCode),
    },
    {
      name: "Facebook",
      platform: "facebook" as SharePlatform,
      icon: Facebook,
      color: "text-white",
      bgColor: "bg-blue-600 hover:bg-blue-700",
      getUrl: () => isExternal
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`
        : getPlatformShareUrl('facebook', jobData, referralCode),
    },
    {
      name: "Twitter",
      platform: "twitter" as SharePlatform,
      icon: Twitter,
      color: "text-white",
      bgColor: "bg-sky-500 hover:bg-sky-600",
      getUrl: () => isExternal
        ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${jobTitle} at ${company}`)}&url=${encodeURIComponent(jobUrl)}`
        : getPlatformShareUrl('twitter', jobData, referralCode),
    },
    {
      name: "LinkedIn",
      platform: "linkedin" as SharePlatform,
      icon: Linkedin,
      color: "text-white",
      bgColor: "bg-blue-700 hover:bg-blue-800",
      getUrl: () => isExternal
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`
        : getPlatformShareUrl('linkedin', jobData, referralCode),
    }
  ];

  const handleShare = async (option: typeof shareOptions[0]) => {
    // Track the share in database
    await trackShare('job', option.platform, jobId);
    
    // Call the onShare callback if provided
    onShare?.();
    
    const url = option.getUrl();
    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
    setIsOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      // Copy formatted message for better sharing. External jobs must copy the
      // self-contained /ej URL, not the internal /job/:id path (which would
      // 404 for the recipient).
      const copyText = isExternal
        ? `${jobTitle} at ${company}\n\n${jobUrl}`
        : formatCopyShare(jobData, referralCode);
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      
      // Track copy as a share
      await trackShare('job', 'copy', jobId);
      
      toast.success("Job details copied with your referral code!");
      
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary w-8 h-8">
            <Share2 className="w-4 h-4" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl p-6 max-h-[90vh] [&>button]:hidden">
        <SheetHeader>
          <div className="flex items-start justify-between mb-4">
            <div>
              <SheetTitle className="text-left text-lg font-medium">Share Job</SheetTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {user ? "Your referral code is included!" : "Share with friends to help them find jobs"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 -mr-2"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>
        
        {/* Copy Link Button */}
        <Button
          variant="outline"
          className="w-full mb-4 flex items-center justify-center gap-2"
          onClick={handleCopyLink}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-500" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Link{user ? " with Referral Code" : ""}</span>
            </>
          )}
        </Button>
        
        <div className="grid grid-cols-2 gap-3">
          {shareOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Button
                key={option.name}
                className={`flex items-center justify-center space-x-2 p-4 h-auto ${option.bgColor} border-0`}
                onClick={() => handleShare(option)}
              >
                <Icon className={`w-5 h-5 ${option.color}`} />
                <span className="font-medium text-white">{option.name}</span>
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ShareDialog;