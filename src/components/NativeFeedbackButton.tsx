import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useNativeFeel } from '@/hooks/useNativeFeel';

interface NativeFeedbackButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  feedbackType?: 'tap' | 'success' | 'error';
}

export const NativeFeedbackButton = ({
  children,
  onClick,
  variant = 'default',
  size = 'default',
  className = '',
  disabled = false,
  type = 'button',
  feedbackType = 'tap',
}: NativeFeedbackButtonProps) => {
  const { tapFeedback, successFeedback, errorFeedback } = useNativeFeel();

  const handleClick = () => {
    if (feedbackType === 'success') {
      successFeedback();
    } else if (feedbackType === 'error') {
      errorFeedback();
    } else {
      tapFeedback();
    }
    onClick?.();
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={`active:scale-95 transition-transform ${className}`}
      onClick={handleClick}
      disabled={disabled}
      type={type}
    >
      {children}
    </Button>
  );
};
