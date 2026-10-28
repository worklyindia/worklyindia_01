import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RealTimeIndicatorProps {
  isConnected: boolean;
  newItemsCount: number;
  onRefresh?: () => void;
  onClearCount?: () => void;
  label?: string;
  className?: string;
}

export const RealTimeIndicator: React.FC<RealTimeIndicatorProps> = ({
  isConnected,
  newItemsCount,
  onRefresh,
  onClearCount,
  label = 'items',
  className
}) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Connection Status */}
      <div className="flex items-center gap-1">
        {isConnected ? (
          <Wifi className="w-4 h-4 text-green-600" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-600" />
        )}
        <span className="text-xs text-muted-foreground">
          {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* New Items Badge */}
      {newItemsCount > 0 && (
        <Badge 
          variant="destructive" 
          className="cursor-pointer animate-pulse"
          onClick={onClearCount}
        >
          {newItemsCount} new {label}
        </Badge>
      )}

      {/* Refresh Button */}
      {onRefresh && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
};