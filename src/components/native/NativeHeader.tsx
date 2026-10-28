import { ReactNode } from 'react';
import { goBack } from "@/lib/goBack";
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { cn } from '@/lib/utils';

interface NativeHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBackClick?: () => void;
  rightAction?: ReactNode;
  transparent?: boolean;
}

export const NativeHeader = ({
  title,
  subtitle,
  showBack = false,
  onBackClick,
  rightAction,
  transparent = false,
}: NativeHeaderProps) => {
  const navigate = useNavigate();
  const { tapFeedback } = useNativeFeel();
  const { isIOS, isAndroid } = usePlatformStyle();

  const handleBack = () => {
    tapFeedback();
    if (onBackClick) {
      onBackClick();
    } else {
      goBack(navigate, "/");
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b",
        transparent ? "bg-background/80 backdrop-blur-xl" : "bg-background",
        isIOS && "shadow-sm",
        isAndroid && "shadow-md"
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left Section */}
        <div className="flex items-center gap-3 flex-1">
          {showBack && (
            <button
              onClick={handleBack}
              className={cn(
                "p-2 -ml-2 rounded-full transition-all",
                isIOS && "hover:bg-muted/50 active:scale-95",
                isAndroid && "hover:bg-muted/50 active:opacity-70"
              )}
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          
          <div className="flex-1 min-w-0">
            <h1 className={cn(
              "font-semibold truncate",
              isIOS ? "text-lg" : "text-base"
            )}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Section */}
        {rightAction && (
          <div className="flex items-center">
            {rightAction}
          </div>
        )}
      </div>
    </header>
  );
};
