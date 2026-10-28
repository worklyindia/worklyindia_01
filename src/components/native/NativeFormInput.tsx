import { forwardRef, InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface NativeFormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  helper?: string;
  error?: string;
}

export const NativeFormInput = forwardRef<HTMLInputElement, NativeFormInputProps>(
  ({ label, icon: Icon, helper, error, className, onFocus, ...props }, ref) => {
    const { isIOS, isAndroid } = usePlatformStyle();
    const { tapFeedback } = useNativeFeel();

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      tapFeedback();
      onFocus?.(e);
    };

    return (
      <div className="space-y-2">
        <Label htmlFor={props.id} className="flex items-center gap-2 text-sm font-medium">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
          {label}
        </Label>
        <Input
          ref={ref}
          className={cn(
            "transition-all",
            isIOS && "h-12 rounded-xl bg-muted/30 border-0 focus:bg-background",
            isAndroid && "h-14 rounded-lg border-2 focus:border-primary",
            error && "border-destructive focus:border-destructive",
            className
          )}
          onFocus={handleFocus}
          {...props}
        />
        {helper && !error && (
          <p className="text-xs text-muted-foreground">{helper}</p>
        )}
        {error && (
          <p className="text-xs text-destructive font-medium">{error}</p>
        )}
      </div>
    );
  }
);

NativeFormInput.displayName = 'NativeFormInput';
