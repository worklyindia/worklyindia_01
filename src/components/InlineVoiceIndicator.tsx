import { useEffect, useState } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { useAudioVisualization } from '@/hooks/useAudioVisualization';

interface InlineVoiceIndicatorProps {
  isRecording: boolean;
  status: 'listening' | 'processing' | 'complete';
  transcribedText?: string;
  stream?: MediaStream | null;
  onClose?: () => void;
}

export const InlineVoiceIndicator = ({
  isRecording,
  status,
  transcribedText,
  stream,
  onClose
}: InlineVoiceIndicatorProps) => {
  const { audioLevel, frequencyBands } = useAudioVisualization({
    stream: stream || null,
    enabled: isRecording && status === 'listening',
    bands: 9
  });

  if (!isRecording && status !== 'processing' && status !== 'complete') {
    return null;
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3 bg-destructive/10 rounded-2xl border border-destructive/30 animate-fade-in">
      {/* Animated Mic Icon with Glow */}
      <div className="relative flex items-center justify-center">
        {status === 'listening' && (
          <>
            {/* Large outer ripple */}
            <div 
              className="absolute rounded-full bg-destructive/20 animate-ping"
              style={{
                width: `${48 + audioLevel * 1.5}px`,
                height: `${48 + audioLevel * 1.5}px`,
                animationDuration: '1.5s',
              }}
            />
            {/* Medium ripple */}
            <div 
              className="absolute rounded-full bg-destructive/25 transition-all duration-100"
              style={{
                width: `${40 + audioLevel * 1.2}px`,
                height: `${40 + audioLevel * 1.2}px`,
              }}
            />
            {/* Inner ripple */}
            <div 
              className="absolute rounded-full bg-destructive/30 transition-all duration-75"
              style={{
                width: `${36 + audioLevel * 0.8}px`,
                height: `${36 + audioLevel * 0.8}px`,
              }}
            />
          </>
        )}
        <div 
          className={`relative z-10 rounded-full flex items-center justify-center transition-all duration-150 ${
            status === 'listening' ? 'bg-destructive' : 'bg-muted'
          }`}
          style={{
            width: `${32 + (status === 'listening' ? audioLevel * 0.15 : 0)}px`,
            height: `${32 + (status === 'listening' ? audioLevel * 0.15 : 0)}px`,
            boxShadow: status === 'listening' 
              ? `0 0 ${15 + audioLevel * 0.5}px rgba(239, 68, 68, ${0.4 + audioLevel / 250})` 
              : 'none',
          }}
        >
          {status === 'processing' ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <Mic className="w-4 h-4 text-white" />
          )}
        </div>
      </div>

      {/* Sound Wave Visualization - Real frequency data */}
      {status === 'listening' && (
        <div className="flex items-end gap-[3px] h-8">
          {frequencyBands.map((bandLevel, i) => {
            const barHeight = 8 + (bandLevel * 0.25);
            return (
              <div
                key={i}
                className="w-[3px] bg-destructive rounded-full transition-all duration-50"
                style={{
                  height: `${Math.min(32, Math.max(4, barHeight))}px`,
                  opacity: 0.5 + (bandLevel / 150),
                }}
              />
            );
          })}
        </div>
      )}

      {/* Status Text */}
      <span className="text-sm font-medium text-destructive min-w-[100px]">
        {status === 'listening' && 'Listening...'}
        {status === 'processing' && 'Processing...'}
        {status === 'complete' && (transcribedText ? `"${transcribedText.slice(0, 25)}${transcribedText.length > 25 ? '...' : ''}"` : 'Done!')}
      </span>

      {/* Close button */}
      {onClose && status === 'listening' && (
        <button 
          onClick={onClose}
          className="ml-auto text-xs text-destructive/70 hover:text-destructive transition-colors font-medium"
        >
          Tap to stop
        </button>
      )}
    </div>
  );
};
