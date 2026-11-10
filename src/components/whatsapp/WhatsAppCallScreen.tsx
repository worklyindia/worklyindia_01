import { useState, useEffect, useRef } from "react";
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, 
  Keyboard, ArrowLeft, MoreVertical, Video, VideoOff,
  X, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initiateVoiceCall, updateCallStatus } from "@/services/voiceCallService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface WhatsAppCallScreenProps {
  contactName: string;
  phoneNumber: string;
  profileImageUrl?: string | null;
  conversationId?: string;
  applicantId?: string;
  onClose: () => void;
  onCallEnd: () => void;
}

type CallStatus = 'calling' | 'ringing' | 'connected' | 'ended' | 'failed';

export const WhatsAppCallScreen = ({
  contactName,
  phoneNumber,
  profileImageUrl,
  conversationId,
  applicantId,
  onClose,
  onCallEnd
}: WhatsAppCallScreenProps) => {
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<CallStatus>('calling');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [callLogId, setCallLogId] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<Date | null>(null);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Simulate call connection (in real implementation, this would connect to WhatsApp)
  useEffect(() => {
    // Simulate ringing after 1 second
    const ringingTimeout = setTimeout(() => {
      if (callStatus === 'calling') {
        setCallStatus('ringing');
      }
    }, 1000);

    // Simulate connection after 3 seconds
    const connectTimeout = setTimeout(() => {
      if (callStatus !== 'ended') {
        setCallStatus('connected');
      }
    }, 3000);

    return () => {
      clearTimeout(ringingTimeout);
      clearTimeout(connectTimeout);
    };
  }, []);

  // Start timer when connected
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callStatus]);

  const handleEndCall = async () => {
    setCallStatus('ended');
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Update call log with final status and duration
    if (callLogId) {
      const finalStatus = callDuration > 0 ? 'completed' : 'no_answer';
      await updateCallStatus(callLogId, finalStatus, callDuration);
    }
    
    onCallEnd();
    setTimeout(onClose, 1500);
  };

  const logCallToDatabase = async () => {
    if (!user?.id) return;
    
    const result = await initiateVoiceCall({
      recipientPhone: phoneNumber.replace(/\D/g, ''),
      callerId: user.id,
      conversationId: conversationId,
      applicantId: applicantId
    });
    
    if (result.success && result.callLogId) {
      setCallLogId(result.callLogId);
      callStartTimeRef.current = new Date();
    } else {
      console.error('Failed to log call:', result.error);
    }
  };

  const handleWhatsAppCall = async () => {
    // Log call to database first
    await logCallToDatabase();
    
    // Open WhatsApp with this number to initiate call
    const formattedNumber = phoneNumber.replace(/\D/g, '');
    window.open(`https://wa.me/${formattedNumber}`, '_blank');
    
    toast.success("WhatsApp call initiated");
  };

  const handleNativeCall = async () => {
    // Log call to database first
    await logCallToDatabase();
    
    // Make native phone call
    window.location.href = `tel:+${phoneNumber.replace(/\D/g, '')}`;
    
    toast.success("Phone call initiated");
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'calling': return 'Calling...';
      case 'ringing': return 'Ringing...';
      case 'connected': return formatDuration(callDuration);
      case 'ended': return 'Call ended';
      case 'failed': return 'Call failed';
      default: return '';
    }
  };

  // Avatar color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      '#00a884', '#02a698', '#53bdeb', '#7c69ef', '#e862b4',
      '#ef7f3f', '#d4a03c', '#4fad4d', '#5eb5f7', '#ff7b7b'
    ];
    const charCode = (name?.[0] || 'A').toUpperCase().charCodeAt(0);
    return colors[charCode % colors.length];
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#075E54] to-[#128C7E]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-12 md:pt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20 h-10 w-10"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-10 w-10"
        >
          <MoreVertical className="h-6 w-6" />
        </Button>
      </div>

      {/* Contact Info */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Profile Picture */}
        <div className="relative mb-6">
          <Avatar className="h-32 w-32 border-4 border-white/20">
            {profileImageUrl && (
              <AvatarImage 
                src={profileImageUrl} 
                alt={contactName}
                className="object-cover"
              />
            )}
            <AvatarFallback 
              className="text-5xl font-medium text-white"
              style={{
                background: `linear-gradient(135deg, ${getAvatarColor(contactName)} 0%, ${getAvatarColor(contactName)}dd 100%)`
              }}
            >
              {(contactName?.[0] || phoneNumber[0]).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          {/* Pulsing ring animation when calling */}
          {(callStatus === 'calling' || callStatus === 'ringing') && (
            <>
              <div className="absolute inset-0 rounded-full border-4 border-white/40 animate-ping" />
              <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-pulse" />
            </>
          )}
        </div>

        {/* Contact Name */}
        <h2 className="text-2xl font-semibold text-white mb-1">
          {contactName || phoneNumber}
        </h2>
        
        {/* Phone Number */}
        <p className="text-white/80 text-lg mb-4">
          +{phoneNumber.replace(/(\d{2})(\d{5})(\d{5})/, '$1 $2 $3')}
        </p>

        {/* Call Status */}
        <div className={`text-lg ${callStatus === 'connected' ? 'text-white font-mono' : 'text-white/70'}`}>
          {getStatusText()}
        </div>

        {/* WhatsApp Voice indicator */}
        <p className="text-white/50 text-sm mt-2">WhatsApp Voice</p>
      </div>

      {/* Call Options - Show before connection */}
      {callStatus === 'calling' && (
        <div className="px-8 py-4">
          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
            <p className="text-white/80 text-sm text-center mb-4">
              Choose call method:
            </p>
            <div className="flex gap-4">
              <Button
                onClick={handleWhatsAppCall}
                className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white h-14 rounded-xl"
              >
                <MessageSquare className="h-5 w-5 mr-2" />
                WhatsApp
              </Button>
              <Button
                onClick={handleNativeCall}
                className="flex-1 bg-white/20 hover:bg-white/30 text-white h-14 rounded-xl"
              >
                <Phone className="h-5 w-5 mr-2" />
                Phone
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="px-8 py-12 md:py-8">
        {/* Main Controls */}
        <div className="flex items-center justify-center gap-8 mb-8">
          {/* Mute */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`flex flex-col items-center gap-2 ${callStatus !== 'connected' ? 'opacity-50' : ''}`}
            disabled={callStatus !== 'connected'}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isMuted ? 'bg-white text-[#075E54]' : 'bg-white/20 text-white'
            }`}>
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </div>
            <span className="text-white/80 text-xs">
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
          </button>

          {/* Speaker */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`flex flex-col items-center gap-2 ${callStatus !== 'connected' ? 'opacity-50' : ''}`}
            disabled={callStatus !== 'connected'}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isSpeakerOn ? 'bg-white text-[#075E54]' : 'bg-white/20 text-white'
            }`}>
              {isSpeakerOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
            </div>
            <span className="text-white/80 text-xs">
              {isSpeakerOn ? 'Speaker' : 'Speaker'}
            </span>
          </button>

          {/* Keypad */}
          <button
            onClick={() => setShowKeypad(!showKeypad)}
            className={`flex flex-col items-center gap-2 ${callStatus !== 'connected' ? 'opacity-50' : ''}`}
            disabled={callStatus !== 'connected'}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              showKeypad ? 'bg-white text-[#075E54]' : 'bg-white/20 text-white'
            }`}>
              <Keyboard className="h-6 w-6" />
            </div>
            <span className="text-white/80 text-xs">Keypad</span>
          </button>
        </div>

        {/* End Call Button */}
        <div className="flex justify-center">
          <button
            onClick={handleEndCall}
            className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
          >
            <PhoneOff className="h-8 w-8 text-white" />
          </button>
        </div>
      </div>

      {/* Keypad Overlay */}
      {showKeypad && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-[#1A2E35] rounded-2xl p-6 shadow-2xl">
          <div className="grid grid-cols-3 gap-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
              <button
                key={key}
                className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl font-medium transition-colors active:scale-95"
              >
                {key}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowKeypad(false)}
            className="mt-4 w-full text-white/70 text-sm"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};
