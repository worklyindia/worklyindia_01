import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showIndicator, setShowIndicator] = useState(!navigator.onLine);
  const [showOnlineMessage, setShowOnlineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineMessage(true);
      // Hide "Online" message after 2 seconds
      setTimeout(() => {
        setShowOnlineMessage(false);
        setShowIndicator(false);
      }, 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
      setShowOnlineMessage(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show online message or offline message
  if (!showIndicator && !showOnlineMessage) return null;

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50 
        px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-300
        ${isOnline ? 'bg-green-500/90 text-white' : 'bg-destructive/90 text-white'}`}
    >
      <div className="flex items-center space-x-2">
        {isOnline ? (
          <>
            <Wifi className="w-5 h-5" />
            <span className="font-medium text-sm">Online</span>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5" />
            <span className="font-medium text-sm">You are offline</span>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;
