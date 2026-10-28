import { ShieldAlert, RefreshCw, Wifi, WifiOff, Monitor, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VPNBlockScreenProps {
  onCheckAgain: () => void;
  isChecking: boolean;
  detectionType?: 'vpn' | 'proxy' | 'tor' | null;
}

export const VPNBlockScreen = ({ onCheckAgain, isChecking, detectionType }: VPNBlockScreenProps) => {
  const typeLabel = detectionType === 'tor' ? 'TOR Network' : detectionType === 'proxy' ? 'Proxy Server' : 'VPN';

  return (
    <div className="fixed inset-0 z-[9999] bg-background overflow-y-auto"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
    >
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-destructive/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-24 h-24 bg-destructive rounded-full flex items-center justify-center shadow-lg">
                <ShieldAlert className="w-12 h-12 text-destructive-foreground" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-foreground">
            {typeLabel} Detected
          </h1>

          {/* Connection Status */}
          <div className="flex items-center justify-center gap-2 text-destructive font-medium">
            <WifiOff className="w-5 h-5" />
            <span>{typeLabel} Connection Active</span>
          </div>

          {/* Explanation */}
          <div className="bg-muted/50 rounded-xl p-4 text-left space-y-3">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Why is this blocked?
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              For security and fraud prevention, this website cannot be accessed while using a VPN, proxy, or TOR network. This helps us protect all users from fraudulent activity.
            </p>
          </div>

          {/* Steps to fix */}
          <div className="bg-muted/30 rounded-xl p-4 text-left space-y-2">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              How to fix this:
            </h3>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Open your {typeLabel} application or browser extension</li>
              <li>Turn off / disconnect the {typeLabel}</li>
              <li>Wait a few seconds for your connection to reset</li>
              <li>Click "Check Again" below</li>
            </ol>
          </div>

          {/* Check Again Button */}
          <Button
            onClick={onCheckAgain}
            disabled={isChecking}
            size="lg"
            className="w-full max-w-xs mx-auto"
            variant="default"
          >
            {isChecking ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Checking your connection...
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-2" />
                Check Again
              </>
            )}
          </Button>

          {/* Support */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              If you believe this is an error, please contact support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
