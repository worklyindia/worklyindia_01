import { ReactNode } from "react";
import { ChevronRight, LucideIcon } from "lucide-react";
import { useNativeFeel } from "@/hooks/useNativeFeel";

interface ProfileSectionProps {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  onTitlePress?: () => void;
}

export const ProfileSection = ({ title, icon: Icon, children, onTitlePress }: ProfileSectionProps) => {
  return (
    <div className="mt-4">
      {/* Section Header - iOS Settings Style */}
      <div className="px-4 py-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" />}
          {title}
        </h3>
      </div>
      
      {/* Section Content - Native List Style */}
      <div className="bg-card mx-0">
        {children}
      </div>
    </div>
  );
};

interface ProfileListItemProps {
  icon?: LucideIcon;
  iconColor?: string;
  label: string;
  value?: string | ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
}

export const ProfileListItem = ({ 
  icon: Icon, 
  iconColor = "text-primary",
  label, 
  value, 
  onPress,
  showChevron = false,
  destructive = false
}: ProfileListItemProps) => {
  const { tapFeedback } = useNativeFeel();

  const handlePress = () => {
    if (onPress) {
      tapFeedback();
      onPress();
    }
  };

  const content = (
    <div className={`flex items-center px-4 py-3.5 border-b border-border/50 last:border-b-0 ${
      onPress ? 'active:bg-muted/50 transition-colors cursor-pointer' : ''
    }`}>
      {Icon && (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
          destructive ? 'bg-destructive/10' : 'bg-primary/10'
        }`}>
          <Icon className={`w-4 h-4 ${destructive ? 'text-destructive' : iconColor}`} />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${destructive ? 'text-destructive' : 'text-foreground'}`}>
          {label}
        </p>
        {value && typeof value === 'string' && (
          <p className="text-sm text-muted-foreground truncate">{value}</p>
        )}
        {value && typeof value !== 'string' && value}
      </div>
      
      {showChevron && (
        <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
      )}
    </div>
  );

  if (onPress) {
    return <button onClick={handlePress} className="w-full text-left">{content}</button>;
  }
  
  return content;
};

interface ProfileBadgeListProps {
  items: string[];
  emptyMessage?: string;
}

export const ProfileBadgeList = ({ items, emptyMessage = "Not added yet" }: ProfileBadgeListProps) => {
  if (!items || items.length === 0) {
    return (
      <div className="px-4 py-4">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span 
          key={index}
          className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
        >
          {item}
        </span>
      ))}
    </div>
  );
};
