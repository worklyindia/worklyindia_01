import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AudioLines, Mic, MicOff, PhoneOff, ShieldCheck, Volume2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import VerificationBadge from '@/components/VerificationBadge';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';
import { getWorklyAndroidBridge } from '@/lib/nativeAppBridge';
import { callAICareerChat } from '@/lib/aiChatTransport';
import { chatStorage, type StoredMessage } from '@/lib/chatStorage';
import { speakBrowserLocalReply, stopBrowserLocalReply } from '@/lib/browserOfflineVoice';
import { prepareShrutiRecognition, startShrutiRecognition, stopShrutiRecognition } from '@/lib/shrutiSpeech';

type CallState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export default function AIVoiceCall() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedAudience = searchParams.get('audience');
  const chatAudience = requestedAudience === 'employer' || requestedAudience === 'developer' ? requestedAudience : 'job_seeker';
  const { user } = useAuth();
  const { data: settings } = useAIChatSettings();
  const [callState, setCallState] = useState<CallState>('idle');
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
  const prepareVoiceOutput = useCallback(async () => {
    if (!bridge?.prepareVoiceTts) return;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        window.removeEventListener('workly-tts-ready', handleReady);
        if (error) reject(error);
        else resolve();
      };
      const handleReady = (event: Event) => {
        const detail = (event as CustomEvent<{ ready?: boolean; message?: string }>).detail;
        if (detail?.ready) finish();
        else finish(new Error(detail?.message || 'Hindi and English TTS voices are not ready.'));
      };
      const timeout = window.setTimeout(() => finish(new Error('Voice language setup timed out. Please try again.')), 240000);
      window.addEventListener('workly-tts-ready', handleReady);
      if (!bridge.prepareVoiceTts?.()) finish(new Error('Could not prepare Hindi and English voice data.'));
    });
  }, [bridge]);
  const speakReply = useCallback(async (text: string, language: string) => {
    const supportedLanguage = language.toLowerCase().startsWith('hi') ? 'hi-IN' : 'en-IN';
    if (bridge) return bridge.speakVoiceReply?.(text, supportedLanguage) ?? false;
    return speakBrowserLocalReply(text, supportedLanguage);
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
    if (!activeRef.current || !user?.id) return;
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
    setVoiceStage('Sending your message to Workly AI Chat…');
    setAiRequestStatus('Sending');
    const userMessage: StoredMessage = {
      id: `voice-user-${crypto.randomUUID()}`,
      role: 'user',
      content: transcript,
      timestamp: new Date().toISOString(),
      status: 'sent',
    };
    try {
      chatStorage.setCurrentUserId(user.id);
      chatStorage.setAudience(chatAudience === 'developer' ? 'developer' : 'default');
      const history = chatStorage.loadMessages().filter((message) => message.role === 'user' || message.role === 'assistant');
      const nextHistory = [...history, userMessage];
      chatStorage.saveMessages(nextHistory);
      const result = await callAICareerChat(
        {
          messages: nextHistory.map(({ role, content }) => ({ role, content })),
          user_id: user.id,
          audience: chatAudience,
          hasImages: false,
          currentPage: '/ai-assistant',
          pageContext: { path: '/ai-assistant', page: 'AI Chat', audience: chatAudience },
          voiceMode: true,
        },
        {
          onStatus: (status) => { if (activeRef.current && turnId === conversationTurnRef.current) setVoiceStage(status); },
          onProgressMessage: (status) => { if (activeRef.current && turnId === conversationTurnRef.current) setVoiceStage(status); },
        },
      );
      const reply = result.fullText.trim();
      if (!reply) throw new Error('Workly AI Chat returned an empty reply.');
      const assistantMessage: StoredMessage = {
        id: `voice-ai-${crypto.randomUUID()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };
      chatStorage.saveMessages([...nextHistory, assistantMessage]);
      setAiRequestStatus('Reply received');
      setVoiceStage('AI Chat reply received; starting speech playback…');
      if (!activeRef.current || turnId !== conversationTurnRef.current) return;
      setLastReply(reply);
      const spoken = await speakReply(reply, /[\\u0900-\\u097F]/.test(reply) ? 'hi-IN' : 'en-IN');
      if (!spoken) throw new Error('Phone text-to-speech is unavailable.');
      setCallState('speaking');
      setVoiceStage('TTS playback started');
    } catch (error) {
      chatStorage.saveMessages(chatStorage.loadMessages().map((message) =>
        message.id === userMessage.id ? { ...message, status: 'failed' as const } : message
      ));
      if (!activeRef.current || turnId !== conversationTurnRef.current) return;
      const message = error instanceof Error ? error.message : 'AI Chat voice reply failed. Please try again.';
      setErrorMessage(message);
      setAiRequestStatus((current) => current === 'Sending' ? 'Request failed' : current);
      setVoiceStage(`Error: ${message}`);
      setCallState('error');
      toast.error(message);
    }
  }, [speakReply, user?.id, chatAudience]);

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
      chatStorage.setCurrentUserId(user.id);
      chatStorage.setAudience(chatAudience === 'developer' ? 'developer' : 'default');
      // Prepare both supported speech outputs before starting the call.
      setVoiceStage('Checking Hindi and English voice data…');
      await prepareVoiceOutput();
      // Load the offline recognition model only after the user taps Start AI Call.
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
      const message = error instanceof Error ? error.message : 'Hindi and English voice setup or Shruti could not start. Check permissions and try again.';
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
          <p className="mt-1 text-[10px] text-white/40">Only recognized speech text is sent to Workly AI Chat. Call audio is not saved.</p>
        </div>}

        {errorMessage && <div role="alert" className="mt-4 w-full rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-left text-sm text-red-100"><p className="font-semibold">Voice call error</p><p className="mt-1 break-words text-xs leading-5 text-red-100/80">{errorMessage}</p></div>}

        <div className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Automatic language detection</p>
          <p className="mt-2 text-sm text-white/70">Speak naturally. Speech is converted to text on this device.</p>
        </div>

        <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300" /><p className="text-sm font-semibold">Voice privacy</p><span className="ml-auto text-xs text-white/50">{nativeAvailable ? 'On-device mic ready' : 'On-device speech'}</span></div>
          <p className="mt-2 text-xs leading-5 text-white/55">Shruti converts speech to text on this device. Recognized messages and AI replies are saved in your AI Chat history. Call audio is not saved.</p>
          {(lastTranscript || partialTranscript || lastReply) && <div className="mt-3 space-y-2 rounded-xl bg-black/20 p-3"><p className="text-[11px] text-white/45">Saved in AI Chat history</p>{(lastTranscript || partialTranscript) && <p className="text-xs text-white/65">You: {lastTranscript || partialTranscript}</p>}{partialTranscript && !lastTranscript && <p className="text-[10px] text-amber-200/70">Hearing your words…</p>}{lastReply && <p className="text-sm text-white">AI: {lastReply}</p>}</div>}
        </div>

        <div className="mt-auto w-full pt-8">
          <div className="mb-5 flex items-center justify-center gap-7">
            <button type="button" onClick={toggleMute} disabled={!activeRef.current} className="flex flex-col items-center gap-2 text-white/70 disabled:text-white/30"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</span><span className="text-[11px]">{muted ? 'Unmute' : 'Mute'}</span></button>
            <div className="flex flex-col items-center gap-2 text-white/35"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5"><Volume2 className="h-5 w-5" /></span><span className="text-[11px]">Speaker</span></div>
            <button type="button" onClick={endCall} disabled={!activeRef.current} className="flex flex-col items-center gap-2 text-white/70 disabled:text-white/30"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-300"><PhoneOff className="h-5 w-5" /></span><span className="text-[11px]">End call</span></button>
          </div>
          {!activeRef.current ? <Button onClick={startCall} className="h-14 w-full rounded-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-500"><Mic className="mr-2 h-5 w-5" />Start AI Call</Button> : <div className="flex h-14 w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-medium text-white/70">{callState === 'thinking' ? 'AI is preparing a reply…' : callState === 'speaking' ? 'Listening will resume automatically' : callState === 'listening' ? 'Speak naturally — I’m listening' : 'Call connected'}</div>}
          <div className="mt-4 flex items-start justify-center gap-2 px-2 text-left text-[11px] leading-5 text-white/40"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span>Shruti runs on this device. Internet is required only for AI replies; voice playback uses your existing phone/browser TTS.</span></div>
        </div>
      </section>
      
    </main>
  );
}
