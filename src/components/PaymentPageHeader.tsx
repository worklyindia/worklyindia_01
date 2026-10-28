import { ArrowLeft } from "lucide-react";
import { SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface PaymentPageHeaderProps {
  onBack: () => void;
  title?: string;
  subtitle?: string;
}

/**
 * Sticky mobile-style header for full-page payment / plan screens.
 * Use inside a full-page SheetContent or DialogContent (both use Radix Dialog titles).
 */
export const PaymentPageHeader = ({ onBack, title = "Payment", subtitle }: PaymentPageHeaderProps) => (
  <div className="payment-page-header sticky top-0 z-10 -mx-5 mb-1 flex w-[calc(100%+2.5rem)] max-w-none shrink-0 items-center gap-3 border-b border-border bg-background/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-background/80">
    <button
      type="button"
      onClick={onBack}
      aria-label="Back"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
    <div className="min-w-0 flex-1">
      <SheetTitle className="truncate text-lg font-semibold text-foreground">{title}</SheetTitle>
      {subtitle ? (
        <SheetDescription className="truncate text-xs text-muted-foreground">{subtitle}</SheetDescription>
      ) : (
        <SheetDescription className="sr-only">{title}</SheetDescription>
      )}
    </div>
  </div>
);
