import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AudioLines, Mic, MicOff, PhoneOff, ShieldCheck, Volume2, Languages, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import VerificationBadge from '@/components/VerificationBadge';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';
import { getWorklyAndroidBridge } from '@/lib/nativeAppBridge';
import { supabase } from '@/integrations/supabase/client';

type VoiceLanguage = 'Hindi' | 'English' | 'Gujarati';
type CallState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
const languageTags: Record<VoiceLanguage, string> = { Hindi: 'hi-IN', English: 'en-IN', Gujarati: 'gu-IN' };

export default function AIVoiceCall() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: settings } = useAIChatSettings();
  const [language, setLanguage] = useState<VoiceLanguage>('Hindi');
  const [callState, setCallState] = useState<CallState>('idle');
  const [lastReply, setLastReply] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [muted, setMuted] = useState(false);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const activeRef = useRef(false);
  const aiName = settings?.name || 'Workly India AI';
  const showBadge = settings?.verification_enabled;
  const badgeColor = (settings?.verification_color || 'blue') as 'gold' | 'blue' | 'green' | 'silver';
  const bridge = getWorklyAndroidBridge();

  const endCall = useCallback(() => {
    activeRef.current = false;
    bridge?.stopOnDeviceVoiceRecognition?.();
    bridge?.stopVoiceReply?.();
    setCallState('idle');
    setLastReply('');
    setLastTranscript('');
    setMuted(false);
  }, [bridge]);

  const handleTranscript = useCallback(async (event: Event) => {
    if (!activeRef.current) return;
    const detail = (event as CustomEvent<{ text?: string }>).detail;
    const transcript = detail?.text?.trim();
    if (!transcript) return;
    setLastTranscript(transcript);
    setCallState('thinking');
    try {
      const { data, error } = await supabase.functions.invoke('unified-voice', {
        body: { action: 'ai-voice-chat', text: transcript, language },
      });
      if (error) throw error;
      const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
      if (!reply) throw new Error('AI did not return a voice response.');
      if (!activeRef.current) return;
      setLastReply(reply);
      const spoken = bridge?.speakVoiceReply?.(reply, languageTags[language]);
      if (!spoken) throw new Error('Phone text-to-speech is unavailable.');
      setCallState('speaking');
    } catch (error) {
      if (!activeRef.current) return;
      setCallState('error');
      toast.error(error instanceof Error ? error.message : 'Voice reply failed. Please try again.');
    }
    // Transcript and reply remain only in component memory and are cleared by End Call.
  }, [bridge, language]);

  const handleNativeStatus = useCallback((event: Event) => {
    if (!activeRef.current) return;
    const status = (event as CustomEvent<{ status?: string }>).detail?.status;
    if (status === 'listening') setCallState('listening');
    if (status === 'processing') setCallState('thinking');
    if (status === 'speaking') setCallState('speaking');
    if (status === 'finished' && activeRef.current && !muted) {
      window.setTimeout(() => {
        if (activeRef.current && !muted) {
          const started = bridge?.startOnDeviceVoiceRecognition?.(languageTags[language]);
          if (started) setCallState('listening');
          else { setCallState('error'); toast.error('Could not resume listening.'); }
        }
      }, 250);
    }
  }, [bridge, language, muted]);

  const handleNativeError = useCallback((event: Event) => {
    if (!activeRef.current) return;
    const message = (event as CustomEvent<{ message?: string }>).detail?.message || 'Voice service error.';
    setCallState('error');
    toast.error(message);
  }, []);

  useEffect(() => {
    setNativeAvailable(!!bridge?.isOnDeviceVoiceRecognitionAvailable?.());
    window.addEventListener('workly-voice-transcript', handleTranscript);
    window.addEventListener('workly-voice-status', handleNativeStatus);
    window.addEventListener('workly-voice-error', handleNativeError);
    return () => {
      window.removeEventListener('workly-voice-transcript', handleTranscript);
      window.removeEventListener('workly-voice-status', handleNativeStatus);
      window.removeEventListener('workly-voice-error', handleNativeError);
      activeRef.current = false;
      bridge?.stopOnDeviceVoiceRecognition?.();
      bridge?.stopVoiceReply?.();
    };
  }, [bridge, handleTranscript, handleNativeStatus, handleNativeError]);

  const startCall = async () => {
    if (!user) { toast.error('Please log in to use AI voice calls.'); return; }
    if (!bridge?.isOnDeviceVoiceRecognitionAvailable?.()) {
      setNativeAvailable(false);
      toast.error('Secure on-device speech recognition is not available on this phone. Audio will not be sent to a speech service.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      activeRef.current = true;
      setLastReply('');
      setLastTranscript('');
      setCallState('listening');
      if (!bridge.startOnDeviceVoiceRecognition?.(languageTags[language])) {
        activeRef.current = false;
        setCallState('error');
        toast.error('Could not start on-device speech recognition.');
      }
    } catch {
      setCallState('error');
      toast.error('Microphone permission was denied. Allow microphone access in app settings.');
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (next) {
      bridge?.stopOnDeviceVoiceRecognition?.();
      bridge?.stopVoiceReply?.();
    } else if (activeRef.current) {
      bridge?.startOnDeviceVoiceRecognition?.(languageTags[language]);
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

        <div className="mt-8 w-full">
          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-white/45"><Languages className="h-4 w-4" /> Call language</div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5">
            {(['Hindi', 'English', 'Gujarati'] as VoiceLanguage[]).map((item) => <button key={item} type="button" disabled={activeRef.current} onClick={() => setLanguage(item)} aria-pressed={language === item} className={`min-h-11 rounded-xl px-2 text-sm font-medium transition-colors ${language === item ? 'bg-blue-600 text-white shadow-lg' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}>{item}</button>)}
          </div>
        </div>

        <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300" /><p className="text-sm font-semibold">Privacy-first call</p><span className="ml-auto text-xs text-white/50">{nativeAvailable ? 'On-device mic' : 'Device speech unavailable'}</span></div>
          <p className="mt-2 text-xs leading-5 text-white/55">Audio is recognized on your phone. Only recognized text is sent to the AI provider. Workly India does not save call audio, transcript or AI replies in chat history, database or storage. Provider retention is governed by that provider.</p>
          {(lastTranscript || lastReply) && <div className="mt-3 space-y-2 rounded-xl bg-black/20 p-3"><p className="text-[11px] text-white/45">Current call only</p>{lastTranscript && <p className="text-xs text-white/65">You: {lastTranscript}</p>}{lastReply && <p className="text-sm text-white">AI: {lastReply}</p>}</div>}
        </div>

        <div className="mt-auto w-full pt-8">
          <div className="mb-5 flex items-center justify-center gap-7">
            <button type="button" onClick={toggleMute} disabled={!activeRef.current} className="flex flex-col items-center gap-2 text-white/70 disabled:text-white/30"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</span><span className="text-[11px]">{muted ? 'Unmute' : 'Mute'}</span></button>
            <div className="flex flex-col items-center gap-2 text-white/35"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5"><Volume2 className="h-5 w-5" /></span><span className="text-[11px]">Speaker</span></div>
            <button type="button" onClick={endCall} disabled={!activeRef.current} className="flex flex-col items-center gap-2 text-white/70 disabled:text-white/30"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-300"><PhoneOff className="h-5 w-5" /></span><span className="text-[11px]">End call</span></button>
          </div>
          {!activeRef.current ? <Button onClick={startCall} className="h-14 w-full rounded-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-500"><Mic className="mr-2 h-5 w-5" />Start AI Call</Button> : <div className="flex h-14 w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-medium text-white/70">{callState === 'thinking' ? 'AI is preparing a reply…' : callState === 'speaking' ? 'Listening will resume automatically' : callState === 'listening' ? 'Speak naturally — I’m listening' : 'Call connected'}</div>}
          <div className="mt-4 flex items-start justify-center gap-2 px-2 text-left text-[11px] leading-5 text-white/40"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span>Requires Android on-device speech language data and an internet connection for AI replies. No paid voice API is called by this feature.</span></div>
        </div>
      </section>
      <footer className="relative z-10 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-[10px] tracking-wide text-white/30">Selected language: {language}</footer>
    </main>
  );
}
