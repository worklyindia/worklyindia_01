import { Button } from '@/components/ui/button';
import { Mic, Send, Loader2 } from 'lucide-react';

interface WhatsAppVoiceRecorderProps {
  onMicClick: () => void;
  onSendMessage?: () => void;
  disabled?: boolean;
  showSendButton?: boolean;
  inputValue?: string;
  isRecording?: boolean;
  isProcessing?: boolean;
}

export function WhatsAppVoiceRecorder({ 
  onMicClick,
  onSendMessage,
  disabled,
  showSendButton = true,
  inputValue = '',
  isRecording = false,
  isProcessing = false
}: WhatsAppVoiceRecorderProps) {
  // Show send button if there's input text
  if (inputValue.trim() && showSendButton) {
    return (
      <Button
        onClick={onSendMessage}
        disabled={disabled}
        className="bg-whatsapp-green hover:bg-whatsapp-green-dark text-white h-11 w-11 rounded-full p-0 flex-shrink-0"
      >
        <Send className="h-5 w-5" />
      </Button>
    );
  }

  // Processing state
  if (isProcessing) {
    return (
      <Button
        disabled
        className="bg-whatsapp-green text-white h-11 w-11 rounded-full p-0 flex-shrink-0"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    );
  }

  // Default mic button
  return (
    <Button
      onClick={onMicClick}
      disabled={disabled || isRecording}
      className="bg-whatsapp-green hover:bg-whatsapp-green-dark text-white h-11 w-11 rounded-full p-0 flex-shrink-0"
    >
      <Mic className={`h-7 w-7 ${isRecording ? 'animate-pulse' : ''}`} />
    </Button>
  );
}
