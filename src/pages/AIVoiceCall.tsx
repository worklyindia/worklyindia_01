import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, PhoneOff } from 'lucide-react';
import LottieSearchIcon from '@/components/LottieSearchIcon';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';
import { getWorklyAndroidBridge } from '@/lib/nativeAppBridge';
import { supabase } from '@/integrations/supabase/client';
import { speakBrowserLocalReply, stopBrowserLocalReply } from '@/lib/browserOfflineVoice';
import { prepareShrutiRecognition, startShrutiRecognition, stopShrutiRecognition } from '@/lib/shrutiSpeech';

type CallState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export default function AIVoiceCall() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: settings } = useAIChatSettings();
  const [callState, setCallState] = useState<CallState>('idle');
  const [lastReply, setLastReply] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [voiceStage, setVoiceStage] = useState('Waiting for microphone…');
  const [micLevel, setMicLevel] = useState(0);
  const [aiRequestStatus, setAiRequestStatus] = useState('Not sent');
  const activeRef = useRef(false);
  const startingCallRef = useRef(false);
  const partialFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmittedTranscriptRef = useRef('');
  const conversationTurnRef = useRef(0);
  const replyAudioRef = useRef<HTMLAudioElement | null>(null);
  const replyAudioUrlRef = useRef<string | null>(null);
  const bridge = getWorklyAndroidBridge();
  const startRecognition = useCallback((_language = 'auto') => {
    void startShrutiRecognition().catch((error) => window.dispatchEvent(new CustomEvent('workly-voice-error', {
      detail: { message: error instanceof Error ? error.message : 'Shruti microphone could not start.' },
    })));
    return true;
  }, []);
  const stopRecognition = useCallback(() => { stopShrutiRecognition(); }, []);
  const speakReply = useCallback(async (text: string, language: string) => {
    const resolvedLanguage = language === 'und' ? (navigator.language || 'en-US') : language;
    if (bridge) return bridge.speakVoiceReply?.(text, language) ?? false;

    try {
      const { data, error } = await supabase.functions.invoke('unified-voice', {
        body: { action: 'text-to-speech', text, provider: 'cartesia' },
      });
      if (error) throw error;

      let sourceUrl = typeof data?.audioUrl === 'string' ? data.audioUrl : '';
      if (!sourceUrl && typeof data?.audioContent === 'string') {
        const binary = Uint8Array.from(atob(data.audioContent), (char) => char.charCodeAt(0));
        const blob = new Blob([binary], { type: 'audio/mpeg' });
        if (replyAudioUrlRef.current) URL.revokeObjectURL(replyAudioUrlRef.current);
        replyAudioUrlRef.current = URL.createObjectURL(blob);
        sourceUrl = replyAudioUrlRef.current;
      }
      if (!sourceUrl) throw new Error('No voice audio was returned.');

      const audio = replyAudioRef.current ?? new Audio();
      replyAudioRef.current = audio;
      audio.onended = () => {
        window.dispatchEvent(new CustomEvent('workly-voice-status', { detail: { status: 'finished' } }));
      };
      audio.onerror = () => {
        window.dispatchEvent(new CustomEvent('workly-voice-status', { detail: { status: 'finished' } }));
      };
      audio.src = sourceUrl;
      audio.volume = speakerOn ? 1 : 0;
      audio.currentTime = 0;
      await audio.play();
      window.dispatchEvent(new CustomEvent('workly-voice-status', { detail: { status: 'speaking' } }));
      return true;
    } catch {
      // Last-resort browser TTS. Do not surface a browser TTS failure as a call-ending error.
      try {
        const fallback = speakBrowserLocalReply(text, resolvedLanguage);
        if (fallback) return true;
      } catch {
        // Keep the call alive even when browser speech playback is unavailable.
      }
      return false;
    }
  }, [bridge, speakerOn]);

  const stopReply = useCallback(() => {
    if (bridge) bridge.stopVoiceReply?.();
    const audio = replyAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    stopBrowserLocalReply();
  }, [bridge]);

  const endCall = useCallback(() => {
    activeRef.current = false;
    if (partialFinalizeTimerRef.current) clearTimeout(partialFinalizeTimerRef.current);
    partialFinalizeTimerRef.current = null;
    lastSubmittedTranscriptRef.current = '';
    conversationTurnRef.current += 1;
    stopRecognition();
    stopReply();
    setCallState('idle');
    setVoiceStage('Call ended');
    setMicLevel(0);
    setAiRequestStatus('Not sent');
    setLastReply('');
    setLastTranscript('');
    setPartialTranscript('');
    setErrorMessage('');
    setMuted(false);
    setSpeakerOn(true);
  }, [stopRecognition, stopReply]);

  const handleTranscript = useCallback(async (event: Event) => {
    if (!activeRef.current) return;
    const detail = (event as CustomEvent<{ text?: string; languageTag?: string }>).detail;
    const transcript = detail?.text?.trim();
    if (!transcript || transcript === lastSubmittedTranscriptRef.current) return;
    lastSubmittedTranscriptRef.current = transcript;
    const turnId = ++conversationTurnRef.current;
    if (partialFinalizeTimerRef.current) clearTimeout(partialFinalizeTimerRef.current);
    partialFinalizeTimerRef.current = null;
    setLastTranscript(transcript);
    setPartialTranscript('');
    setErrorMessage('');
    setCallState('thinking');
    setVoiceStage('Recognized speech; sending text to AI…');
    setAiRequestStatus('Sending');
    try {
      const { data, error } = await supabase.functions.invoke('unified-voice', {
        body: { action: 'ai-voice-chat', text: transcript, languageTag: detail?.languageTag || 'und' },
      });
      if (error) throw error;
      const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
      if (!reply) throw new Error('AI did not return a voice response.');
      setAiRequestStatus('Reply received');
      setVoiceStage('AI reply received; starting speech playback…');
      if (!activeRef.current || turnId !== conversationTurnRef.current) return;
      setLastReply(reply);
      const spoken = await speakReply(reply, data?.languageTag || detail?.languageTag || 'und');
      if (spoken) {
        setCallState('speaking');
        setVoiceStage('Voice playback started');
      } else {
        // TTS failure must never end or navigate away from the call screen.
        setCallState('listening');
        setVoiceStage('AI reply received; microphone remains active');
        if (activeRef.current && !muted) window.setTimeout(() => { if (activeRef.current && !muted) startRecognition('auto'); }, 150);
      }
    } catch (error) {
      if (!activeRef.current || turnId !== conversationTurnRef.current) return;
      const message = error instanceof Error ? error.message : 'Voice reply failed. Please try again.';
      setErrorMessage('');
      setAiRequestStatus('Retrying');
      setVoiceStage('AI is reconnecting…');
      setCallState('listening');
      if (activeRef.current && !muted) {
        window.setTimeout(() => {
          if (activeRef.current && !muted) startRecognition('auto');
        }, 500);
      }
    }
    // Transcript and reply remain only in component memory and are cleared by End Call.
  }, [speakReply]);

  const handlePartialTranscript = useCallback((event: Event) => {
    if (!activeRef.current) return;
    const detail = (event as CustomEvent<{ text?: string; languageTag?: string }>).detail;
    const text = detail?.text?.trim();
    if (!text || text === lastSubmittedTranscriptRef.current) return;
    setPartialTranscript(text);
    setVoiceStage('Speech recognized; waiting for a pause…');
    if (partialFinalizeTimerRef.current) clearTimeout(partialFinalizeTimerRef.current);
    partialFinalizeTimerRef.current = setTimeout(() => {
      if (!activeRef.current || text === lastSubmittedTranscriptRef.current) return;
      window.dispatchEvent(new CustomEvent('workly-voice-transcript', { detail: { text, languageTag: detail?.languageTag || 'und', source: 'partial-fallback' } }));
    }, 1400);
  }, []);

  const handleNativeStatus = useCallback((event: Event) => {
    if (!activeRef.current) return;
    const status = (event as CustomEvent<{ status?: string }>).detail?.status;
    if (status === 'listening') { setCallState('listening'); setVoiceStage('Microphone is listening'); }
    if (status === 'processing') setVoiceStage('Speech ended; waiting for transcript…');
    if (status === 'processing') setCallState('thinking');
    if (status === 'speaking') { stopRecognition(); setCallState('speaking'); }
    if (status === 'finished' && activeRef.current && !muted) {
      window.setTimeout(() => {
        if (activeRef.current && !muted) {
          const started = startRecognition('auto');
          if (started) setCallState('listening');
          else { setCallState('error'); toast.error('Could not resume listening.'); }
        }
      }, 250);
    }
  }, [startRecognition, stopRecognition, muted]);

  const handleBargeIn = useCallback((_event: Event) => {
    if (!activeRef.current || muted) return;
    // Invalidate any reply still being generated so an interrupted turn can never speak later.
    conversationTurnRef.current += 1;
    if (partialFinalizeTimerRef.current) clearTimeout(partialFinalizeTimerRef.current);
    partialFinalizeTimerRef.current = null;
    lastSubmittedTranscriptRef.current = '';
    setPartialTranscript('');
    setCallState('listening');
    stopReply();
    stopRecognition();
    window.setTimeout(() => {
      if (!activeRef.current || muted) return;
      const started = startRecognition('auto');
      if (!started) { setCallState('error'); toast.error('Could not listen after interruption.'); }
    }, 180);
  }, [startRecognition, stopRecognition, stopReply, muted]);

  const handleNativeError = useCallback((event: Event) => {
    if (!activeRef.current) return;
    const message = (event as CustomEvent<{ message?: string }>).detail?.message || 'Voice service error.';
    setVoiceStage(`Recognition error: ${message}`);
    setErrorMessage(message);
    setCallState('error');
    toast.error(message);
  }, []);

  useEffect(() => {
    const handleShrutiStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: string; loaded?: number; total?: number; message?: string }>).detail;
      if (detail?.status === 'ready') setNativeAvailable(true);
    };
    window.addEventListener('workly-shruti-status', handleShrutiStatus);
    return () => { window.removeEventListener('workly-shruti-status', handleShrutiStatus); };
  }, []);

  useEffect(() => {
    // Warm browser speech voices before the first AI reply needs playback.
    if (!bridge && 'speechSynthesis' in window) window.speechSynthesis.getVoices();
    setNativeAvailable(false);
    const handleSpeechStart = () => { if (activeRef.current) setVoiceStage('Speech detected by microphone'); };
    const handleMicLevel = (event: Event) => {
      if (!activeRef.current) return;
      const level = Number((event as CustomEvent<{ level?: number }>).detail?.level ?? 0);
      setMicLevel(Math.max(0, Math.min(100, level)));
    };
    window.addEventListener('workly-voice-speech-start', handleSpeechStart);
    window.addEventListener('workly-voice-mic-level', handleMicLevel);
    window.addEventListener('workly-voice-transcript', handleTranscript);
    window.addEventListener('workly-voice-partial-transcript', handlePartialTranscript);
    window.addEventListener('workly-voice-status', handleNativeStatus);
    window.addEventListener('workly-voice-error', handleNativeError);
    window.addEventListener('workly-voice-barge-in', handleBargeIn);
    return () => {
      window.removeEventListener('workly-voice-speech-start', handleSpeechStart);
      window.removeEventListener('workly-voice-mic-level', handleMicLevel);
      window.removeEventListener('workly-voice-transcript', handleTranscript);
      window.removeEventListener('workly-voice-partial-transcript', handlePartialTranscript);
      window.removeEventListener('workly-voice-status', handleNativeStatus);
      window.removeEventListener('workly-voice-error', handleNativeError);
      window.removeEventListener('workly-voice-barge-in', handleBargeIn);
      activeRef.current = false;
      stopRecognition();
      stopReply();
    };
  }, [bridge, stopRecognition, stopReply, handleTranscript, handlePartialTranscript, handleNativeStatus, handleNativeError, handleBargeIn]);

  const startCall = async () => {
    if (startingCallRef.current || activeRef.current) return;
    if (!user) { toast.error('Please log in to use AI voice calls.'); return; }
    startingCallRef.current = true;
    try {
      // Load the offline model only after the user taps Start AI Call.
      // The model is persisted in IndexedDB and reused on later visits.
      try { await navigator.storage?.persist?.(); } catch { /* browser may deny persistent storage */ }
      await prepareShrutiRecognition();
      activeRef.current = true;
      if (partialFinalizeTimerRef.current) clearTimeout(partialFinalizeTimerRef.current);
      partialFinalizeTimerRef.current = null;
      lastSubmittedTranscriptRef.current = '';
      setLastReply('');
      setLastTranscript('');
      setPartialTranscript('');
      setErrorMessage('');
      setCallState('listening');
      setVoiceStage('Starting secure on-device microphone…');
      setMicLevel(0);
      setAiRequestStatus('Not sent');
      startingCallRef.current = false;
      if (!startRecognition('auto')) {
        activeRef.current = false;
        setVoiceStage('Could not start speech recognition');
        setErrorMessage('Could not start speech recognition. Check microphone permission and browser speech settings, then try again.');
        setCallState('error');
        toast.error('Could not start on-device speech recognition.');
      }
    } catch (error) {
      startingCallRef.current = false;
      activeRef.current = false;
      const message = error instanceof Error ? error.message : 'Shruti could not start. Check microphone permission and try again.';
      setErrorMessage(message);
      setVoiceStage(`Error: ${message}`);
      setCallState('error');
      toast.error(message);
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (next) {
      // Mute only the microphone. Never end/navigate away from the active call and never stop AI playback.
      stopRecognition();
      setCallState('speaking');
      setVoiceStage('Microphone muted; call remains active');
    } else if (activeRef.current) {
      startRecognition('auto');
      setCallState('listening');
      setVoiceStage('Microphone is listening');
    }
  };

  const toggleSpeaker = () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    const audio = replyAudioRef.current;
    if (audio) audio.volume = next ? 1 : 0;
  };

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#080D1B] text-white">
      <style>{`
        @keyframes chatwork-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes chatwork-orbit-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes chatwork-pulse { 0%,100% { transform: scale(.92); opacity:.35; } 50% { transform: scale(1.08); opacity:.75; } }
        @keyframes chatwork-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.045); } }
        @keyframes chatwork-float { 0%,100% { transform: translate3d(0,0,0); opacity:.2; } 50% { transform: translate3d(0,-12px,0); opacity:.65; } }
      `}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[22%] h-80 w-80 -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" style={{ animation: "chatwork-pulse 4s ease-in-out infinite" }} />
        <div className="absolute left-[12%] top-[34%] h-2 w-2 rounded-full bg-cyan-300/70" style={{ animation: "chatwork-float 3.2s ease-in-out infinite" }} />
        <div className="absolute right-[14%] top-[30%] h-1.5 w-1.5 rounded-full bg-fuchsia-300/70" style={{ animation: "chatwork-float 4.1s ease-in-out .6s infinite" }} />
        <div className="absolute left-[20%] top-[58%] h-1.5 w-1.5 rounded-full bg-blue-300/60" style={{ animation: "chatwork-float 3.7s ease-in-out 1s infinite" }} />
        <div className="absolute right-[22%] top-[52%] h-2 w-2 rounded-full bg-indigo-300/60" style={{ animation: "chatwork-float 4.4s ease-in-out .3s infinite" }} />
      </div>
      <section className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="relative flex h-56 w-56 items-center justify-center">
          <div className="absolute inset-2 rounded-full border border-cyan-300/10" style={{ animation: "chatwork-pulse 3.6s ease-in-out infinite" }} />
          <div className="absolute inset-8 rounded-full border border-blue-300/15" style={{ animation: "chatwork-pulse 3.1s ease-in-out .35s infinite" }} />
          <div className="absolute inset-14 rounded-full bg-gradient-to-r from-cyan-400/10 via-blue-500/15 to-fuchsia-500/10 blur-2xl" style={{ animation: "chatwork-breathe 2.8s ease-in-out infinite" }} />
          <div className="absolute inset-5" style={{ animation: "chatwork-orbit 9s linear infinite" }}>
            <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,.95)]" />
          </div>
          <div className="absolute inset-10" style={{ animation: "chatwork-orbit-reverse 12s linear infinite" }}>
            <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-fuchsia-200 shadow-[0_0_12px_rgba(232,121,249,.9)]" />
          </div>
          <div className="relative z-10" style={{ animation: "chatwork-breathe 3s ease-in-out infinite" }}>
            <LottieSearchIcon size={132} />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2">
          <span className={`h-2 w-2 rounded-full ${callState === 'speaking' ? 'bg-cyan-300' : callState === 'thinking' ? 'bg-amber-300' : 'bg-emerald-400'}`} style={{ animation: 'chatwork-pulse 1.6s ease-in-out infinite' }} />
          <span className="text-sm font-medium tracking-wide text-white/65">
            {callState === 'speaking' ? 'AI is speaking' : callState === 'thinking' ? 'AI is thinking' : activeRef.current ? 'Call connected' : 'Ready to call'}
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">ChatWork</h1>
        <p className="mt-1 text-sm text-cyan-100/45">AI Voice Call</p>
        <div className="mt-10 w-full">
          {!activeRef.current ? (
            <Button onClick={startCall} className="h-14 w-full rounded-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-500">
              <Mic className="mr-2 h-5 w-5" />
              Start AI Call
            </Button>
          ) : (
            <button type="button" onClick={endCall} className="mx-auto flex h-14 min-w-[170px] items-center justify-center gap-3 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-8 text-base font-semibold text-white shadow-[0_10px_36px_rgba(239,68,68,.35)] ring-1 ring-white/10 transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_12px_42px_rgba(239,68,68,.45)] active:scale-95" aria-label="End call">
              <PhoneOff className="h-5 w-5" />
              <span>End Call</span>
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
