import { useEffect, useRef, useState } from 'react';

interface VoiceActivityDetectionProps {
  stream: MediaStream | null;
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
  silenceThreshold?: number;
  silenceDuration?: number;
}

export const useVoiceActivityDetection = ({
  stream,
  onSpeechStart,
  onSpeechEnd,
  silenceThreshold = 30,
  silenceDuration = 2000,
}: VoiceActivityDetectionProps) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream) return;

    // Create audio context and analyser with improved settings for soft voice
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 2048; // Higher resolution for better detection
    analyserRef.current.smoothingTimeConstant = 0.3; // Less smoothing for faster response

    const microphone = audioContextRef.current.createMediaStreamSource(stream);
    microphone.connect(analyserRef.current);

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const detectVoice = () => {
      if (!analyserRef.current) return;

      // Use time domain data for better soft voice detection
      analyserRef.current.getByteTimeDomainData(dataArray);
      
      // Calculate RMS (Root Mean Square) for accurate amplitude with gain boost
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const amplitude = rms * 20; // 20x gain boost for mobile mics (soft voice detection)
      const averageLevel = amplitude * 100;

      if (averageLevel > silenceThreshold) {
        // Voice detected
        if (!isSpeaking) {
          setIsSpeaking(true);
          onSpeechStart();
        }

        // Clear silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else {
        // Silence detected
        if (isSpeaking && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            setIsSpeaking(false);
            onSpeechEnd();
            silenceTimerRef.current = null;
          }, silenceDuration);
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectVoice);
    };

    detectVoice();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stream, isSpeaking, onSpeechStart, onSpeechEnd, silenceThreshold, silenceDuration]);

  return { isSpeaking };
};
