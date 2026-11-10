import { useState, useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useBrandAssets } from '@/hooks/useBrandAssets';
import { supabase } from '@/integrations/supabase/client';
import { SafeImg } from '@/components/ui/safe-image';

export const InstallPromptBanner = () => {
  const { isInstalled, promptInstall, canShowPrompt } = useInstallPrompt();
  const { data: appSettings } = useAppSettings();
  const { brand_name, logo_url } = useBrandAssets();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const autoDismissRef = useRef<NodeJS.Timeout | null>(null);

  const androidUrl = appSettings?.android_app_url || '';
  const iosUrl = appSettings?.ios_app_url || '';
  const showInstallBanner = appSettings?.show_install_banner !== 'false';
  const installButtonAction = appSettings?.install_button_action || 'pwa';
  const hasStoreLinks = androidUrl || iosUrl;

  useEffect(() => {
    if (isInstalled) {
      setIsVisible(false);
      return;
    }

    const dismissedTime = localStorage.getItem('install-banner-dismissed');
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
      // PWA mode: show every 24 hours, URL mode: show every 7 days
      const cooldownHours = installButtonAction === 'pwa' ? 24 : 168;
      if (hoursSinceDismissed < cooldownHours) {
        setIsDismissed(true);
        return;
      }
    }

    if (!showInstallBanner) {
      setIsVisible(false);
      return;
    }

    // PWA mode: only show if browser supports PWA install prompt
    if (installButtonAction === 'pwa' && !canShowPrompt) {
      return;
    }

    // URL mode: show if store links exist
    if (installButtonAction !== 'pwa' && !hasStoreLinks) {
      return;
    }

    if (!isDismissed) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isInstalled, isDismissed, hasStoreLinks, canShowPrompt, showInstallBanner, installButtonAction]);

  useEffect(() => {
    if (isVisible && !isAnimatingOut) {
      autoDismissRef.current = setTimeout(() => {
        handleDismiss();
      }, 15000);
    }

    return () => {
      if (autoDismissRef.current) {
        clearTimeout(autoDismissRef.current);
      }
    };
  }, [isVisible, isAnimatingOut]);

  const trackDownload = async (platform: "android" | "ios" | "pwa") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("app_download_tracking").insert({
        platform,
        user_type: "job_seeker",
        clicked_from: "install_banner",
        user_id: user?.id || null,
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error("Failed to track download:", error);
    }
  };

  const handleDismiss = () => {
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
    }
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsAnimatingOut(false);
      localStorage.setItem('install-banner-dismissed', Date.now().toString());
    }, 300);
  };

  const handleInstall = async () => {
    if (installButtonAction === 'pwa') {
      trackDownload("pwa");
      await promptInstall();
      return;
    }
    
    // Only open store URLs when action is explicitly 'url'
    if (androidUrl && /Android/i.test(navigator.userAgent)) {
      trackDownload("android");
      window.open(androidUrl, '_blank', 'noopener,noreferrer');
    } else if (iosUrl && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
      trackDownload("ios");
      window.open(iosUrl, '_blank', 'noopener,noreferrer');
    } else if (androidUrl) {
      trackDownload("android");
      window.open(androidUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isVisible || isInstalled) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${isAnimatingOut ? 'animate-slide-out-up' : 'animate-slide-in-down'}`}>
      <div className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground shadow-lg">
        <div className="container mx-auto px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Logo + Text */}
            <div className="flex items-center gap-2.5 min-w-0">
              {logo_url ? (
                <SafeImg
                  src={logo_url}
                  alt={brand_name || 'App'}
                  fallbackSrc=""
                  className="h-8 w-8 rounded-lg object-contain bg-white/20 p-0.5 flex-shrink-0"
                />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Download className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold truncate">
                  Install {brand_name || 'App'}
                </p>
                <p className="text-[10px] sm:text-xs opacity-90 truncate">
                  Better experience with our app
                </p>
              </div>
            </div>

            {/* Right: Cancel + Install */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                onClick={handleDismiss}
                size="sm"
                variant="ghost"
                className="text-primary-foreground hover:bg-white/20 text-xs h-8 px-3"
              >
                Cancel
              </Button>
              <Button
                onClick={handleInstall}
                size="sm"
                className="bg-white text-primary hover:bg-white/90 font-semibold text-xs h-8 px-4 rounded-full"
              >
                Install
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
