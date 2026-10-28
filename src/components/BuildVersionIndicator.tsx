import { BUILD_VERSION } from '@/lib/jobApplicationService';
import { forceRefresh } from '@/lib/cacheManager';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface BuildVersionIndicatorProps {
  showRefresh?: boolean;
  className?: string;
}

/**
 * Shows current build version - useful for debugging cache issues
 * Can be placed in settings or footer
 */
export function BuildVersionIndicator({ showRefresh = false, className = '' }: BuildVersionIndicatorProps) {
  return (
    <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      <span>Build: {BUILD_VERSION}</span>
      {showRefresh && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={forceRefresh}
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}
