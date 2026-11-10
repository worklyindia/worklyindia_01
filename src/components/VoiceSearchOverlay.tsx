import { createPortal } from "react-dom";
import { Mic } from "lucide-react";
import { useAudioVisualization } from "@/hooks/useAudioVisualization";

interface VoiceSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscript: (text: string) => void;
  isRecording: boolean;
  transcribedText?: string;
  status: 'listening' | 'processing' | 'complete';
  onTapToSearch?: () => void;
  stream?: MediaStream | null;
}

export const VoiceSearchOverlay = ({
  isOpen,
  onClose,
  onTranscript,
  isRecording,
  transcribedText,
  status,
  onTapToSearch,
  stream
}: VoiceSearchOverlayProps) => {
  // Real-time audio visualization - returns frequency bands for real audio reactivity
  const { audioLevel, frequencyBands } = useAudioVisualization({
    stream: stream || null,
    enabled: isRecording && isOpen && status === 'listening',
    bands: 15
  });

  const getStatusText = () => {
    switch (status) {
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      case 'complete':
        return transcribedText || 'Done!';
      default:
        return 'Listening...';
    }
  };

  if (!isOpen) return null;

  const overlayContent = (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-black via-gray-950 to-black flex flex-col items-center justify-center pt-safe pb-safe">
      <div className="flex flex-col items-center justify-center gap-12 px-6 w-full max-w-md">
        {/* Big animated microphone with voice-reactive glow */}
        <div className="relative flex items-center justify-center">
          {/* Voice-reactive ripple effects - show when listening */}
          {status === 'listening' && (
            <>
              <div 
                className="absolute rounded-full bg-red-500/30 animate-[ripple_2s_ease-out_infinite]"
                style={{
                  width: `${200 + audioLevel * 2}px`,
                  height: `${200 + audioLevel * 2}px`,
                }}
              />
              <div 
                className="absolute rounded-full bg-red-500/20 animate-[ripple_2s_ease-out_infinite_0.7s]"
                style={{
                  width: `${220 + audioLevel * 2.5}px`,
                  height: `${220 + audioLevel * 2.5}px`,
                }}
              />
              <div 
                className="absolute rounded-full bg-red-500/10 animate-[ripple_2s_ease-out_infinite_1.4s]"
                style={{
                  width: `${240 + audioLevel * 3}px`,
                  height: `${240 + audioLevel * 3}px`,
                }}
              />
            </>
          )}

          {/* Main mic circle with voice-reactive glow */}
          <div 
            className={`relative z-10 rounded-full flex items-center justify-center transition-all duration-100 ${
              status === 'listening'
                ? 'bg-red-500 shadow-2xl' 
                : 'bg-gray-800'
            }`}
            style={{
              width: `${160 + (status === 'listening' ? audioLevel * 0.5 : 0)}px`,
              height: `${160 + (status === 'listening' ? audioLevel * 0.5 : 0)}px`,
              boxShadow: status === 'listening'
                ? `0 0 ${40 + audioLevel}px rgba(239, 68, 68, ${0.6 + audioLevel / 200})` 
                : 'none'
            }}
          >
            <Mic
              className={`w-28 h-28 transition-all duration-100 ${
                status === 'listening' ? 'text-white' : 'text-gray-400'
              }`}
            />

          </div>
        </div>

        {/* Status text */}
        <div className="text-center space-y-3">
          <p className="text-3xl font-semibold text-white">
            {getStatusText()}
          </p>
          {status === 'listening' && (
            <p className="text-base text-gray-400">
              Speak your search query
            </p>
          )}
        </div>

        {/* REAL Sound wave visualization - uses actual frequency bands */}
        {status === 'listening' && (
          <div className="flex items-end justify-center gap-1.5 h-24">
            {frequencyBands.map((bandLevel, i) => {
              // Real frequency data - no fake Math.sin() animation
              const barHeight = 8 + (bandLevel * 0.7);
              
              return (
                <div
                  key={i}
                  className="w-1.5 bg-red-500 rounded-full transition-all duration-50"
                  style={{
                    height: `${Math.max(8, Math.min(80, barHeight))}px`,
                    opacity: 0.5 + (bandLevel / 200),
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Transcribed text display */}
        {transcribedText && status === 'complete' && (
          <div className="mt-4 p-6 bg-white/10 backdrop-blur-md rounded-2xl max-w-md border border-white/20">
            <p className="text-sm text-gray-200 text-center">
              "{transcribedText}"
            </p>
          </div>
        )}

        {/* Tap to search hint */}
        {status === 'listening' && (
          <button
            onClick={onTapToSearch || onClose}
            className="mt-8 text-base text-gray-400 hover:text-white transition-colors active:scale-95"
          >
            Tap to search
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(overlayContent, document.body);
};
