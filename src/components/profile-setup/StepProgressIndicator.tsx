import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  onStepClick?: (step: number) => void;
}

const StepProgressIndicator: React.FC<StepProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  onStepClick
}) => {
  return (
    <div className="flex justify-center items-center gap-2 py-4">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step, index) => {
        const isCompleted = step < currentStep;
        const isActive = step === currentStep;
        const isUpcoming = step > currentStep;

        return (
          <React.Fragment key={step}>
            {/* Connecting line before (except first) */}
            {index > 0 && (
              <div 
                className={cn(
                  "h-0.5 w-6 sm:w-8 transition-all duration-300",
                  step <= currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            )}
            
            {/* Step Circle */}
            <button
              onClick={() => onStepClick?.(step)}
              disabled={isUpcoming}
              className={cn(
                "relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-sm font-semibold transition-all duration-300",
                isCompleted && "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
                isActive && "bg-gradient-to-br from-primary to-secondary text-primary-foreground ring-4 ring-primary/20 shadow-xl shadow-primary/40 scale-110",
                isUpcoming && "bg-muted text-muted-foreground border-2 border-muted-foreground/30",
                !isUpcoming && "cursor-pointer hover:scale-105"
              )}
            >
              {isCompleted ? (
                <Check className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <span>{step}</span>
              )}
              
              {/* Active step glow effect */}
              {isActive && (
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default StepProgressIndicator;
