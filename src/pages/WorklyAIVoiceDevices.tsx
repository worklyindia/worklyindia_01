import { useCallback, useEffect, useState } from "react";
import { Copy, RefreshCw, Smartphone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type PairedDevice = { id: string; device_name: string; last_seen_at: string | null; created_at: string; revoked_at: string | null };

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
  const [voiceText, setVoiceText] = useState("Namaste! Workly AI Voice phone server is connected.");
  const [voiceLanguage, setVoiceLanguage] = useState("hi-IN");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [devicesBusy, setDevicesBusy] = useState(false);

  useEffect(() => {
    if (!pairing) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(pairing.expires_at).getTime() - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [pairing]);

  const refreshDevices = useCallback(async () => {
    if (!user) return;
    setDevicesBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ devices: PairedDevice[] }>("workly-ai-voice-relay", {
        body: { action: "list_devices" },
      });
      if (error) throw error;
      setDevices(data?.devices ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load paired phones.");
    } finally {
      setDevicesBusy(false);
    }
  }, [user]);

  const revokeDevice = async (deviceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke<{ revoked: boolean }>("workly-ai-voice-relay", {
        body: { action: "revoke_device", device_id: deviceId },
      });
      if (error) throw error;
      if (!data?.revoked) throw new Error("This device could not be revoked.");
      toast.success("Phone access revoked.");
      await refreshDevices();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke phone.");
    }
  };

  useEffect(() => { if (user) void refreshDevices(); }, [user, refreshDevices]);

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

  const sendVoiceTest = async () => {
    if (!user || !voiceText.trim()) {
      toast.error("Enter text and make sure you are signed in.");
      return;
    }
    setVoiceBusy(true);
    setVoiceStatus("Sending a voice request to your paired phone…");
    try {
      const { data: created, error: createError } = await supabase.functions.invoke<{ job: { id: string } }>("workly-ai-voice-relay", {
        body: { action: "create_job", job_type: "tts", payload: { text: voiceText.trim().slice(0, 4000), language: voiceLanguage } },
      });
      if (createError) throw createError;
      const jobId = created?.job?.id;
      if (!jobId) throw new Error("The relay did not return a voice job ID.");
      setVoiceStatus("Request queued. Waiting for the phone to speak…");
      for (let attempt = 0; attempt < 45; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        const { data: statusData, error: statusError } = await supabase.functions.invoke<{ job: { status: string; result?: { message?: string; error?: string } } }>("workly-ai-voice-relay", {
          body: { action: "get_job", job_id: jobId },
        });
        if (statusError) throw statusError;
        const job = statusData?.job;
        if (job?.status === "completed") {
          setVoiceStatus(job.result?.message || "The phone completed the voice request.");
          toast.success("Phone voice request completed.");
          return;
        }
        if (job?.status === "failed" || job?.status === "expired") {
          throw new Error(job.result?.error || `Voice request ${job.status}.`);
        }
      }
      setVoiceStatus("Still waiting. Check that the Android phone server is online and the app notification is active.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Voice request failed.";
      setVoiceStatus(message);
      toast.error(message);
    } finally {
      setVoiceBusy(false);
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div><CardTitle>Paired phones</CardTitle><CardDescription>Review and revoke phones connected to your account.</CardDescription></div>
          <Button variant="outline" size="sm" onClick={refreshDevices} disabled={devicesBusy}>{devicesBusy ? "Loading…" : "Refresh"}</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {devices.length === 0 ? <p className="text-sm text-muted-foreground">No paired phones found yet. Pair your Android app to see it here.</p> : devices.map((device) => (
            <div key={device.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{device.device_name}</p>
                <p className="text-xs text-muted-foreground">Last seen: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "Not connected yet"}</p>
                <p className="text-xs">{device.revoked_at ? "Access revoked" : "Paired device"}</p>
              </div>
              {!device.revoked_at ? <Button variant="destructive" size="sm" onClick={() => revokeDevice(device.id)}>Revoke access</Button> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test phone voice from this website</CardTitle>
          <CardDescription>Send text to your paired phone. The phone will speak it using its installed Android TTS voice.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block space-y-1 text-sm font-medium">
            Voice language
            <select value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2">
              <option value="hi-IN">Hindi</option>
              <option value="en-IN">English (India)</option>
              <option value="gu-IN">Gujarati</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Text to speak
            <textarea value={voiceText} onChange={(event) => setVoiceText(event.target.value)} rows={3} maxLength={4000} className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm" />
          </label>
          <Button onClick={sendVoiceTest} disabled={voiceBusy || !user || !voiceText.trim()} className="w-full">
            {voiceBusy ? "Waiting for phone…" : "Send voice test to phone"}
          </Button>
          {voiceStatus ? <p role="status" className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{voiceStatus}</p> : null}
          <p className="text-xs text-muted-foreground">The phone must be paired and its foreground server running. This test plays sound on the phone speaker; it does not stream an audio file back to this website.</p>
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
