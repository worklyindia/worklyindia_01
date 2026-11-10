import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

interface AppDownloadButtonsProps {
  userType: "job_seeker" | "employer";
  clickedFrom: string;
}

const AppDownloadButtons = ({ userType, clickedFrom }: AppDownloadButtonsProps) => {
  const { data: settings, isLoading } = useAppSettings();
  const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor;
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      setPlatform("ios");
    } else if (/android/i.test(userAgent)) {
      setPlatform("android");
    }
  }, []);

  const trackDownload = async (downloadPlatform: "android" | "ios") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from("app_download_tracking").insert({
        platform: downloadPlatform,
        user_type: userType,
        clicked_from: clickedFrom,
        user_id: user?.id || null,
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error("Failed to track download:", error);
    }
  };

  const handleDownload = (downloadPlatform: "android" | "ios", url: string) => {
    if (!url) return;
    trackDownload(downloadPlatform);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (isLoading) {
    return null;
  }

  if (!settings || settings.show_download_buttons !== "true") {
    return null;
  }

  const hasAndroidUrl = settings.android_app_url && settings.android_app_url.trim() !== "";
  const hasIosUrl = settings.ios_app_url && settings.ios_app_url.trim() !== "";

  if (!hasAndroidUrl && !hasIosUrl) {
    return null;
  }

  return (
    <div className="w-full py-4">
      <div className="flex flex-row gap-2 w-full">
        {hasAndroidUrl && (
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-auto py-2 px-3 hover:border-primary hover:bg-accent transition-all"
            onClick={() => handleDownload("android", settings.android_app_url)}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
              </svg>
              <div className="text-left">
                <div className="text-[8px] sm:text-[10px] text-muted-foreground uppercase leading-tight">Get it on</div>
                <div className="text-xs sm:text-sm font-semibold leading-tight">Google Play</div>
              </div>
            </div>
          </Button>
        )}

        {hasIosUrl && (
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-auto py-2 px-3 hover:border-primary hover:bg-accent transition-all"
            onClick={() => handleDownload("ios", settings.ios_app_url)}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              <div className="text-left">
                <div className="text-[8px] sm:text-[10px] text-muted-foreground uppercase leading-tight">Download on the</div>
                <div className="text-xs sm:text-sm font-semibold leading-tight">App Store</div>
              </div>
            </div>
          </Button>
        )}
      </div>
    </div>
  );
};

export default AppDownloadButtons;
