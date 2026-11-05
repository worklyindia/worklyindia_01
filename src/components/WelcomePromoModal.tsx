import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, ChevronDown } from "lucide-react";
import { useBrandAssets } from "@/hooks/useBrandAssets";

interface WelcomePromoModalProps {
  isLoggedIn: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

const WelcomePromoModal = ({ isLoggedIn, isOpen: externalIsOpen, onClose }: WelcomePromoModalProps) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const navigate = useNavigate();
  const brandAssets = useBrandAssets();

  const logoUrl = brandAssets.logo_url;
  const brandName = brandAssets.brand_name || 'Workly India';

  // Use external control if provided, otherwise use internal state
  const isModalOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  useEffect(() => {
    // Skip auto-show if externally controlled
    if (externalIsOpen !== undefined) return;

    if (isLoggedIn) {
      setInternalIsOpen(false);
      return;
    }

    // Check if modal was dismissed recently (within 24 hours)
    const dismissedAt = localStorage.getItem("welcomeModalDismissedAt");
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        return;
      }
    }

    // Show modal after a short delay
    // Open only after the visitor interacts (or 8s), so the sheet never covers first paint.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
    const arm = () => {
      events.forEach((e) => window.removeEventListener(e, arm));
      if (!timer) timer = setTimeout(() => setInternalIsOpen(true), 1500);
    };
    events.forEach((e) => window.addEventListener(e, arm, { once: true, passive: true }));
    const fallback = setTimeout(() => setInternalIsOpen(true), 8000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, arm));
      if (timer) clearTimeout(timer);
      clearTimeout(fallback);
    };
  }, [isLoggedIn, externalIsOpen]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
    localStorage.setItem("welcomeModalDismissedAt", Date.now().toString());
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    }
  };

  const handleJobSeeker = () => {
    // Navigate first so the destination page's Quick Login banner can mount cleanly.
    // Then close the sheet on the next tick to avoid Radix body-scroll-lock
    // lingering and blocking the new Sheet from showing.
    navigate("/auth");
    setTimeout(() => handleClose(), 0);
  };

  const handleEmployer = () => {
    navigate("/employer-auth");
    setTimeout(() => handleClose(), 0);
  };

  return (
    <Sheet open={isModalOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-h-[90vh] overflow-y-auto border-t-0 px-6 pb-8 pt-4 [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Welcome to {brandName} — choose whether to find a job or hire people</SheetTitle>
        {/* Close - chevron-down, matching the Quick Login sheet.
            Wrapped in a div so [&>button]:hidden (which targets the default
            Radix close button) does not hide this one too. */}
        <div className="absolute right-4 top-4 z-10">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all"
          >
            <ChevronDown className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        {/* Drag Handle - swipe down to close */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        <div className="text-center">
          {/* Title */}
          <h2 className="text-xl font-bold text-foreground mb-2">
            Welcome To {brandName.toUpperCase()} 🇮🇳
          </h2>

          {/* Subtitle */}
          <p className="text-sm text-muted-foreground mb-6">
            Welcome to {brandName}! 🌟 Your journey to flexible work starts here 🏠💼
          </p>

          {/* Logo Section - Dynamic from useBrandAssets */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="w-24 h-24 mb-3 flex items-center justify-center">
              {brandAssets.isLoading || !logoUrl ? (
                <div className="w-20 h-20 rounded-xl bg-muted animate-pulse" />
              ) : (
                <img loading="lazy" decoding="async" 
                  src={logoUrl} 
                  alt={brandName}
                  className="w-20 h-20 object-contain rounded-xl"
                />
              )}
            </div>
            <h2 className="text-2xl font-bold text-primary">{brandName.toUpperCase()}</h2>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleJobSeeker}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Briefcase className="w-5 h-5 mr-2" />
              I Want a Job
            </Button>

            <Button
              onClick={handleEmployer}
              variant="outline"
              className="w-full h-12 text-base font-semibold border-2 border-primary text-primary hover:bg-primary/5"
            >
              <Users className="w-5 h-5 mr-2" />
              I Want To Hire People
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WelcomePromoModal;
