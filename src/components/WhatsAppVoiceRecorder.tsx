import { useState, useRef, useEffect } from 'react';
import { Mic, X, Send, Trash2, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { voiceStorage, VoiceRecording } from '@/lib/voiceStorage';

interface WhatsAppVoiceRecorderProps {
  onSendVoice: (audioBlob: Blob, duration: number) => void;
  disabled?: boolean;
}

export default function WhatsAppVoiceRecorder({ onSendVoice, disabled }: WhatsAppVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [slideX, setSlideX] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        previewBlobRef.current = audioBlob;
        
        // Save to local storage
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          const recording: VoiceRecording = {
            id: Date.now().toString(),
            blob: base64,
            duration: recordingTime,
            timestamp: new Date().toISOString(),
            sent: false
          };
          voiceStorage.saveRecording(recording);
        };
        reader.readAsDataURL(audioBlob);
        
        setIsPreviewing(true);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('Failed to access microphone');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
    setSlideX(0);
  };

  // Cancel recording
  const cancelRecording = () => {
    stopRecording();
    audioChunksRef.current = [];
    previewBlobRef.current = null;
    setRecordingTime(0);
    setIsPreviewing(false);
    toast.info('Recording cancelled');
  };

  // Delete preview
  const deletePreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    previewBlobRef.current = null;
    setIsPreviewing(false);
    setIsPlaying(false);
    setRecordingTime(0);
    toast.info('Recording deleted');
  };

  // Send recording
  const sendRecording = () => {
    if (previewBlobRef.current) {
      onSendVoice(previewBlobRef.current, recordingTime);
      
      // Mark as sent in storage
      const recordings = voiceStorage.getAllRecordings();
      const lastRecording = recordings[recordings.length - 1];
      if (lastRecording) {
        voiceStorage.markAsSent(lastRecording.id);
      }
      
      // Reset state
      previewBlobRef.current = null;
      setIsPreviewing(false);
      setIsPlaying(false);
      setRecordingTime(0);
      toast.success('Voice message sent');
    }
  };

  // Play/pause preview
  const togglePlayback = () => {
    if (!previewBlobRef.current) return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(URL.createObjectURL(previewBlobRef.current));
      audioRef.current.onended = () => setIsPlaying(false);
    }
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setTouchStartX(e.touches[0].clientX);
    startRecording();
  };

  // Handle touch move (slide to cancel)
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isRecording) return;
    
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX;
    
    if (diff < -100) {
      cancelRecording();
    } else if (diff < 0) {
      setSlideX(diff);
    }
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (!isRecording) return;
    
    if (slideX < -80) {
      cancelRecording();
    } else {
      stopRecording();
    }
    
    setSlideX(0);
  };

  // Handle mouse down (desktop)
  const handleMouseDown = () => {
    if (disabled) return;
    startRecording();
  };

  // Handle mouse up (desktop)
  const handleMouseUp = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // If previewing, show preview UI
  if (isPreviewing) {
    return (
      <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg animate-in slide-in-from-bottom duration-200">
        <Button
          onClick={togglePlayback}
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 text-[#075E54]" />
          ) : (
            <Play className="h-5 w-5 text-[#075E54]" />
          )}
        </Button>
        
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-8 bg-[#075E54]/10 rounded-full flex items-center px-3">
            <div className="flex gap-1 items-center flex-1">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-[#075E54] rounded-full"
                  style={{ height: `${Math.random() * 16 + 8}px` }}
                />
              ))}
            </div>
          </div>
          <span className="text-xs font-medium text-gray-600 min-w-[40px]">
            {formatTime(recordingTime)}
          </span>
        </div>

        <Button
          onClick={deletePreview}
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-50"
        >
          <Trash2 className="h-5 w-5" />
        </Button>

        <Button
          onClick={sendRecording}
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full bg-[#25D366] hover:bg-[#20BA5A] text-white shadow-lg"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  // If recording, show recording UI
  if (isRecording) {
    return (
      <div 
        className="flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg animate-in slide-in-from-bottom duration-200"
        style={{ transform: `translateX(${slideX}px)` }}
      >
        <div className="flex items-center gap-2 flex-1">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-700">
            {formatTime(recordingTime)}
          </span>
          <div className="flex-1 text-xs text-gray-500 ml-2">
            ← Slide to cancel
          </div>
        </div>
        
        <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
          <Mic className="h-6 w-6 text-white" />
        </div>
      </div>
    );
  }

  // Default: Show mic button
  return (
    <Button
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      disabled={disabled}
      size="icon"
      className="shrink-0 h-10 w-10 rounded-full shadow-lg bg-[#25D366] hover:bg-[#20BA5A] text-white active:scale-95 transition-transform"
    >
      <Mic className="w-10 h-10" />
    </Button>
  );
}
