import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, PhoneOff, ShieldCheck, Volume2, VolumeX, Info } from 'lucide-react';
import LottieSearchIcon from '@/components/LottieSearchIcon';
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
  const aiName = 'ChatWork';
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
        window.dispatchEvent(new CustomEvent('workly-voice-error', { detail: { message: 'Voice playback could not start. Please try again.' } }));
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(37,99,235,0.24),transparent_48%)]" />
      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <Button variant="ghost" size="icon" onClick={() => { endCall(); navigate('/ai-assistant'); }} aria-label="Back to AI Chat" className="text-white hover:bg-white/10 hover:text-white"><ArrowLeft className="h-5 w-5" /></Button>
        <span className="h-10 w-10" aria-hidden="true" />
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pt-6 pb-8 text-center">
        <div className="relative flex h-40 w-40 items-center justify-center">
          <LottieSearchIcon size={132} className="relative z-10" />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">ChatWork</h1>{showBadge && <VerificationBadge color={badgeColor} size={17} />}</div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70">
          <span className={`h-2 w-2 rounded-full ${callState === 'listening' ? 'bg-emerald-400 animate-pulse' : callState === 'thinking' ? 'bg-amber-300 animate-pulse' : callState === 'speaking' ? 'bg-blue-300 animate-pulse' : 'bg-white/30'}`} />
          {callState === 'listening' ? 'Listening on this device' : callState === 'thinking' ? 'AI is thinking…' : callState === 'speaking' ? 'AI is speaking' : callState === 'error' ? 'Call needs attention' : 'Ready to call'}
        </div>

        {activeRef.current && <div className="mt-4 w-full rounded-xl border border-cyan-300/20 bg-cyan-400/[0.06] px-4 py-3 text-left" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-100/80">Live voice diagnostics</p>
          <p className="mt-2 text-xs text-white/80">Microphone / recognition: {voiceStage}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${micLevel}%` }} /></div>
          <p className="mt-2 text-xs text-white/65">AI request: {aiRequestStatus}</p>
          <p className="mt-1 text-[10px] text-white/40">Only recognized speech text is sent to AI. Workly India does not save call audio.</p>
        </div>}

        {errorMessage && <div role="alert" className="mt-4 w-full rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-left text-sm text-red-100"><p className="font-semibold">Voice call error</p><p className="mt-1 break-words text-xs leading-5 text-red-100/80">{errorMessage}</p></div>}

        <div className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Automatic language detection</p>
          <p className="mt-2 text-sm text-white/70">Speak naturally. Speech is converted to text on this device.</p>
        </div>

        <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300" /><p className="text-sm font-semibold">Voice privacy</p><span className="ml-auto text-xs text-white/50">{nativeAvailable ? 'On-device mic ready' : 'On-device speech'}</span></div>
          <p className="mt-2 text-xs leading-5 text-white/55">Shruti converts speech to text on this device. Only recognized text is sent to the AI provider. Workly India does not save call audio or transcripts.</p>
          {(lastTranscript || partialTranscript || lastReply) && <div className="mt-3 space-y-2 rounded-xl bg-black/20 p-3"><p className="text-[11px] text-white/45">Current call only · not saved</p>{(lastTranscript || partialTranscript) && <p className="text-xs text-white/65">You: {lastTranscript || partialTranscript}</p>}{partialTranscript && !lastTranscript && <p className="text-[10px] text-amber-200/70">Hearing your words…</p>}{lastReply && <p className="text-sm text-white">AI: {lastReply}</p>}</div>}
        </div>

        <div className="mt-auto w-full pt-8">
          <div className="mb-5 grid grid-cols-3 items-start justify-items-center gap-6">
            <button type="button" onClick={toggleMute} disabled={!activeRef.current} className="flex flex-col items-center gap-2 text-white/80 disabled:text-white/30"><span className={`flex h-14 w-14 items-center justify-center rounded-full border border-white/10 ${muted ? 'bg-blue-500/80' : 'bg-white/5'}`}>{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</span><span className="text-[11px]">{muted ? 'Unmute' : 'Mute'}</span></button>
            <button type="button" onClick={toggleSpeaker} disabled={!activeRef.current} className="flex flex-col items-center gap-2 text-white/80 disabled:text-white/30"><span className={`flex h-14 w-14 items-center justify-center rounded-full border border-white/10 ${speakerOn ? 'bg-blue-500/80' : 'bg-white/5'}`}>{speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</span><span className="text-[11px]">{speakerOn ? 'Speaker on' : 'Speaker off'}</span></button>
            <button type="button" onClick={endCall} disabled={!activeRef.current} className="flex flex-col items-center gap-2 text-white/80 disabled:text-white/30"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-300"><PhoneOff className="h-5 w-5" /></span><span className="text-[11px]">End call</span></button>
          </div>
          {!activeRef.current ? <Button onClick={startCall} className="h-14 w-full rounded-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-500"><Mic className="mr-2 h-5 w-5" />Start AI Call</Button> : <div className="flex h-14 w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-medium text-white/70">{callState === 'thinking' ? 'AI is preparing a reply…' : callState === 'speaking' ? 'Listening will resume automatically' : callState === 'listening' ? 'Speak naturally — I’m listening' : 'Call connected'}</div>}
          <div className="mt-4 flex items-start justify-center gap-2 px-2 text-left text-[11px] leading-5 text-white/40"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span>Shruti runs on this device. Internet is required for AI replies and reliable voice playback.</span></div>
        </div>
      </section>
      
    </main>
  );
}
