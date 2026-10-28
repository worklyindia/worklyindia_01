import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, Facebook, Twitter, Check, ArrowRight, BriefcaseBusiness, X } from 'lucide-react';
import { useShareTracking } from '@/hooks/useShareTracking';
import { SITE_CONFIG } from '@/config/siteConfig';
import confetti from 'canvas-confetti';

interface ApplicationSuccessShareProps {
  isOpen: boolean;
  onClose: () => void;
  jobTitle: string;
  companyName: string;
  jobId: string;
  shortId?: string;
  publicSlug?: string;
}

const ApplicationSuccessShare = ({
  isOpen, onClose, jobTitle, companyName, jobId, shortId, publicSlug,
}: ApplicationSuccessShareProps) => {
  const { trackShare } = useShareTracking();

  useEffect(() => {
    if (!isOpen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    confetti({ particleCount: 65, spread: 65, origin: { y: 0.55 }, disableForReducedMotion: true });
  }, [isOpen]);

  const jobUrl = SITE_CONFIG.getJobShareUrl({ short_id: shortId, public_slug: publicSlug, id: jobId });
  const shareMessage = `I just applied for ${jobTitle} at ${companyName} on Workly India!\n\nCheck out this opportunity: ${jobUrl}`;

  const handleShare = (platform: 'whatsapp' | 'facebook' | 'twitter') => {
    const urls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareMessage)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`,
    };
    window.open(urls[platform], '_blank', 'noopener,noreferrer,width=600,height=600');
    void trackShare('job', platform, jobId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent hideClose className="w-[calc(100%-2rem)] max-w-md max-h-[90dvh] overflow-y-auto rounded-lg gap-0 p-0">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close confirmation" className="absolute right-3 top-3 h-9 w-9 text-muted-foreground">
          <X />
        </Button>

        <DialogHeader className="items-center px-6 pt-9 pb-6 text-center sm:text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-success/20 bg-success/10 ring-8 ring-success/5">
            <Check className="h-9 w-9 text-success" strokeWidth={2.5} aria-hidden="true" />
          </div>
          <p className="pb-2 text-xs font-semibold uppercase tracking-widest text-success">Successfully sent</p>
          <DialogTitle className="text-2xl font-bold leading-tight tracking-normal">Application submitted!</DialogTitle>
          <DialogDescription className="pt-2 text-sm leading-relaxed">You've taken the next step in your career.</DialogDescription>
        </DialogHeader>

        <div className="mx-6 flex min-w-0 items-start gap-3 border-y border-border py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
            <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 self-center">
            <h3 className="break-words text-base font-semibold leading-snug">{jobTitle}</h3>
            <p className="mt-1 break-words text-sm text-muted-foreground">{companyName}</p>
          </div>
        </div>

        <div className="px-6 py-5">
          <h4 className="text-sm font-semibold">What happens next?</h4>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">The employer can review your application and contact you if your profile is a match.</p>
          <Button onClick={onClose} className="mt-5 h-12 w-full">Continue browsing <ArrowRight aria-hidden="true" /></Button>
        </div>

        <div className="border-t border-border bg-muted/30 px-6 py-5">
          <p className="text-center text-sm font-medium">Know someone who'd love this role?</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => handleShare('whatsapp')} className="h-16 min-w-0 flex-col gap-1 px-1 text-xs"><MessageCircle className="text-success" aria-hidden="true" />WhatsApp</Button>
            <Button variant="outline" onClick={() => handleShare('facebook')} className="h-16 min-w-0 flex-col gap-1 px-1 text-xs"><Facebook className="text-primary" aria-hidden="true" />Facebook</Button>
            <Button variant="outline" onClick={() => handleShare('twitter')} className="h-16 min-w-0 flex-col gap-1 px-1 text-xs"><Twitter className="text-foreground" aria-hidden="true" />Twitter / X</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApplicationSuccessShare;
