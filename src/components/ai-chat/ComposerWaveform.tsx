import { useEffect, useRef, useState } from 'react';
import { useAudioVisualization } from '@/hooks/useAudioVisualization';

interface ComposerWaveformProps {
  stream: MediaStream | null;
  active: boolean;
  bars?: number;
}

/**
 * ChatGPT-style rolling waveform shown inside the composer while dictating.
 * New amplitude samples enter from the right and scroll left, so the line
 * visibly reacts to how loud/soft the user is speaking.
 */
export const ComposerWaveform = ({ stream, active, bars = 40 }: ComposerWaveformProps) => {
  const { audioLevel } = useAudioVisualization({ stream, enabled: active, bands: 4 });
  const [levels, setLevels] = useState<number[]>(() => new Array(bars).fill(0));
  const levelRef = useRef(0);
  const smoothRef = useRef(0);
  const peakRef = useRef(12);

  // Track the loudest recent sample so quiet voices still produce a lively wave.
  levelRef.current = audioLevel;

  useEffect(() => {
    if (!active) {
      setLevels(new Array(bars).fill(0));
      smoothRef.current = 0;
      peakRef.current = 12;
      return;
    }
    // When no mic stream is available (e.g. speech-recognition-only dictation),
    // animate a lively synthetic wave so the recording state still feels alive.
    const synthetic = (t: number) =>
      Math.max(0.08, Math.min(1, 0.5 + 0.4 * Math.sin(t / 230) * Math.sin(t / 97) * Math.sin(t / 41)));

    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 55) return;
      last = t;

      if (stream) {
        const raw = levelRef.current;
        // adaptive normalisation against a decaying peak
        peakRef.current = Math.max(raw, peakRef.current * 0.97, 8);
        const norm = Math.min(1, raw / peakRef.current);
        // smooth so the wave glides instead of flickering
        smoothRef.current = smoothRef.current * 0.55 + norm * 0.45;
        const v = smoothRef.current;
        setLevels(prev => [...prev.slice(1), v]);
      } else {
        setLevels(prev => [...prev.slice(1), synthetic(t)]);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, bars, stream]);

  return (
    <div className="flex h-7 flex-1 items-center justify-end gap-[2px] overflow-hidden px-1">
      {levels.map((v, i) => {
        // fade in the older (left-most) samples for a smooth trailing edge
        const edge = Math.min(1, i / 6);
        const h = 3 + v * 21;
        return (
          <div
            key={i}
            className="w-[2.5px] shrink-0 rounded-full bg-red-500 transition-[height] duration-75 ease-out"
            style={{
              height: `${Math.max(3, Math.min(24, h))}px`,
              opacity: (0.35 + v * 0.65) * edge,
            }}
          />
        );
      })}
    </div>
  );
};
