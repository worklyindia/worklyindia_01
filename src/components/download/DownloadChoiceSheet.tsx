import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Sparkles, FileDown, ChevronRight } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  docLabel: string; // "Resume" | "Cover Letter"
  onPickAI: () => void;
  onPickDownload: () => void;
};

export const DownloadChoiceSheet: React.FC<Props> = ({ open, onOpenChange, docLabel, onPickAI, onPickDownload }) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle>Download {docLabel}</SheetTitle>
          <SheetDescription>Choose how you want to get your {docLabel.toLowerCase()}.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={onPickAI}
            className="w-full flex items-center gap-3 rounded-2xl border bg-card p-4 text-left hover:bg-muted transition"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">AI</div>
              <div className="text-xs text-muted-foreground">Designer-quality image made by AI</div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>

          <button
            type="button"
            onClick={onPickDownload}
            className="w-full flex items-center gap-3 rounded-2xl border bg-card p-4 text-left hover:bg-muted transition"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileDown className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Download</div>
              <div className="text-xs text-muted-foreground">PDF, DOCX, Copy Text, or Print</div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DownloadChoiceSheet;
