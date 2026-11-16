import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PhoneCall, Mic, ShieldCheck, AudioLines, Languages, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import VerificationBadge from '@/components/VerificationBadge';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';

type MicState = 'unchecked' | 'checking' | 'ready' | 'blocked';

export default function AIVoiceCall() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: settings } = useAIChatSettings();
  const [micState, setMicState] = useState<MicState>('unchecked');

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
      toast.error('Microphone permission was denied. Allow microphone access in browser settings.');
    }
  };

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-background via-background to-primary/5 flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-xl px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ai-assistant')} aria-label="Back to AI Chat">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-base font-semibold">{aiName}</h1>
              {showBadge && <VerificationBadge color={badgeColor} size={15} />}
            </div>
            <p className="text-xs text-muted-foreground">AI Voice Call</p>
          </div>
          <span className="w-10" aria-hidden="true" />
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <div className="relative mb-7 flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-accent/30 ring-1 ring-primary/20 shadow-xl">
          <div className="absolute inset-3 rounded-full border border-primary/15" />
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg">
            <AudioLines className="h-12 w-12" />
          </div>
        </div>

        <h2 className="text-2xl font-bold tracking-tight">Talk to {aiName}</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          A natural female AI voice experience in Hindi, English and Gujarati is being prepared.
        </p>

        <div className="mt-7 w-full rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-left">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-sm">Free voice engine setup pending</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                The open-source Whisper.cpp speech recognition and Mithi female voice engine are not connected to this deployment yet. Calls stay disabled until a compatible inference server is configured. No paid voice API is used by this screen.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid w-full grid-cols-3 gap-2">
          {['Hindi', 'English', 'Gujarati'].map((language) => (
            <div key={language} className="rounded-xl border border-border/70 bg-card px-2 py-3 text-sm font-medium">
              <Languages className="mx-auto mb-1 h-4 w-4 text-primary" />
              {language}
            </div>
          ))}
        </div>

        <div className="mt-6 w-full rounded-2xl border border-border/70 bg-card p-4 text-left">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold">Microphone permission</p>
            <span className="ml-auto text-xs text-muted-foreground">
              {micState === 'ready' ? 'Ready' : micState === 'blocked' ? 'Blocked' : micState === 'checking' ? 'Checking…' : 'Not checked'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            You can check browser microphone permission now. This only tests access; it does not start or record a call.
          </p>
          <Button className="mt-3 w-full" variant="outline" onClick={checkMicrophone} disabled={micState === 'checking'}>
            <Mic className="mr-2 h-4 w-4" />
            {micState === 'checking' ? 'Checking microphone…' : 'Check microphone'}
          </Button>
        </div>

        <Button className="mt-5 w-full max-w-sm rounded-full" size="lg" disabled>
          <PhoneCall className="mr-2 h-5 w-5" />
          Voice calling not available yet
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          No subscription, paid API or per-minute charge is enabled here.
        </p>
      </section>

      <footer className="px-5 pb-6 text-center text-xs text-muted-foreground">
        Workly India AI Voice · Open-source engine planned
      </footer>
    </main>
  );
}
