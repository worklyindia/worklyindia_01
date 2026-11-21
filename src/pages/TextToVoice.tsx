import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Play, RefreshCw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { requestOwnerPhoneVoiceAudioBlob } from "@/lib/ownerPhoneVoiceRelay";
import { toast } from "@/hooks/use-toast";

const LANGUAGES = [
  { value: "hi-IN", label: "Hindi" },
  { value: "en-IN", label: "English" },
  { value: "gu-IN", label: "Gujarati" },
];

export default function TextToVoice() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("hi-IN");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setStatus(detail?.status === "generating" ? "Generating audio on your Workly Android app…" : "Waiting for your Workly Android app…");
    };
    window.addEventListener("workly-voice-status", onStatus);
    return () => {
      window.removeEventListener("workly-voice-status", onStatus);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const convert = async () => {
    const clean = text.trim();
    if (!clean) { toast({ title: "Enter text first", description: "Add text to convert into voice." }); return; }
    if (clean.length > 1000) { toast({ title: "Text is too long", description: "The connected phone currently supports up to 1,000 characters per conversion." }); return; }
    setBusy(true); setStatus("Sending request to your Workly Android app…");
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    try {
      const blob = await requestOwnerPhoneVoiceAudioBlob(clean, language);
      const url = URL.createObjectURL(blob);
      setAudioBlob(blob); setAudioUrl(url); setStatus("Audio is ready on this device.");
      toast({ title: "Voice ready", description: "Your audio is available to play or download." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Voice conversion failed.";
      setStatus(message); toast({ title: "Conversion failed", description: message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const download = () => {
    if (!audioBlob || !audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `workly-voice-${language}.wav`;
    document.body.appendChild(link); link.click(); link.remove();
  };

  return <div className="min-h-screen bg-background pb-24">
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <Button type="button" variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-lg font-semibold">Text To Voice</h1>
      </div>
    </header>
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><Volume2 className="h-6 w-6" /></div>
        <div><h2 className="font-semibold">Convert text using your phone</h2><p className="text-sm text-muted-foreground">Audio is returned to this browser for playback and download.</p></div>
      </div>
      <Card className="space-y-4 p-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="tts-language">Language</label>
          <Select value={language} onValueChange={setLanguage} disabled={busy}>
            <SelectTrigger id="tts-language"><SelectValue placeholder="Select language" /></SelectTrigger>
            <SelectContent>{LANGUAGES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><label className="text-sm font-medium" htmlFor="tts-text">Your text</label><span className="text-xs text-muted-foreground">{text.length}/1,000</span></div>
          <Textarea id="tts-text" value={text} onChange={e => setText(e.target.value)} placeholder="Type or paste your text here…" className="min-h-48 resize-y text-base" maxLength={1000} disabled={busy} />
        </div>
        <Button className="w-full" onClick={convert} disabled={busy || !text.trim()}>
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Converting…</> : <><Volume2 className="mr-2 h-4 w-4" />Convert To Voice</>}
        </Button>
        {status && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{status}</p>}
      </Card>
      {audioUrl && audioBlob && <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2 font-medium"><Volume2 className="h-5 w-5 text-primary" />Your audio is ready</div>
        <audio ref={audioRef} controls src={audioUrl} className="w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => audioRef.current?.play()}><Play className="mr-2 h-4 w-4" />Play</Button>
          <Button onClick={download}><Download className="mr-2 h-4 w-4" />Download</Button>
        </div>
        <Button variant="ghost" className="w-full" onClick={() => { if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioUrl(""); setAudioBlob(null); setStatus(""); }}><RefreshCw className="mr-2 h-4 w-4" />Clear audio</Button>
        <p className="text-xs text-muted-foreground">Audio is held temporarily in this browser session. It is not saved to your Workly profile.</p>
      </Card>}
      <p className="text-xs text-muted-foreground">Keep the Workly Android app connected and its shared phone server online. The selected language voice must be installed on that phone.</p>
    </main>
  </div>;
}
