import { useEffect, useRef, useState } from 'react';

interface UseAudioVisualizationProps {
  stream: MediaStream | null;
  enabled: boolean;
  bands?: number;
}

interface AudioVisualizationResult {
  audioLevel: number;
  frequencyBands: number[];
}

export const useAudioVisualization = ({ 
  stream, 
  enabled, 
  bands = 15 
}: UseAudioVisualizationProps): AudioVisualizationResult => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [frequencyBands, setFrequencyBands] = useState<number[]>(new Array(bands).fill(0));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !enabled) {
      setAudioLevel(0);
      setFrequencyBands(new Array(bands).fill(0));
      return;
    }

    // Create audio context and analyser
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256; // Smaller for faster response
    analyserRef.current.smoothingTimeConstant = 0.3; // Faster response (was 0.8)

    const microphone = audioContextRef.current.createMediaStreamSource(stream);
    microphone.connect(analyserRef.current);

    const frequencyDataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    const timeDataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const updateAudioLevel = () => {
      if (!analyserRef.current) return;

      // Get frequency data for visualization bars
      analyserRef.current.getByteFrequencyData(frequencyDataArray);
      
      // Get time domain data for overall level
      analyserRef.current.getByteTimeDomainData(timeDataArray);

      // Calculate RMS for overall audio level
      let sum = 0;
      for (let i = 0; i < timeDataArray.length; i++) {
        const normalized = (timeDataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / timeDataArray.length);
      const level = Math.min(100, rms * 300);
      setAudioLevel(level);

      // Create frequency bands from frequency data
      const binCount = frequencyDataArray.length;
      const binsPerBand = Math.floor(binCount / bands);
      const newBands: number[] = [];

      for (let i = 0; i < bands; i++) {
        let bandSum = 0;
        const startBin = i * binsPerBand;
        const endBin = Math.min(startBin + binsPerBand, binCount);
        
        for (let j = startBin; j < endBin; j++) {
          bandSum += frequencyDataArray[j];
        }
        
        // Normalize to 0-100 range with boost for better visualization
        const bandAvg = bandSum / (endBin - startBin);
        const normalizedBand = Math.min(100, (bandAvg / 255) * 150);
        newBands.push(normalizedBand);
      }

      setFrequencyBands(newBands);
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stream, enabled, bands]);

  return { audioLevel, frequencyBands };
};
