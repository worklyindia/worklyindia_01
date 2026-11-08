import { useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { useNativeNetwork } from "@/hooks/useNativeNetwork";
import { getWorklyAndroidBridge } from "@/lib/nativeAppBridge";

const OfflineIndicator = () => {
  const { isOnline } = useNativeNetwork();
  const [message, setMessage] = useState(
    "Turn on mobile data or connect to Wi-Fi. Workly India will resume automatically when your connection is restored."
  );

  if (isOnline) return null;

  const checkConnection = () => {
    const bridge = getWorklyAndroidBridge();
    const connected = bridge ? bridge.isNetworkConnected() : navigator.onLine;

    if (connected) {
      window.location.reload();
      return;
    }

    setMessage(
      "No internet connection detected yet. Please switch on mobile data or Wi-Fi. This screen will disappear automatically when you're connected."
    );
    window.dispatchEvent(new Event("workly-native-network-change"));
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[100000] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-amber-500/30 bg-card/95 p-3 text-card-foreground shadow-xl backdrop-blur"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
        <WifiOff className="h-5 w-5 text-amber-600" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">You're offline</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
      <button
        type="button"
        onClick={checkConnection}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
        aria-label="Check internet connection"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Retry
      </button>
    </aside>
  );
};

export default OfflineIndicator;
