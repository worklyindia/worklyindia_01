import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AudioLines, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import VerificationBadge from '@/components/VerificationBadge';
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
  const [callDuration, setCallDuration] = useState(0);
  const connectedAtRef = useRef<number | null>(null);
  const [lastReply, setLastReply] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [muted, setMuted] = useState(false);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [voiceStage, setVoiceStage] = useState('Waiting for microphone…');
  const [micLevel, setMicLevel] = useState(0);
  const [aiRequestStatus, setAiRequestStatus] = useState('Not sent');
  const activeRef = useRef(false);
  const startingCallRef = useRef(false);
  const partialFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmittedTranscriptRef = useRef('');
  const conversationTurnRef = useRef(0);
  const aiName = settings?.name || 'Workly India AI';
  const showBadge = settings?.verification_enabled;
  const badgeColor = (settings?.verification_color || 'blue') as 'gold' | 'blue' | 'green' | 'silver';
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
    return speakBrowserLocalReply(text, resolvedLanguage);
  }, [bridge]);
  const stopReply = useCallback(() => {
    if (bridge) bridge.stopVoiceReply?.();
    else stopBrowserLocalReply();
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
    connectedAtRef.current = null;
    setCallDuration(0);
    setVoiceStage('Call ended');
    setMicLevel(0);
    setAiRequestStatus('Not sent');
    setLastReply('');
    setLastTranscript('');
    setPartialTranscript('');
    setErrorMessage('');
    setMuted(false);
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
      if (!spoken) throw new Error('Phone text-to-speech is unavailable.');
      setCallState('speaking');
      setVoiceStage('TTS playback started');
    } catch (error) {
      if (!activeRef.current || turnId !== conversationTurnRef.current) return;
      const message = error instanceof Error ? error.message : 'Voice reply failed. Please try again.';
      setErrorMessage(message);
      setAiRequestStatus((current) => current === 'Sending' ? 'Request failed' : current);
      setVoiceStage(`Error: ${message}`);
      setCallState('error');
      toast.error(message);
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
      connectedAtRef.current = Date.now();
      setCallDuration(0);
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

  useEffect(() => {
    if (!activeRef.current || !connectedAtRef.current) return;
    const timer = window.setInterval(() => {
      if (connectedAtRef.current) setCallDuration(Math.floor((Date.now() - connectedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callState]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (next) {
      stopRecognition();
      stopReply();
    } else if (activeRef.current) {
      startRecognition('auto');
      setCallState('listening');
    }
  };

  const formattedDuration = `${String(Math.floor(callDuration / 60)).padStart(2, '0')}:${String(callDuration % 60).padStart(2, '0')}`;
  const callStatus = callState === 'listening' ? 'Connected' : callState === 'thinking' ? 'Calling…' : callState === 'speaking' ? 'Workly AI speaking' : callState === 'error' ? 'Call failed' : 'Ready to call';

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#111827] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_28%,rgba(59,130,246,0.20),transparent_54%)]" />
      <header className="relative z-10 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <Button variant="ghost" size="icon" onClick={() => { endCall(); navigate('/ai-assistant'); }} aria-label="Back to AI Chat" className="text-white/80 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold tracking-wide text-white">Workly India</p>
          <p className="text-[11px] text-white/45">AI calling</p>
        </div>
        <span className="h-10 w-10" aria-hidden="true" />
      </header>
      <section className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-7 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
        <div className="flex flex-1 flex-col items-center justify-center pb-8">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-[#2875D8] to-[#5146A8] shadow-[0_12px_48px_rgba(37,99,235,0.32)] ring-4 ring-white/10">
            <AudioLines className="h-14 w-14 text-white" strokeWidth={1.8} />
            {activeRef.current && <span className="absolute inset-0 rounded-full border border-white/35 animate-ping" />}
          </div>
          <div className="mt-7 flex items-center justify-center gap-2">
            <h1 className="text-[27px] font-semibold tracking-tight">{aiName}</h1>
            {showBadge && <VerificationBadge color={badgeColor} size={17} />}
          </div>
          <p className="mt-2 text-sm text-white/55">Workly India</p>
          <p className="mt-8 text-base font-medium text-white/90" aria-live="polite">{callStatus}</p>
          {activeRef.current && <p className="mt-2 font-mono text-sm tabular-nums tracking-widest text-white/60">{formattedDuration}</p>}
          {!activeRef.current && callState === 'idle' && <p className="mt-2 text-xs text-white/40">Tap the green button to start your AI call</p>}
          {errorMessage && (
            <div role="alert" className="mt-6 w-full rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-left text-sm text-red-100">
              <p className="font-semibold">Call failed</p>
              <p className="mt-1 break-words text-xs leading-5 text-red-100/80">{errorMessage}</p>
            </div>
          )}
        </div>
        {activeRef.current ? (
          <div className="w-full">
            <div className="mb-10 grid grid-cols-2 gap-x-10 gap-y-7 px-5">
              <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} className="mx-auto flex w-24 flex-col items-center gap-2 text-white/85">
                <span className={`flex h-[66px] w-[66px] items-center justify-center rounded-full ${muted ? 'bg-white text-slate-900' : 'border border-white/10 bg-white/10'}`}>
                  {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </span>
                <span className="text-xs">{muted ? 'Unmute' : 'Mute'}</span>
              </button>
              <div className="mx-auto flex w-24 flex-col items-center gap-2 text-white/45" aria-label="Speaker output uses phone audio settings">
                <span className="flex h-[66px] w-[66px] items-center justify-center rounded-full border border-white/10 bg-white/10">
                  <Volume2 className="h-6 w-6" />
                </span>
                <span className="text-xs">Phone audio</span>
              </div>
            </div>
            <button type="button" onClick={endCall} aria-label="End AI call" className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#E5484D] text-white shadow-lg shadow-red-950/40 active:scale-95">
              <PhoneOff className="h-7 w-7" />
            </button>
            <p className="mt-3 text-xs font-medium text-white/65">End call</p>
          </div>
        ) : (
          <div className="w-full pb-2">
            <Button onClick={startCall} className="h-[62px] w-full rounded-full bg-[#20A464] text-base font-semibold text-white shadow-lg shadow-green-950/30 hover:bg-[#198653]">
              <Mic className="mr-2 h-5 w-5" /> Start AI Call
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
