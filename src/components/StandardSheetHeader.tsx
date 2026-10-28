import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { BRAND_CONFIG } from "@/config/brandConfig";

interface StandardSheetHeaderProps {
  onClose: () => void;
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  /** If true, only shows brand logo and close button (no title) */
  minimal?: boolean;
}

export const StandardSheetHeader = ({ 
  title, 
  onClose,
  subtitle,
  badge,
  minimal = false
}: StandardSheetHeaderProps) => (
  <SheetHeader className={minimal ? "pb-0" : ""}>
    <div className={`flex items-center justify-between ${minimal ? "mb-2" : "mb-4"}`}>
      {/* Empty spacer for centering */}
      <div className="w-8" />
      
      {/* Centered Brand Name */}
      <div className="inline-flex items-center gap-2">
        <span className="text-2xl font-bold" style={{ color: BRAND_CONFIG.firstWordColor }}>{BRAND_CONFIG.firstName}</span>
        <span className="text-2xl font-bold" style={{ color: BRAND_CONFIG.secondWordColor }}>{BRAND_CONFIG.secondName}</span>
      </div>
      
      {/* Close button on right */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="h-8 w-8"
      >
        <ChevronDown className="h-5 w-5" />
      </Button>
    </div>
    {!minimal && title && (
      <div className="flex items-center justify-between mb-6">
        <SheetTitle className="text-left text-lg font-medium">
          {title}
        </SheetTitle>
        {badge}
      </div>
    )}
    {!minimal && subtitle && (
      <p className="text-sm text-muted-foreground text-left -mt-4 mb-4">
        {subtitle}
      </p>
    )}
  </SheetHeader>
);
