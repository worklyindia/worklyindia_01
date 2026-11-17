import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AudioLines, Mic, MicOff, PhoneOff } from 'lucide-react';
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
  const [, setLastReply] = useState('');
  const [, setLastTranscript] = useState('');
  const [, setPartialTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [muted, setMuted] = useState(false);
  const [, setNativeAvailable] = useState(false);
  const [, setVoiceStage] = useState('Waiting for microphone…');
  const [, setMicLevel] = useState(0);
  const [, setAiRequestStatus] = useState('Not sent');
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
      const spoken = await speakReply(reply, /[\u0900-\u097F]/.test(reply) ? 'hi-IN' : 'en-IN');
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
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#101827] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(45,92,160,0.28),transparent_55%)]" />
      <header className="relative z-10 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" onClick={() => { endCall(); navigate('/ai-assistant'); }} aria-label="Back to AI Chat" className="text-white/80 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <p className="text-sm font-medium text-white/70">Workly India</p>
        <span className="h-10 w-10" aria-hidden="true" />
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-12 text-center">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-[#3678D8] to-[#5548B8] shadow-[0_16px_55px_rgba(36,91,190,0.35)] ring-4 ring-white/10">
            <AudioLines className="h-16 w-16 text-white" strokeWidth={1.8} />
            {activeRef.current && <span className="absolute inset-0 rounded-full border-2 border-white/25 animate-ping" />}
          </div>
          <div className="mt-8 flex items-center justify-center gap-2">
            <h1 className="text-[28px] font-semibold tracking-tight">{aiName}</h1>
            {showBadge && <VerificationBadge color={badgeColor} size={17} />}
          </div>
          <p className="mt-2 text-base text-white/60">Workly India AI</p>
          <p className="mt-7 text-lg font-medium text-white/90" aria-live="polite">
            {callState === 'idle' ? 'Ready to call' : callState === 'listening' ? 'Connected' : callState === 'thinking' ? 'Calling…' : callState === 'speaking' ? 'Speaking' : 'Call interrupted'}
          </p>
          {callState === 'listening' && <p className="mt-1 text-sm text-white/45">00:00</p>}
          {errorMessage && (
            <div role="alert" className="mt-6 w-full rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-left text-sm text-red-100">
              <p className="font-medium">Call failed</p>
              <p className="mt-1 break-words text-xs leading-5 text-red-100/80">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="w-full pt-10">
          {activeRef.current ? (
            <div className="flex items-center justify-center gap-12">
              <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} className="flex flex-col items-center gap-3 text-white/85">
                <span className={`flex h-[68px] w-[68px] items-center justify-center rounded-full ${muted ? 'bg-white text-slate-900' : 'bg-white/15'}`}>
                  {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </span>
                <span className="text-xs">{muted ? 'Unmute' : 'Mute'}</span>
              </button>
              <button type="button" onClick={endCall} aria-label="End call" className="flex flex-col items-center gap-3 text-white">
                <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#E5484D] shadow-lg shadow-red-950/30">
                  <PhoneOff className="h-7 w-7" />
                </span>
                <span className="text-xs">End call</span>
              </button>
            </div>
          ) : (
            <Button onClick={startCall} className="h-16 w-full rounded-full bg-[#269B62] text-base font-semibold text-white shadow-lg shadow-green-950/30 hover:bg-[#218653]">
              <Mic className="mr-2 h-5 w-5" /> Start AI Call
            </Button>
          )}
          <p className="mt-8 text-center text-xs text-white/40">Your voice conversation is saved in AI Chat history</p>
        </div>
      </section>
    </main>
  );
}
