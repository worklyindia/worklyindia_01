import { useEffect, useState } from "react";
import { Copy, RefreshCw, Smartphone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type PairingResponse = {
  pairing_code: string;
  expires_at: string;
  expires_in_seconds: number;
};

export default function WorklyAIVoiceDevices() {
  const { user, loading } = useAuth();
  const [pairing, setPairing] = useState<PairingResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pairing) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(pairing.expires_at).getTime() - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [pairing]);

  const generateCode = async () => {
    if (!user) {
      toast.error("Please sign in to Workly India first.");
      return;
    }
    setBusy(true);
    setPairing(null);
    try {
      const { data, error } = await supabase.functions.invoke<PairingResponse>("workly-ai-voice-relay", {
        body: { action: "create_pairing" },
      });
      if (error) throw error;
      if (!data?.pairing_code || !data.expires_at) throw new Error("The relay returned an invalid pairing response.");
      setPairing(data);
      toast.success("A one-time phone pairing code is ready.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create a pairing code.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!pairing?.pairing_code) return;
    try {
      await navigator.clipboard.writeText(pairing.pairing_code);
      toast.success("Pairing code copied.");
    } catch {
      toast.error("Clipboard access is unavailable. Select and copy the code manually.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><Smartphone className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workly AI Voice Server</h1>
          <p className="text-sm text-muted-foreground">Connect your Android phone as a private voice device</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Secure one-time pairing</CardTitle>
          <CardDescription>Generate a temporary code here, then enter it in the separate Workly AI Voice Android app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Keep this Workly account signed in.</li>
            <li>Generate a new pairing code below.</li>
            <li>Open Workly AI Voice on your phone and enter the code.</li>
            <li>After pairing, tap Start phone server in the Android app.</li>
          </ol>
          {pairing && secondsLeft > 0 ? (
            <div className="space-y-3 rounded-xl border bg-muted/40 p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">One-time pairing code</p>
              <div className="break-all font-mono text-2xl font-bold tracking-[0.12em] sm:text-3xl">{pairing.pairing_code}</div>
              <p className="text-sm text-muted-foreground">Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</p>
              <Button onClick={copyCode} variant="outline" className="w-full"><Copy className="mr-2 h-4 w-4" /> Copy code</Button>
            </div>
          ) : pairing ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              This pairing code has expired. Generate a new one.
            </div>
          ) : null}
          <Button onClick={generateCode} disabled={busy || loading || !user} className="w-full">
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Generating secure code…" : "Generate pairing code"}
          </Button>
          <p className="text-xs text-muted-foreground">
            The code expires after 5 minutes and can be used once. Never share it with anyone else. Your phone receives a separate device token, stored encrypted with Android Keystore.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Current limitations</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Keep the Android app's foreground server notification active while using the phone as a relay.</p>
          <p>Website TTS requests currently play through the paired phone speaker and return a playback confirmation. Audio-file streaming and remote audio-file speech-to-text are not implemented yet.</p>
          <p>Phone availability depends on its battery, mobile data/Wi-Fi, Android background limits, and Supabase Free quotas. This is not an unlimited or guaranteed 24/7 server.</p>
        </CardContent>
      </Card>
    </main>
  );
}
