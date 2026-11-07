import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { useNativeNetwork } from "@/hooks/useNativeNetwork";

const OfflineIndicator = () => {
  const { isOnline } = useNativeNetwork();

  if (isOnline) return null;
  return (
    <main role="alert" aria-live="assertive" className="fixed inset-0 z-[100000] flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="mb-3 text-2xl font-bold">You're Offline</h1>
        <p className="mb-7 text-sm leading-6 text-muted-foreground">
          Internet connection nahi mil raha hai. Mobile data ya Wi-Fi on karein.
          Connection wapas aate hi Workly India automatically resume ho jayega.
        </p>
        <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try Again
        </button>
      </section>
    </main>
  );
};

export default OfflineIndicator;
