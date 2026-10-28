import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface Props {
  onPrev: () => void;
  onNext: () => void;
  onSkip?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  optional?: boolean;
  nextLabel?: string;
  disabled?: boolean;
  hideNext?: boolean;
}

const StepNav: React.FC<Props> = ({ onPrev, onNext, isFirst, isLast, nextLabel, disabled, hideNext }) => (
  <div className="flex items-center gap-2 w-full">
    {!isFirst && (
      <Button
        type="button"
        variant="outline"
        onClick={onPrev}
        disabled={isFirst}
        className={`rounded-xl ${isLast || hideNext ? 'flex-1' : 'flex-1'}`}
        aria-label="Previous step"
      >
        <ArrowLeft className="w-4 h-4 sm:mr-1" />
        <span>Previous</span>
      </Button>
    )}
    {!hideNext && (
      <Button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className={`rounded-xl ${isFirst ? 'w-full' : 'flex-1'}`}
      >
        {nextLabel || (isLast ? 'Finish' : 'Next')}
        {isLast ? <Check className="w-4 h-4 ml-1" /> : <ArrowRight className="w-4 h-4 ml-1" />}
      </Button>
    )}
  </div>
);

export default StepNav;
