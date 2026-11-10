
import React, { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import AppLoadingSpinner from "@/components/AppLoadingSpinner";
import SlowNetworkBanner from "@/components/SlowNetworkBanner";
import ServiceUnavailableOverlay from "@/components/ServiceUnavailableOverlay";
import App from "./App.tsx";
import { AuthProvider } from "@/contexts/AuthContext";
import { EmployerAuthProvider } from "@/contexts/EmployerAuthContext";
import "./index.css";
import { createQueryClient } from "@/utils/queryClient";
import { restoreAndPersistQueryCache } from "@/utils/persistentQueryCache";
import { initializeApp, hideLoadingFallback, initializePerformanceUtils, initializeErrorMonitoring } from "@/utils/appInitializer";
import { prefetchStaticData } from "@/hooks/useStaticData";
import { initializeSentry } from "@/utils/sentry";
import { initializeMarketingTools } from "@/utils/marketing";
import { setupGlobalErrorHandler } from "@/utils/supabaseErrorHandler";
import { startProviderTokenSnapshot } from "@/lib/socialTokenSnapshot";
import { syncCanonicalDomain } from "@/utils/domainBootstrap";
import { installFilePickerGuard } from "@/lib/filePickerGuard";
import { installChunkErrorRecovery } from "@/lib/chunkErrorRecovery";
import { installRazorpayThemeFix } from "@/lib/razorpayThemeFix";
import { installRazorpayMethodPicker } from "@/lib/razorpayMethodPicker";
import { installImageEgressGuard } from "@/lib/imageEgressGuard";
import { installImageLongPressGuard } from "@/lib/imageLongPressGuard";
import { installDomMutationGuard } from "@/lib/domMutationGuard";
import { ThemeProvider } from "@/hooks/useTheme";

// Survive page translation / extensions rewriting the DOM under React
installDomMutationGuard();

// Self-heal when an open tab requests asset files from a previous deploy
installChunkErrorRecovery();

// Keep pages mounted while the native file/photo picker is open (mobile)
installFilePickerGuard();

// Keep the page visible behind the Razorpay sheet in dark mode
installRazorpayThemeFix();

// Every Pay button: ask "UPI / Bank / Debit" or "QR Code" before Razorpay opens
installRazorpayMethodPicker();

// Serve storage images resized/WebP via cache proxy (cuts cached egress)
installImageEgressGuard();

// Long-press on any image must not open the browser download sheet —
// the held press should flow into carousels (e.g. home banners) as a swipe.
installImageLongPressGuard();

// Grab any social provider_token before a session refresh can drop it
startProviderTokenSnapshot();

// Keep the owner-configured website domain in sync
void syncCanonicalDomain();

// Initialize Sentry first for error tracking
initializeSentry();

// Setup global error handler for network errors
setupGlobalErrorHandler();

// Service worker is manually registered in index.html (public/sw.js)

// Initialize app state
initializeApp();

// Create optimized query client
const queryClient = createQueryClient();

// Restore previously viewed public data before the first React paint.
// Private account, chat, payment and identity data is never written to this cache.
const root = createRoot(document.getElementById("root")!);

// Initialize utilities without blocking the first screen.
void initializePerformanceUtils();
void initializeErrorMonitoring();
void initializeMarketingTools();

void (async () => {
  await restoreAndPersistQueryCache(queryClient);
  prefetchStaticData(queryClient);

  // Render only after the local snapshot has had a chance to hydrate, so
  // cached content can be displayed immediately while fresh requests run.
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <EmployerAuthProvider>
                <ThemeProvider>
                  <Suspense fallback={<AppLoadingSpinner />}>
                    <App />
                  </Suspense>
                  <SlowNetworkBanner />
                  <ServiceUnavailableOverlay />
                  <Toaster />
                </ThemeProvider>
              </EmployerAuthProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  );
})();
