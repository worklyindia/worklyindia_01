import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import VerificationBadge from '@/components/VerificationBadge';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';
import { AudioRecorder, AudioQueue, encodeAudioForAPI } from '@/utils/RealtimeAudio';
import { supabase } from '@/integrations/supabase/client';

type CallStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIVoiceCall() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: settings } = useAIChatSettings();
  
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userTranscript, setUserTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize audio context and queue
  useEffect(() => {
    audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    audioQueueRef.current = new AudioQueue(audioContextRef.current);
    
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const startCall = async () => {
    try {
      setCallStatus('connecting');
      
      // Get ephemeral token from our edge function
      console.log('Requesting ephemeral token...');
      const { data: tokenData, error } = await supabase.functions.invoke('get-openai-token');
      
      if (error) {
        console.error('Error getting token:', error);
        throw new Error('Failed to get authentication token');
      }
      
      if (!tokenData?.client_secret?.value) {
        console.error('No token in response:', tokenData);
        throw new Error('Invalid token response');
      }

      const ephemeralToken = tokenData.client_secret.value;
      console.log('✅ Got ephemeral token, connecting to OpenAI...');
      
      // Connect directly to OpenAI with ephemeral token
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        ["realtime", `openai-insecure-api-key.${ephemeralToken}`]
      );
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Connected to OpenAI Realtime API');
        setCallStatus('listening');
        startRecording();
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 Received from OpenAI:', data.type);

        // Handle different event types
        if (data.type === 'response.audio.delta') {
          // Play audio chunks
          const binaryString = atob(data.delta);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          await audioQueueRef.current?.addToQueue(bytes);
          setCallStatus('speaking');
        } else if (data.type === 'response.audio_transcript.delta') {
          // Update AI transcript
          setAiTranscript(prev => prev + data.delta);
        } else if (data.type === 'response.audio.done') {
          // AI finished speaking, resume listening
          setCallStatus('listening');
          setMessages(prev => [...prev, { role: 'assistant', content: aiTranscript }]);
          setAiTranscript('');
          if (!isMuted) {
            startRecording();
          }
        } else if (data.type === 'input_audio_buffer.speech_started') {
          setUserTranscript('');
        } else if (data.type === 'input_audio_buffer.speech_stopped') {
          // User finished speaking, AI is thinking
          setCallStatus('thinking');
          stopRecording();
        } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
          // Update user transcript
          setUserTranscript(data.transcript);
          setMessages(prev => [...prev, { role: 'user', content: data.transcript }]);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        toast.error('Failed to connect to voice service');
        endCall();
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        setCallStatus('idle');
      };

    } catch (error) {
      console.error('❌ Error starting call:', error);
      toast.error('Failed to start voice call');
      setCallStatus('idle');
    }
  };

  const startRecording = async () => {
    if (isMuted) return;
    
    try {
      audioRecorderRef.current = new AudioRecorder((audioData) => {
        if (wsRef.current?.readyState === WebSocket.OPEN && !isMuted) {
          // Send audio to OpenAI via WebSocket
          const encoded = encodeAudioForAPI(audioData);
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: encoded
          }));
        }
      });
      
      await audioRecorderRef.current.start();
      console.log('🎤 Recording started');
    } catch (error) {
      console.error('❌ Recording error:', error);
      toast.error('Please allow microphone access');
    }
  };

  const stopRecording = () => {
    audioRecorderRef.current?.stop();
    audioRecorderRef.current = null;
  };

  const endCall = () => {
    stopRecording();
    wsRef.current?.close();
    wsRef.current = null;
    setCallStatus('idle');
    setMessages([]);
    setUserTranscript('');
    setAiTranscript('');
    navigate('/ai-assistant');
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      stopRecording();
    } else if (callStatus === 'listening') {
      startRecording();
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    // Note: Speaker control via AudioContext not directly supported in this way
    // This is placeholder for UI feedback
  };

  const aiName = settings?.name || 'AI Assistant';
  const showBadge = settings?.verification_enabled;
  const badgeColor = (settings?.verification_color || 'blue') as 'gold' | 'blue' | 'green' | 'silver';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/ai-assistant')}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{aiName}</h1>
            {showBadge && <VerificationBadge color={badgeColor} size={16} />}
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-20 pb-32">
        {callStatus === 'idle' ? (
          // Idle State - Start Call
          <div className="text-center space-y-8 animate-fade-in">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto shadow-2xl">
                <Phone className="w-16 h-16 text-white" />
              </div>
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Voice Call with {aiName}</h2>
              <p className="text-muted-foreground">Tap to start a voice conversation</p>
            </div>
            <Button
              size="lg"
              onClick={startCall}
              className="rounded-full px-8 py-6 text-lg shadow-xl hover:shadow-2xl transition-all"
            >
              <Phone className="w-6 h-6 mr-2" />
              Start Call
            </Button>
          </div>
        ) : (
          // Active Call State
          <div className="w-full max-w-md space-y-8 animate-fade-in">
            {/* Avatar with animation */}
            <div className="relative mx-auto w-48 h-48">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent opacity-20 animate-pulse" />
              <div className={`w-full h-full rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl ${
                callStatus === 'speaking' ? 'animate-pulse' : ''
              }`}>
                <Phone className="w-24 h-24 text-white" />
              </div>
              {callStatus === 'listening' && (
                <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping" />
              )}
            </div>

            {/* Status */}
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">
                {callStatus === 'connecting' && 'Connecting...'}
                {callStatus === 'listening' && 'Listening...'}
                {callStatus === 'thinking' && 'Thinking...'}
                {callStatus === 'speaking' && 'Speaking...'}
              </h3>
              {callStatus === 'listening' && (
                <p className="text-sm text-muted-foreground">Speak naturally, I'm listening</p>
              )}
            </div>

            {/* Transcripts */}
            <div className="bg-background/80 backdrop-blur-lg rounded-2xl p-4 border border-border/50 space-y-3 max-h-64 overflow-y-auto">
              {messages.slice(-3).map((msg, idx) => (
                <div key={idx} className={`p-3 rounded-xl ${
                  msg.role === 'user' 
                    ? 'bg-primary/10 text-foreground ml-4' 
                    : 'bg-accent/10 text-foreground mr-4'
                }`}>
                  <p className="text-xs font-medium mb-1 opacity-70">
                    {msg.role === 'user' ? 'You' : aiName}
                  </p>
                  <p className="text-sm">{msg.content}</p>
                </div>
              ))}
              {userTranscript && (
                <div className="p-3 rounded-xl bg-primary/10 text-foreground ml-4">
                  <p className="text-xs font-medium mb-1 opacity-70">You</p>
                  <p className="text-sm">{userTranscript}</p>
                </div>
              )}
              {aiTranscript && (
                <div className="p-3 rounded-xl bg-accent/10 text-foreground mr-4">
                  <p className="text-xs font-medium mb-1 opacity-70">{aiName}</p>
                  <p className="text-sm">{aiTranscript}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      {callStatus !== 'idle' && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border/50 px-4 py-6 pb-safe">
          <div className="flex items-center justify-center gap-6 max-w-md mx-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full ${isMuted ? 'bg-red-500 text-white hover:bg-red-600' : ''}`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>
            
            <Button
              variant="destructive"
              size="icon"
              onClick={endCall}
              className="w-16 h-16 rounded-full shadow-xl hover:shadow-2xl"
            >
              <PhoneOff className="w-8 h-8" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={toggleSpeaker}
              className={`w-14 h-14 rounded-full ${!isSpeakerOn ? 'bg-muted' : ''}`}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
