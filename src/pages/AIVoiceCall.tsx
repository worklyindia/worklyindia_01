import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AudioLines, Mic, MicOff, PhoneOff, ShieldCheck, Volume2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import VerificationBadge from '@/components/VerificationBadge';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';
import { getWorklyAndroidBridge } from '@/lib/nativeAppBridge';
import { supabase } from '@/integrations/supabase/client';
import { isBrowserLocalVoiceAvailable, isBrowserOnDeviceVoiceAvailable, startBrowserLocalRecognition, stopBrowserLocalRecognition, speakBrowserLocalReply, stopBrowserLocalReply } from '@/lib/browserOfflineVoice';
import { prepareKokoroTts, speakKokoroTts, stopKokoroTts, isKokoroLanguageSupported } from '@/lib/kokoroTts';
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
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [browserOnDeviceAvailable, setBrowserOnDeviceAvailable] = useState(false);
  const [browserRemoteAllowed, setBrowserRemoteAllowed] = useState(false);
  const [voiceStage, setVoiceStage] = useState('Waiting for microphone…');
  const [micLevel, setMicLevel] = useState(0);
  const [aiRequestStatus, setAiRequestStatus] = useState('Not sent');
  const [kokoroEnabled, setKokoroEnabled] = useState(() => { try { return localStorage.getItem('workly_kokoro_enabled') === 'true'; } catch { return false; } });
  const [kokoroStatus, setKokoroStatus] = useState('not-ready');
  const [kokoroMessage, setKokoroMessage] = useState('Optional on-device neural voice · about 295 MB first download');
  const [shrutiEnabled, setShrutiEnabled] = useState(() => { try { return localStorage.getItem('workly_shruti_enabled') === 'true'; } catch { return false; } });
  const [shrutiStatus, setShrutiStatus] = useState('not-ready');
  const [shrutiMessage, setShrutiMessage] = useState('On-device Hindi, English and Hinglish speech-to-text · about 29.5 MB first download');
  const [isNativeApp] = useState(() => !!getWorklyAndroidBridge());
  const activeRef = useRef(false);
  const browserRemoteAllowedRef = useRef(false);
  const partialFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmittedTranscriptRef = useRef('');
  const conversationTurnRef = useRef(0);
  const aiName = settings?.name || 'Workly India AI';
  const showBadge = settings?.verification_enabled;
  const badgeColor = (settings?.verification_color || 'blue') as 'gold' | 'blue' | 'green' | 'silver';
  const bridge = getWorklyAndroidBridge();
  const startRecognition = useCallback((language = 'auto') => {
    if (shrutiEnabled) {
      void startShrutiRecognition().catch((error) => window.dispatchEvent(new CustomEvent('workly-voice-error', { detail: { message: error instanceof Error ? error.message : 'Shruti microphone could not start.' } })));
      return true;
    }
    if (bridge) return bridge.startOnDeviceVoiceRecognition?.(language) ?? false;
    void startBrowserLocalRecognition(navigator.language || 'en-US', browserRemoteAllowedRef.current).catch((error) => {
      window.dispatchEvent(new CustomEvent('workly-voice-error', { detail: { message: error instanceof Error ? error.message : 'Local browser speech recognition failed.' } }));
    });
    return true;
  }, [bridge, shrutiEnabled]);
  const stopRecognition = useCallback(() => {
    if (shrutiEnabled) stopShrutiRecognition();
    else if (bridge) bridge.stopOnDeviceVoiceRecognition?.();
    else stopBrowserLocalRecognition();
  }, [bridge, shrutiEnabled]);
  const speakReply = useCallback(async (text: string, language: string) => {
    const resolvedLanguage = language === 'und' ? (navigator.language || 'en-US') : language;
    if (kokoroEnabled && isKokoroLanguageSupported(resolvedLanguage)) {
      try {
        const spoken = await speakKokoroTts(text, resolvedLanguage);
        if (spoken) return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Kokoro voice failed; using the phone voice instead.';
        setKokoroStatus('error');
        setKokoroMessage(message);
      }
    }
    if (bridge) return bridge.speakVoiceReply?.(text, language) ?? false;
    return speakBrowserLocalReply(text, resolvedLanguage);
  }, [bridge, kokoroEnabled]);
  const stopReply = useCallback(() => {
    stopKokoroTts();
    if (bridge) bridge.stopVoiceReply?.();
    else stopBrowserLocalReply();
  }, [bridge]);
  const recognitionAvailable = useCallback(() => shrutiEnabled || (bridge ? !!bridge.isOnDeviceVoiceRecognitionAvailable?.() : isBrowserLocalVoiceAvailable()), [bridge, shrutiEnabled]);

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
      if (detail?.status) setShrutiStatus(detail.status);
      if (detail?.status === 'downloading' && detail.total) setShrutiMessage('Downloading Shruti · ' + (detail.loaded / 1e6).toFixed(1) + ' / ' + (detail.total / 1e6).toFixed(1) + ' MB');
      else if (detail?.status === 'ready') { setNativeAvailable(true); setShrutiMessage('Shruti is ready. Hindi, English and Hinglish speech is processed on this device.'); }
      else if (detail?.status === 'listening') setShrutiMessage('Microphone is listening locally. Audio stays on this device.');
      else if (detail?.status === 'transcribing') setShrutiMessage('Converting speech to text on this device…');
      else if (detail?.status === 'error') setShrutiMessage(detail.message || 'Shruti could not start.');
    };
    window.addEventListener('workly-shruti-status', handleShrutiStatus);
    const handleKokoroStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: string; message?: string }>).detail;
      if (detail?.status) setKokoroStatus(detail.status);
      if (detail?.message) setKokoroMessage(detail.message);
      if (detail?.status === 'ready') {
        setKokoroEnabled(true);
        try { localStorage.setItem('workly_kokoro_enabled', 'true'); } catch { /* storage may be disabled */ }
      }
    };
    window.addEventListener('workly-kokoro-status', handleKokoroStatus);
    return () => { window.removeEventListener('workly-kokoro-status', handleKokoroStatus); window.removeEventListener('workly-shruti-status', handleShrutiStatus); };
  }, []);

  const enableShruti = async () => {
    try {
      setShrutiStatus('downloading');
      setShrutiMessage('Downloading and verifying the 29.5 MB Shruti model. Keep this page open.');
      await prepareShrutiRecognition();
      setShrutiEnabled(true);
      setNativeAvailable(true);
      setShrutiStatus('ready');
      setShrutiMessage('Shruti is ready. Hindi, English and Hinglish speech-to-text is on-device.');
      try { localStorage.setItem('workly_shruti_enabled', 'true'); } catch { /* storage may be disabled */ }
      toast.success('Shruti offline speech-to-text is ready.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load Shruti on this device.';
      setShrutiStatus('error');
      setShrutiMessage(message);
      toast.error(message);
    }
  };

  const enableKokoro = async () => {
    try {
      setKokoroStatus('downloading');
      setKokoroMessage('Loading Kokoro-82M. The first download is about 295 MB; keep this page open.');
      await prepareKokoroTts();
      setKokoroEnabled(true);
      setKokoroStatus('ready');
      setKokoroMessage('Kokoro-82M is ready. Hindi and English replies can now use local neural speech.');
      try { localStorage.setItem('workly_kokoro_enabled', 'true'); } catch { /* storage may be disabled */ }
      toast.success('Kokoro voice is ready.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load Kokoro voice on this device.';
      setKokoroStatus('error');
      setKokoroMessage(message);
      toast.error(message);
    }
  };

  useEffect(() => {
    // Warm browser speech voices before the first AI reply needs playback.
    if (!bridge && 'speechSynthesis' in window) window.speechSynthesis.getVoices();
    setNativeAvailable(bridge ? recognitionAvailable() : false);
    setBrowserOnDeviceAvailable(!bridge && isBrowserOnDeviceVoiceAvailable());
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
  }, [bridge, recognitionAvailable, stopRecognition, stopReply, handleTranscript, handlePartialTranscript, handleNativeStatus, handleNativeError, handleBargeIn]);

  const startCall = async () => {
    if (!user) { toast.error('Please log in to use AI voice calls.'); return; }
    // Native Android must be allowed to enter its permission flow first.
    // Android will report a precise on-device recognizer error after permission
    // is granted if the phone does not provide a compatible offline service.
    if (!bridge && !recognitionAvailable()) {
      setNativeAvailable(false);
      toast.error('Speech recognition is not supported in this browser. Please use the latest Chrome or Edge.');
      return;
    }
    if (!bridge && !shrutiEnabled) {
      const accepted = window.confirm('Workly India will prefer on-device speech recognition. If your browser does not have a supported offline language pack, its speech service may process microphone audio to transcribe your words. Workly India does not record or store call audio. Continue?');
      if (!accepted) return;
      browserRemoteAllowedRef.current = true;
      setBrowserRemoteAllowed(true);
    }
    try {
      // Shruti captures audio in the shared WebView page. The legacy native
      // SpeechRecognizer path keeps its existing permission and microphone flow.
      if (!bridge && !shrutiEnabled) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
      activeRef.current = true;
      if (partialFinalizeTimerRef.current) clearTimeout(partialFinalizeTimerRef.current);
      partialFinalizeTimerRef.current = null;
      lastSubmittedTranscriptRef.current = '';
      setLastReply('');
      setLastTranscript('');
      setPartialTranscript('');
      setErrorMessage('');
      setCallState('listening');
      setVoiceStage(shrutiEnabled ? 'Starting Shruti on-device microphone…' : bridge ? 'Starting on-device microphone…' : browserOnDeviceAvailable ? 'Starting browser on-device microphone…' : 'Starting browser speech service…');
      setMicLevel(0);
      setAiRequestStatus('Not sent');
      if (!startRecognition('auto')) {
        activeRef.current = false;
        setVoiceStage('Could not start speech recognition');
        setErrorMessage('Could not start speech recognition. Check microphone permission and browser speech settings, then try again.');
        setCallState('error');
        toast.error('Could not start on-device speech recognition.');
      }
    } catch {
      activeRef.current = false;
      setErrorMessage('Microphone permission was denied. Allow microphone access in app settings, then try again.');
      setCallState('error');
      toast.error('Microphone permission was denied. Allow microphone access in app settings.');
    }
  };

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

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#080D1B] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(37,99,235,0.24),transparent_48%)]" />
      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <Button variant="ghost" size="icon" onClick={() => { endCall(); navigate('/ai-assistant'); }} aria-label="Back to AI Chat" className="text-white hover:bg-white/10 hover:text-white"><ArrowLeft className="h-5 w-5" /></Button>
        <div className="text-center"><p className="text-xs font-medium uppercase tracking-[0.22em] text-blue-200/70">Workly India</p><p className="mt-1 text-sm text-white/70">AI Voice Call</p></div>
        <span className="h-10 w-10" aria-hidden="true" />
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pt-6 pb-8 text-center">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-blue-400/15" />
          <div className="absolute inset-3 rounded-full border border-blue-400/20" />
          <div className="absolute inset-6 rounded-full bg-blue-500/10 blur-xl" />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_12px_60px_rgba(37,99,235,0.42)] ring-1 ring-white/20"><AudioLines className="h-14 w-14 text-white" strokeWidth={2.1} /></div>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">{aiName}</h1>{showBadge && <VerificationBadge color={badgeColor} size={17} />}</div>
        <p className="mt-2 text-sm text-blue-100/65">Voice assistant</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70">
          <span className={`h-2 w-2 rounded-full ${callState === 'listening' ? 'bg-emerald-400 animate-pulse' : callState === 'thinking' ? 'bg-amber-300 animate-pulse' : callState === 'speaking' ? 'bg-blue-300 animate-pulse' : 'bg-white/30'}`} />
          {callState === 'listening' ? 'Listening on this device' : callState === 'thinking' ? 'AI is thinking…' : callState === 'speaking' ? 'AI is speaking' : callState === 'error' ? 'Call needs attention' : 'Ready to call'}
        </div>

        {activeRef.current && <div className="mt-4 w-full rounded-xl border border-cyan-300/20 bg-cyan-400/[0.06] px-4 py-3 text-left" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-100/80">Live voice diagnostics</p>
          <p className="mt-2 text-xs text-white/80">Microphone / recognition: {voiceStage}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${micLevel}%` }} /></div>
          <p className="mt-2 text-xs text-white/65">AI request: {aiRequestStatus}</p>
          <p className="mt-1 text-[10px] text-white/40">{isNativeApp || !browserRemoteAllowed ? 'Only recognized speech text is sent to AI. Workly India does not save call audio.' : 'Your browser speech service may process microphone audio to create text. Workly India does not record or store call audio; only recognized text is sent to AI.'}</p>
        </div>}

        {errorMessage && <div role="alert" className="mt-4 w-full rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-left text-sm text-red-100"><p className="font-semibold">Voice call error</p><p className="mt-1 break-words text-xs leading-5 text-red-100/80">{errorMessage}</p></div>}

        <div className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Automatic language detection</p>
          <p className="mt-2 text-sm text-white/70">Speak naturally in Hindi, English or Hinglish. When Shruti is enabled, speech is converted to text on this device.</p>
        </div>

        <div className="mt-5 w-full rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.06] p-4 text-left">
          <div className="flex items-center gap-2"><AudioLines className="h-5 w-5 text-cyan-200" /><p className="text-sm font-semibold">Shruti Offline Speech-to-Text</p><span className="ml-auto text-[10px] text-cyan-100/65">{shrutiEnabled ? "Enabled" : shrutiStatus === "downloading" ? "Loading" : "Optional"}</span></div>
          <p className="mt-2 text-xs leading-5 text-white/60">{shrutiMessage}</p>
          <p className="mt-1 text-[11px] leading-5 text-white/45">Hindi, English and Hinglish · first download about 29.5 MB · works offline after download. Shared by the website and Android app WebView. Microphone audio is processed locally; only recognized text is sent to AI.</p>
          <Button onClick={enableShruti} disabled={shrutiStatus === "downloading" || shrutiStatus === "transcribing"} className="mt-3 h-11 w-full rounded-xl bg-cyan-700 text-sm font-semibold text-white hover:bg-cyan-600">
            {shrutiEnabled ? "Reload Shruti model" : shrutiStatus === "downloading" ? "Downloading Shruti…" : "Download & enable Shruti (≈29.5 MB)"}
          </Button>
          {shrutiEnabled && <button type="button" onClick={() => { stopShrutiRecognition(); setShrutiEnabled(false); try { localStorage.setItem("workly_shruti_enabled", "false"); } catch { /* storage may be disabled */ } setShrutiMessage("Shruti is disabled. The existing speech recognizer will be used."); }} className="mt-2 min-h-11 w-full text-xs text-white/55 underline underline-offset-4">Use existing speech recognition</button>}
        </div>
        <div className="mt-5 w-full rounded-2xl border border-violet-300/20 bg-violet-400/[0.06] p-4 text-left">
          <div className="flex items-center gap-2"><AudioLines className="h-5 w-5 text-violet-200" /><p className="text-sm font-semibold">Kokoro-82M Neural Voice</p><span className="ml-auto text-[10px] text-violet-100/65">{kokoroEnabled ? 'Enabled' : kokoroStatus === 'downloading' ? 'Loading' : 'Optional'}</span></div>
          <p className="mt-2 text-xs leading-5 text-white/60">{kokoroMessage}</p>
          <p className="mt-1 text-[11px] leading-5 text-white/45">Runs on this device in the Android app and website. The model is downloaded only after you tap below; it is not included in the APK. Hindi and English are supported. Gujarati uses the existing voice.</p>
          <Button onClick={enableKokoro} disabled={kokoroStatus === 'downloading' || kokoroStatus === 'synthesizing'} className="mt-3 h-11 w-full rounded-xl bg-violet-600 text-sm font-semibold text-white hover:bg-violet-500">
            {kokoroEnabled ? 'Reload Kokoro voice' : kokoroStatus === 'downloading' ? 'Loading Kokoro model…' : 'Download & enable Kokoro (≈295 MB)'}
          </Button>
          {kokoroEnabled && <button type="button" onClick={() => { setKokoroEnabled(false); try { localStorage.setItem('workly_kokoro_enabled', 'false'); } catch { /* storage may be disabled */ } setKokoroMessage('Kokoro is disabled. The existing device voice will be used.'); }} className="mt-2 min-h-11 w-full text-xs text-white/55 underline underline-offset-4">Use existing voice instead</button>}
        </div>

        <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300" /><p className="text-sm font-semibold">Voice privacy</p><span className="ml-auto text-xs text-white/50">{nativeAvailable ? 'On-device mic ready' : isNativeApp ? 'Offline speech setup needed' : browserOnDeviceAvailable ? 'Browser local speech available' : 'Browser speech service'}</span></div>
          <p className="mt-2 text-xs leading-5 text-white/55">{nativeAvailable ? 'Audio is recognized on your phone. Only recognized text is sent to the AI provider. Workly India does not save call audio, transcript or AI replies in chat history, database or storage. Provider retention is governed by that provider.' : isNativeApp ? 'This phone is not currently reporting a supported on-device speech recognizer. The call will not start and microphone audio will not be sent to a speech-to-text service. Enable or install offline speech recognition and language data in Android settings, then reopen this page.' : browserOnDeviceAvailable ? 'This browser supports on-device recognition when the selected language pack is installed. If unavailable, install the pack or allow browser speech service as an alternative. Workly India does not record or store call audio.' : 'Website voice calls use your browser speech-recognition service to transcribe speech. Depending on the browser, microphone audio may be processed by that browser provider. Workly India does not record or store call audio; recognized text is sent to the AI provider for replies.'}</p>
          {(lastTranscript || partialTranscript || lastReply) && <div className="mt-3 space-y-2 rounded-xl bg-black/20 p-3"><p className="text-[11px] text-white/45">Current call only · not saved</p>{(lastTranscript || partialTranscript) && <p className="text-xs text-white/65">You: {lastTranscript || partialTranscript}</p>}{partialTranscript && !lastTranscript && <p className="text-[10px] text-amber-200/70">Hearing your words…</p>}{lastReply && <p className="text-sm text-white">AI: {lastReply}</p>}</div>}
        </div>

        <div className="mt-auto w-full pt-8">
          <div className="mb-5 flex items-center justify-center gap-7">
            <button type="button" onClick={toggleMute} disabled={!activeRef.current} className="flex flex-col items-center gap-2 text-white/70 disabled:text-white/30"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</span><span className="text-[11px]">{muted ? 'Unmute' : 'Mute'}</span></button>
            <div className="flex flex-col items-center gap-2 text-white/35"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5"><Volume2 className="h-5 w-5" /></span><span className="text-[11px]">Speaker</span></div>
            <button type="button" onClick={endCall} disabled={!activeRef.current} className="flex flex-col items-center gap-2 text-white/70 disabled:text-white/30"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-300"><PhoneOff className="h-5 w-5" /></span><span className="text-[11px]">End call</span></button>
          </div>
          {!activeRef.current ? <Button onClick={startCall} className="h-14 w-full rounded-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-500"><Mic className="mr-2 h-5 w-5" />Start AI Call</Button> : <div className="flex h-14 w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-medium text-white/70">{callState === 'thinking' ? 'AI is preparing a reply…' : callState === 'speaking' ? 'Listening will resume automatically' : callState === 'listening' ? 'Speak naturally — I’m listening' : 'Call connected'}</div>}
          <div className="mt-4 flex items-start justify-center gap-2 px-2 text-left text-[11px] leading-5 text-white/40"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span>{isNativeApp ? 'Requires a compatible offline speech recognizer and downloaded language data, plus internet for AI replies. Language coverage and voices depend on your phone.' : browserOnDeviceAvailable ? 'The website prefers on-device speech recognition. If your browser has no local language pack, install it or allow the browser speech service when prompted.' : 'The website uses the browser speech service after you approve it. Microphone permission and browser speech-service support are required.'}</span></div>
        </div>
      </section>
      
    </main>
  );
}
