import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Play, RefreshCw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requestOwnerPhoneLongVoiceAudioBlob, requestOwnerPhoneVoiceAudioBlob } from "@/lib/ownerPhoneVoiceRelay";
import { toast } from "@/hooks/use-toast";

type VoiceOption = { value: string; label: string };
type PreviewCatalog = Record<string, Record<string, string>>;

const MODELS: { value: string; label: string; languages: string[] }[] = [
  { value: "kokoro", label: "Kokoro-82M", languages: ["hi-IN", "en-IN"] },
  { value: "indic", label: "Indic Tiny TTS", languages: ["gu-IN"] },
];

const LANGUAGES = [
  { value: "hi-IN", label: "Hindi" },
  { value: "en-IN", label: "English" },
  { value: "gu-IN", label: "Gujarati" },
];

const VOICES_BY_LANGUAGE: Record<string, VoiceOption[]> = {
  "hi-IN": [
    { value: "hf_alpha", label: "Alpha · Female" },
    { value: "hf_beta", label: "Beta · Female" },
    { value: "hm_omega", label: "Omega · Male" },
    { value: "hm_psi", label: "Psi · Male" },
  ],
  "en-IN": [
    { value: "af_heart", label: "Heart · Female" },
    { value: "af_alloy", label: "Alloy · Female" },
    { value: "af_aoede", label: "Aoede · Female" },
    { value: "af_bella", label: "Bella · Female" },
    { value: "af_jessica", label: "Jessica · Female" },
    { value: "af_kore", label: "Kore · Female" },
    { value: "af_nicole", label: "Nicole · Female" },
    { value: "af_nova", label: "Nova · Female" },
    { value: "af_river", label: "River · Female" },
    { value: "af_sarah", label: "Sarah · Female" },
    { value: "af_sky", label: "Sky · Female" },
    { value: "am_adam", label: "Adam · Male" },
    { value: "am_echo", label: "Echo · Male" },
    { value: "am_eric", label: "Eric · Male" },
    { value: "am_fenrir", label: "Fenrir · Male" },
    { value: "am_liam", label: "Liam · Male" },
    { value: "am_michael", label: "Michael · Male" },
    { value: "am_onyx", label: "Onyx · Male" },
    { value: "am_puck", label: "Puck · Male" },
    { value: "am_santa", label: "Santa · Male" },
  ],
  "gu-IN": [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
  ],
};

const FALLBACK_PREVIEW_TEXTS: PreviewCatalog = {
  "hi-IN": {
    hf_alpha: "नमस्ते! आपका दिन खुशियों और नई उम्मीदों से भरा रहे।",
    hf_beta: "आपका स्वागत है। मैं आपकी सहायता करने के लिए यहाँ हूँ।",
    hm_omega: "आज हम एक नई शुरुआत करेंगे और अपने लक्ष्य की ओर आगे बढ़ेंगे।",
    hm_psi: "सही अवसर और मेहनत मिलकर सफलता का रास्ता बनाते हैं।",
  },
  "en-IN": {
    af_heart: "Hello! Welcome to Workly India. Let’s make today a great day.",
    af_alloy: "Every new skill opens a new door. Keep learning and moving forward.",
    af_aoede: "Your next opportunity could be closer than you think.",
    af_bella: "Speak with confidence, stay curious, and enjoy every new challenge.",
    af_jessica: "A thoughtful plan and a positive start can change your whole day.",
    af_kore: "Welcome! I’m happy to help you explore your next opportunity.",
    af_nicole: "Small steps taken consistently can lead to wonderful results.",
    af_nova: "Discover your strengths and let your best work shine.",
    af_river: "Good communication turns simple ideas into meaningful connections.",
    af_sarah: "Thank you for visiting. Wishing you success in everything you do.",
    af_sky: "Take a deep breath, believe in yourself, and begin.",
    am_adam: "Hello there. Let’s find a clear path toward your next goal.",
    am_echo: "Great work begins with a clear idea and the courage to start.",
    am_eric: "Welcome to Workly India. Your next chapter starts today.",
    am_fenrir: "Stay focused, keep improving, and make every opportunity count.",
    am_liam: "A strong team grows through trust, effort, and good communication.",
    am_michael: "Your experience matters. Let’s put your skills to work.",
    am_onyx: "Success is built one thoughtful decision at a time.",
    am_puck: "Every conversation is a chance to learn something useful.",
    am_santa: "Warm wishes to you and your family. Have a wonderful day.",
  },
  "gu-IN": {
    female: "નમસ્તે! વર્કલી ઇન્ડિયામાં આપનું હાર્દિક સ્વાગત છે. તમારો દિવસ શુભ રહે.",
    male: "સારા વિચારો અને સતત મહેનતથી સફળતાનો નવો રસ્તો બને છે.",
  },
};

const R2_PREVIEW_CATALOG_URL = "https://pub-d7e0943326ee4d9da8045f267a70faac.r2.dev/voice-preview-catalog.json";
export default function TextToVoice() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [model, setModel] = useState<string>("kokoro");
  const [language, setLanguage] = useState("en-IN");
  const [voice, setVoice] = useState("af_heart");
  const [busy, setBusy] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [previewCatalog, setPreviewCatalog] = useState<PreviewCatalog>(FALLBACK_PREVIEW_TEXTS);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewCache = useRef<Map<string, string>>(new Map());

  const availableLanguages = useMemo(
    () => LANGUAGES.filter((item) => MODELS.find((entry) => entry.value === model)?.languages.includes(item.value)),
    [model],
  );
  const availableVoices = VOICES_BY_LANGUAGE[language] ?? [];

  useEffect(() => {
    const controller = new AbortController();
    fetch(R2_PREVIEW_CATALOG_URL, { signal: controller.signal, cache: "force-cache" })
      .then((response) => { if (!response.ok) throw new Error("Voice preview catalog unavailable"); return response.json(); })
      .then((data: PreviewCatalog) => { if (data && typeof data === "object") setPreviewCatalog(data); })
      .catch(() => { /* bundled fallback keeps voice previews usable if R2 is temporarily unavailable */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      if (detail.status === "queued") {
        setStatus("Waiting for your Workly Android app…");
        setProgress((current) => Math.max(current, 2));
      } else if (detail.status === "generating") {
        if (typeof detail.part === "number" && typeof detail.total === "number" && detail.total > 0) {
          const completed = detail.completed ? detail.part : detail.part - 1;
          const next = Math.min(98, Math.max(3, Math.round(5 + (completed / detail.total) * 90)));
          setProgress((current) => Math.max(current, next));
          setStatus(detail.total > 1 ? `Generating audio · ${detail.part} of ${detail.total} parts` : "Generating audio on your phone…");
        } else {
          setStatus("Generating audio on your phone…");
          setProgress((current) => Math.max(current, 5));
        }
      }
    };
    window.addEventListener("workly-voice-status", onStatus);
    return () => window.removeEventListener("workly-voice-status", onStatus);
  }, []);

  useEffect(() => {
    return () => {
      previewCache.current.forEach((url) => URL.revokeObjectURL(url));
      previewCache.current.clear();
    };
  }, []);

  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  useEffect(() => {
    if (!availableLanguages.some((item) => item.value === language)) {
      const nextLanguage = availableLanguages[0]?.value ?? "en-IN";
      setLanguage(nextLanguage);
      setVoice(VOICES_BY_LANGUAGE[nextLanguage]?.[0]?.value ?? "");
    }
  }, [availableLanguages, language]);

  useEffect(() => {
    setVoice(availableVoices[0]?.value ?? "");
  }, [language]);

  const clearAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    setAudioBlob(null);
    setStatus("");
    setProgress(0);
  };

  const convert = async () => {
    const clean = text.trim();
    if (!clean) { toast({ title: "Enter text first", description: "Add text to convert into voice." }); return; }
    clearAudio();
    setBusy(true);
    setStatus("Connecting to your Workly Android app…");
    setProgress(1);
    try {
      const blob = await requestOwnerPhoneLongVoiceAudioBlob(clean, language, voice, model);
      const url = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioUrl(url);
      setStatus("Audio ready");
      setProgress(100);
      toast({ title: "Voice ready", description: "Your audio is ready to play or download." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Voice conversion failed.";
      setStatus(message);
      setProgress(0);
      toast({ title: "Conversion failed", description: message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const previewVoice = async (voiceId: string) => {
    const cacheKey = `${model}:${language}:${voiceId}`;
    const cachedUrl = previewCache.current.get(cacheKey);
    if (cachedUrl) {
      const player = new Audio(cachedUrl);
      await player.play();
      return;
    }
    const sampleText = previewCatalog[language]?.[voiceId] ?? FALLBACK_PREVIEW_TEXTS[language]?.[voiceId];
    if (!sampleText) {
      toast({ title: "Preview text unavailable", description: "This voice does not have a sample text yet." });
      return;
    }
    setPreviewingVoice(voiceId);
    try {
      const blob = await requestOwnerPhoneVoiceAudioBlob(sampleText, language, 180_000, voiceId, model);
      const url = URL.createObjectURL(blob);
      previewCache.current.set(cacheKey, url);
      const player = new Audio(url);
      await player.play();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Voice preview failed.";
      toast({ title: "Preview unavailable", description: message, variant: "destructive" });
    } finally { setPreviewingVoice(""); }
  };

  const download = () => {
    if (!audioBlob || !audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `workly-voice-${model}-${language}.wav`;
    document.body.appendChild(link); link.click(); link.remove();
  };

  return <div className="min-h-screen bg-background pb-20">
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="flex h-12 items-center gap-2 px-3 sm:px-5">
        <Button type="button" variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-base font-semibold">Text To Voice</h1>
      </div>
    </header>

    <main className="w-full space-y-5 px-3 py-5 sm:px-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><Volume2 className="h-6 w-6" /></div>
        <div><h2 className="font-semibold">Convert text using your phone</h2><p className="text-sm text-muted-foreground">Choose a model and preview its voices before converting.</p></div>
      </div>

      <section className="w-full space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="tts-model">Model</label>
          <Select value={model} onValueChange={setModel} disabled={busy || !!previewingVoice}>
            <SelectTrigger id="tts-model" className="h-12"><SelectValue placeholder="Select model" /></SelectTrigger>
            <SelectContent>{MODELS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="tts-language">Language</label>
          <Select value={language} onValueChange={setLanguage} disabled={busy || !!previewingVoice}>
            <SelectTrigger id="tts-language" className="h-12"><SelectValue placeholder="Select language" /></SelectTrigger>
            <SelectContent>{availableLanguages.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium" htmlFor="tts-voice">Voice</label>
          <Select value={voice} onValueChange={setVoice} disabled={busy || !!previewingVoice}>
            <SelectTrigger id="tts-voice" className="h-12"><SelectValue placeholder="Select voice" /></SelectTrigger>
            <SelectContent>{availableVoices.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="divide-y">
            {availableVoices.map((item) => (
              <div key={item.value} className={`flex items-center justify-between gap-3 px-3 py-2.5 ${voice === item.value ? "bg-primary/5" : ""}`}>
                <button type="button" className="min-w-0 flex-1 text-left text-sm" onClick={() => setVoice(item.value)} disabled={busy || !!previewingVoice}>
                  <span className="font-medium">{item.label}</span>
                  {voice === item.value && <span className="ml-2 text-xs text-primary">Selected</span>}
                </button>
                <Button type="button" size="icon" variant="ghost" aria-label={`Preview ${item.label}`} disabled={busy || (!!previewingVoice && previewingVoice !== item.value)} onClick={() => void previewVoice(item.value)}>
                  {previewingVoice === item.value ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between"><label className="text-sm font-medium" htmlFor="tts-text">Your text</label><span className="text-xs text-muted-foreground">{text.length.toLocaleString()} characters</span></div>
          <Textarea id="tts-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Type or paste your text here…" className="min-h-[42vh] resize-y text-base" disabled={busy} />
        </div>

        <Button className="h-12 w-full" onClick={convert} disabled={busy || !!previewingVoice || !text.trim()}>
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Converting…</> : <><Volume2 className="mr-2 h-4 w-4" />Convert To Voice</>}
        </Button>

        {(busy || status) && <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-muted-foreground">{status}</span>
            {busy && <span className="shrink-0 font-semibold tabular-nums">{progress}%</span>}
          </div>
          {busy && <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} /></div>}
        </div>}
      </section>

      {audioUrl && audioBlob && <section className="w-full space-y-3 border-t pt-5">
        <div className="flex items-center gap-2 font-medium"><Volume2 className="h-5 w-5 text-primary" />Your audio is ready</div>
        <audio ref={audioRef} controls src={audioUrl} className="w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={download}><Download className="mr-2 h-4 w-4" />Download</Button>
          <Button variant="outline" onClick={clearAudio}><RefreshCw className="mr-2 h-4 w-4" />Clear audio</Button>
        </div>
      </section>}
    </main>
  </div>;
}
