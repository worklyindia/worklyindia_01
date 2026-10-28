import { ReactNode } from 'react';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { cn } from '@/lib/utils';

interface NativeListItemProps {
  icon?: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string | ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  badge?: number;
}

export const NativeListItem = ({
  icon: Icon,
  iconColor = "text-primary",
  title,
  subtitle,
  value,
  onPress,
  showChevron = false,
  badge,
}: NativeListItemProps) => {
  const { tapFeedback } = useNativeFeel();
  const { isIOS, isAndroid } = usePlatformStyle();

  const handlePress = () => {
    if (onPress) {
      tapFeedback();
      onPress();
    }
  };

  const content = (
    <div
      className={cn(
        "flex items-center px-4 py-3.5 border-b border-border/30 last:border-b-0 transition-colors",
        onPress && (
          isIOS 
            ? "active:bg-muted/50 cursor-pointer" 
            : "active:bg-muted/70 cursor-pointer hover:bg-muted/40"
        )
      )}
    >
      {/* Icon */}
      {Icon && (
        <div className={cn(
          "rounded-lg flex items-center justify-center mr-3",
          isIOS ? "w-8 h-8 bg-primary/10" : "w-10 h-10 bg-primary/15"
        )}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn(
            "font-medium truncate",
            isIOS ? "text-sm" : "text-base"
          )}>
            {title}
          </p>
          {badge !== undefined && badge > 0 && (
            <span className="flex-shrink-0 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
        {value && typeof value === 'string' && (
          <span className="text-sm text-muted-foreground">{value}</span>
        )}
        {value && typeof value !== 'string' && value}
        {showChevron && (
          <ChevronRight className={cn(
            "text-muted-foreground/50",
            isIOS ? "w-5 h-5" : "w-6 h-6"
          )} />
        )}
      </div>
    </div>
  );

  if (onPress) {
    return <button onClick={handlePress} className="w-full text-left">{content}</button>;
  }

  return content;
};
