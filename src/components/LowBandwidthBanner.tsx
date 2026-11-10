import { useEffect, useState } from "react";
import { AlertTriangle, WifiOff, Zap, X } from "lucide-react";
import { useEgressProtection } from "@/hooks/useEgressProtection";

/**
 * Banner that shows when egress usage is high
 * Displays different messages based on severity level
 */
const LowBandwidthBanner = () => {
  const { isLowBandwidthMode, isCriticalMode, egressPercentage } = useEgressProtection();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Show banner if in low bandwidth or critical mode and not dismissed
    if ((isLowBandwidthMode || isCriticalMode) && !isDismissed) {
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  }, [isLowBandwidthMode, isCriticalMode, isDismissed]);

  // Reset dismissed state after 30 minutes
  useEffect(() => {
    if (isDismissed) {
      const timeout = setTimeout(() => setIsDismissed(false), 30 * 60 * 1000);
      return () => clearTimeout(timeout);
    }
  }, [isDismissed]);

  if (!showBanner) return null;

  const getContent = () => {
    if (isCriticalMode) {
      return {
        icon: <WifiOff className="w-4 h-4 flex-shrink-0" />,
        title: "Critical Usage Mode",
        message: "Auto-refresh disabled to save bandwidth. Use manual refresh.",
        bgColor: "bg-red-500/90",
      };
    }
    
    return {
      icon: <Zap className="w-4 h-4 flex-shrink-0" />,
      title: "Low Bandwidth Mode",
      message: `Egress at ${egressPercentage?.toFixed(0)}%. Slower polling active.`,
      bgColor: "bg-amber-500/90",
    };
  };

  const content = getContent();

  return (
    <div
      className={`fixed top-16 left-0 right-0 z-40 transition-all duration-300 ${
        showBanner ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div
        className={`mx-4 mt-2 px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm ${content.bgColor} text-white`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {content.icon}
            <div>
              <span className="font-medium text-sm">{content.title}</span>
              <span className="text-xs opacity-90 ml-2">{content.message}</span>
            </div>
          </div>
          
          <button 
            onClick={() => setIsDismissed(true)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors ml-2"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LowBandwidthBanner;
