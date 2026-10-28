import { ReactNode } from 'react';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface NativeFormSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
}

export const NativeFormSection = ({
  title,
  description,
  icon: Icon,
  children,
}: NativeFormSectionProps) => {
  const { isIOS, isAndroid } = usePlatformStyle();

  return (
    <div className={cn(
      "space-y-4",
      isIOS && "bg-card rounded-2xl p-4 shadow-sm",
      isAndroid && "bg-card rounded-lg p-5 shadow-md"
    )}>
      {/* Section Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className={cn(
              "p-2 rounded-lg",
              isIOS ? "bg-primary/10" : "bg-primary/15"
            )}>
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
          <h3 className={cn(
            "font-semibold",
            isIOS ? "text-base" : "text-lg"
          )}>
            {title}
          </h3>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground pl-11">
            {description}
          </p>
        )}
      </div>

      {/* Section Content */}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};
