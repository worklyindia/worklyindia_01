import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AudioLines, Mic, MicOff, PhoneOff, ShieldCheck, Volume2, Languages, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import VerificationBadge from '@/components/VerificationBadge';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';

type MicState = 'unchecked' | 'checking' | 'ready' | 'blocked';
type VoiceLanguage = 'Hindi' | 'English' | 'Gujarati';

export default function AIVoiceCall() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: settings } = useAIChatSettings();
  const [micState, setMicState] = useState<MicState>('unchecked');
  const [language, setLanguage] = useState<VoiceLanguage>('Hindi');

  const aiName = settings?.name || 'Workly India AI';
  const showBadge = settings?.verification_enabled;
  const badgeColor = (settings?.verification_color || 'blue') as 'gold' | 'blue' | 'green' | 'silver';

  const checkMicrophone = async () => {
    if (!user) {
      toast.error('Please log in to use AI voice calls.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicState('blocked');
      toast.error('Microphone access is not supported in this browser.');
      return;
    }
    setMicState('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicState('ready');
      toast.success('Microphone permission is ready.');
    } catch {
      setMicState('blocked');
      toast.error('Microphone permission was denied. Allow microphone access in app settings.');
    }
  };

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#080D1B] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(37,99,235,0.24),transparent_48%)]" />
      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/ai-assistant')} aria-label="Back to AI Chat" className="text-white hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-blue-200/70">Workly India</p>
          <p className="mt-1 text-sm text-white/70">AI Voice Call</p>
        </div>
        <span className="h-10 w-10" aria-hidden="true" />
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pt-8 pb-8 text-center">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-blue-400/15" />
          <div className="absolute inset-3 rounded-full border border-blue-400/20" />
          <div className="absolute inset-6 rounded-full bg-blue-500/10 blur-xl" />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_12px_60px_rgba(37,99,235,0.42)] ring-1 ring-white/20">
            <AudioLines className="h-14 w-14 text-white" strokeWidth={2.1} />
          </div>
        </div>

        <div className="mt-7 flex items-center justify-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{aiName}</h1>
          {showBadge && <VerificationBadge color={badgeColor} size={17} />}
        </div>
        <p className="mt-2 text-sm text-blue-100/65">Voice assistant</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-medium text-amber-100">
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          Voice service setup pending
        </div>

        <div className="mt-10 w-full">
          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-white/45">
            <Languages className="h-4 w-4" /> Call language
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5">
            {(['Hindi', 'English', 'Gujarati'] as VoiceLanguage[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLanguage(item)}
                aria-pressed={language === item}
                className={`min-h-11 rounded-xl px-2 text-sm font-medium transition-colors ${language === item ? 'bg-blue-600 text-white shadow-lg' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-7 w-full rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
            <p className="text-sm font-semibold">Privacy-first call</p>
            <span className="ml-auto text-xs text-white/50">
              {micState === 'ready' ? 'Mic ready' : micState === 'blocked' ? 'Mic blocked' : micState === 'checking' ? 'Checking…' : 'Mic not checked'}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-white/55">
            The intended call must not save audio, transcripts or AI replies to chat history, database or storage. This protection is not implemented or verified yet.
          </p>
          <Button onClick={checkMicrophone} disabled={micState === 'checking'} variant="outline" className="mt-3 w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Mic className="mr-2 h-4 w-4" />
            {micState === 'checking' ? 'Checking microphone…' : micState === 'ready' ? 'Check microphone again' : 'Check microphone'}
          </Button>
        </div>

        <div className="mt-auto w-full pt-10">
          <div className="mb-5 flex items-center justify-center gap-7">
            <div className="flex flex-col items-center gap-2 text-white/35">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5"><MicOff className="h-5 w-5" /></span>
              <span className="text-[11px]">Mute</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-white/35">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5"><Volume2 className="h-5 w-5" /></span>
              <span className="text-[11px]">Speaker</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-white/35">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20"><PhoneOff className="h-5 w-5" /></span>
              <span className="text-[11px]">End call</span>
            </div>
          </div>
          <Button disabled className="h-14 w-full rounded-full bg-blue-600 text-base font-semibold text-white opacity-70">
            Voice calling is not connected yet
          </Button>
          <div className="mt-4 flex items-start justify-center gap-2 px-2 text-left text-[11px] leading-5 text-white/40">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Free AI speech recognition and voice reply engine must be connected before calls can start. No paid voice API is enabled.</span>
          </div>
        </div>
      </section>
      <footer className="relative z-10 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-[10px] tracking-wide text-white/30">
        Selected language: {language}
      </footer>
    </main>
  );
}
