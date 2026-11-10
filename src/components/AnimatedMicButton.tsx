import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimatedMicButtonProps {
  isRecording: boolean;
  onClick: () => void;
  className?: string;
}

export const AnimatedMicButton = ({ isRecording, onClick, className }: AnimatedMicButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center transition-all duration-200",
        className
      )}
      aria-label={isRecording ? "Stop recording" : "Start voice search"}
    >
      {isRecording ? (
        <div className="relative flex items-center justify-center">
          {/* Ripple effect circles */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute w-9 h-9 bg-destructive/30 rounded-full animate-[ripple_1.5s_ease-out_infinite]" />
            <div className="absolute w-9 h-9 bg-destructive/20 rounded-full animate-[ripple_1.5s_ease-out_infinite_0.5s]" />
            <div className="absolute w-9 h-9 bg-destructive/10 rounded-full animate-[ripple_1.5s_ease-out_infinite_1s]" />
          </div>
          
          {/* Pulsing background */}
          <div className="relative z-10 w-7 h-7 bg-destructive rounded-full flex items-center justify-center animate-mic-pulse shadow-lg shadow-destructive/50">
            <Mic className="w-3.5 h-3.5 text-destructive-foreground" />
          </div>
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors">
          <Mic className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
    </button>
  );
};
