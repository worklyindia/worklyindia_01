import Lottie from "lottie-react";
import { useBrandAssets } from "@/hooks/useBrandAssets";
import { BRAND_CONFIG } from "@/config/brandConfig";
import liveChatbotAnimation from "@/assets/live-chatbot.json";

const AppLoadingSpinner = () => {
  const brandAssets = useBrandAssets();
  const brandName = brandAssets.brand_name || BRAND_CONFIG.name;



  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-primary/10 blur-[130px] splash-glow-pulse" />
        <div className="absolute top-1/3 right-1/4 w-[220px] h-[220px] rounded-full bg-accent/10 blur-[90px] splash-glow-pulse" style={{ animationDelay: "1.2s" }} />
        <div className="absolute bottom-1/4 left-1/4 w-[180px] h-[180px] rounded-full bg-primary/8 blur-[80px] splash-glow-pulse" style={{ animationDelay: "0.6s" }} />
      </div>

      {/* Lottie animation */}
      <div className="relative z-10 flex items-center justify-center" style={{ width: 260, height: 260 }}>
        <Lottie
          animationData={liveChatbotAnimation}
          loop
          autoplay
          style={{ width: "100%", height: "100%" }}
        />
      </div>


      {/* Shimmer loading bar */}
      <div className="relative w-52 h-[3px] bg-muted/20 rounded-full overflow-hidden mt-2 mb-6 z-10">
        <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full splash-shimmer" />
      </div>

      {/* Brand name */}
      {!brandAssets.isLoading && brandName && (
        <div className="z-10 text-center animate-fade-in" style={{ animationDelay: "0.3s", animationFillMode: "both" }}>
          <p
            className="text-sm font-bold text-foreground/90 tracking-[0.3em] uppercase"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            {brandName}
          </p>
          {brandAssets.brand_tagline && (
            <p
              className="mt-1.5 text-xs text-muted-foreground/70 tracking-widest animate-fade-in"
              style={{ animationDelay: "0.6s", animationFillMode: "both", fontFamily: "Space Grotesk, sans-serif" }}
            >
              {brandAssets.brand_tagline}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AppLoadingSpinner;
