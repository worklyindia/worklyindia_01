import { useEffect, useState, useCallback } from "react";
import { WifiOff, Wifi, X } from "lucide-react";
import { getNetworkSpeed } from "@/utils/networkOptimizer";

const SlowNetworkBanner = () => {
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
    setShowBanner(false);
    // Reset dismissed state after 5 minutes
    setTimeout(() => setIsDismissed(false), 5 * 60 * 1000);
  }, []);

  useEffect(() => {
    const checkNetwork = () => {
      const speed = getNetworkSpeed();
      const isSlow = speed === 'slow';
      
      setIsSlowNetwork(isSlow);
      
      // Show banner only if network becomes slow and not dismissed
      if (isSlow && !isDismissed) {
        setShowBanner(true);
      } else if (!isSlow) {
        // Auto-hide after 2 seconds when network improves
        setTimeout(() => setShowBanner(false), 2000);
      }
    };

    // Initial check
    checkNetwork();

    // Listen for network changes
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', checkNetwork);
      return () => connection.removeEventListener('change', checkNetwork);
    }
  }, [isDismissed]);

  // Don't show if banner is hidden
  if (!showBanner) return null;

  return (
    <div
      className={`fixed top-16 left-0 right-0 z-40 transition-all duration-300 ${
        isSlowNetwork ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div
        className={`mx-4 mt-2 px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-300 ${
          isSlowNetwork
            ? 'bg-orange-500/90 text-white'
            : 'bg-green-500/90 text-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
          {isSlowNetwork ? (
              <>
                <WifiOff className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium text-sm">
                  Slow Network - Showing cached data
                </span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium text-sm">
                  Network improved! Loading fresh data
                </span>
              </>
            )}
          </div>
          
          {isSlowNetwork && (
            <button 
              onClick={dismissBanner}
              className="p-1 hover:bg-white/20 rounded-full transition-colors ml-2"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlowNetworkBanner;
