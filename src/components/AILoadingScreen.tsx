import LottieProfileIcon from "@/components/LottieProfileIcon";

/**
 * Full-screen AI loading screen shown while AI-only mode settings
 * (and other initial app data) are still loading.
 */
export const AILoadingScreen = () => {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      role="status"
      aria-label="ChatWork AI is loading"
    >
      {/* ChatWork AI animated mark */}
      <LottieProfileIcon size={120} />


      <h1 className="mt-10 text-2xl font-bold text-foreground">ChatWork AI</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Preparing your AI experience…
      </p>

      {/* Loading bar */}
      <div className="mt-8 h-1.5 w-48 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 rounded-full bg-primary animate-[ai-loading-bar_1.2s_ease-in-out_infinite]" />
      </div>

      <style>{`
        @keyframes ai-loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default AILoadingScreen;
