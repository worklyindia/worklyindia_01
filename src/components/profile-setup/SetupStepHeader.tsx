import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SetupStepHeaderProps {
  title: string;
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
}

/**
 * Resume-builder style step header: back arrow, "Step X of N",
 * title, percent and a gradient progress bar.
 */
const SetupStepHeader: React.FC<SetupStepHeaderProps> = ({
  title,
  currentStep,
  totalSteps,
  onBack,
}) => {
  const percent = Math.round((currentStep / totalSteps) * 100);

  return (
    <header
      className="sticky top-0 z-50 shrink-0 border-b bg-background/95 backdrop-blur px-3 sm:px-4 pt-3 pb-3"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full -ml-2"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-muted-foreground leading-tight">
              Step {currentStep} of {totalSteps}
            </div>
            <div className="text-sm font-semibold leading-tight truncate">{title}</div>
          </div>
          <div className="text-xs font-semibold text-primary">{percent}%</div>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </header>
  );
};

export default SetupStepHeader;
