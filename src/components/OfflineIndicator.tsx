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
    <main
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-[100000] flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground"
    >
      <section className="w-full max-w-md rounded-[2rem] border border-border/60 bg-card px-7 py-10 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10">
          <WifiOff className="h-11 w-11 text-emerald-600" aria-hidden="true" />
        </div>
        <p className="mb-3 text-xs font-bold tracking-[0.18em] text-emerald-600">
          CONNECTION INTERRUPTED
        </p>
        <h1 className="mb-3 text-3xl font-bold tracking-tight">You're offline</h1>
        <p className="mb-8 text-sm leading-6 text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={checkConnection}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Check connection
        </button>
        <p className="mt-6 text-xs text-muted-foreground">
          Workly India · Your next opportunity awaits
        </p>
      </section>
    </main>
  );
};

export default OfflineIndicator;
