import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KokoroTTS } from "kokoro-js";
import { ArrowLeft, Download, Loader2, Volume2, Trash2, AlertTriangle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type KokoroEngine = Awaited<ReturnType<typeof KokoroTTS.from_pretrained>>;
type KokoroVoice = "af_heart" | "af_bella" | "am_michael";
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const MODEL_CACHE_MATCH = /transformers|kokoro/i;

export default function KokoroMobileTest() {
  const navigate = useNavigate();
  const engine = useRef<KokoroEngine | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [text, setText] = useState("Hello! Welcome to Workly India. This is a voice quality test.");
  const [voice, setVoice] = useState<KokoroVoice>("af_heart");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [ready, setReady] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const loadModel = async () => {
    if (engine.current) return true;
    setLoading(true);
    try {
      engine.current = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "wasm" });
      setReady(true);
      toast.success("Kokoro model downloaded and ready on this device");
      return true;
    } catch (error) {
      console.error("Kokoro model load failed", error);
      toast.error("Model download/load failed. Check internet, browser storage and free phone memory.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const testModel = async () => {
    const cleanText = text.trim();
    if (!cleanText) {
      toast.error("Please enter text to test the voice.");
      return;
    }
    setGenerating(true);
    try {
      if (!engine.current && !(await loadModel())) return;
      if (!engine.current) return;
      const generated = await engine.current.generate(cleanText, { voice });
      const blob = generated.toBlob();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = audioUrlRef.current;
        await audioRef.current.play();
      }
      toast.success("Voice generated. Playing preview now.");
    } catch (error) {
      console.error("Kokoro speech generation failed", error);
      toast.error("Voice test failed on this phone. Try shorter text or use the existing phone TTS.");
    } finally {
      setGenerating(false);
    }
  };

  const deleteModel = async () => {
    try {
      engine.current = null;
      setReady(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          if (!/transformers|kokoro/i.test(cacheName)) continue;
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          await Promise.all(requests
            .filter((request) => request.url.toLowerCase().includes("kokoro-82m-v1.0-onnx"))
            .map((request) => cache.delete(request)));
        }
      }
      setConfirmDelete(false);
      toast.success("Kokoro model cache entries cleared. Other model cache entries are untouched.");
    } catch (error) {
      console.error("Kokoro model delete failed", error);
      toast.error("Could not clear all model cache. Close other ChatWork tabs and try again.");
    }
  };

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/ai-voice-models")} aria-label="Back to TTS models"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">ChatWork</p>
            <h1 className="text-2xl font-bold">Kokoro Model</h1>
            <p className="text-sm text-muted-foreground">Download, test and manage this phone's model cache</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Volume2 className="h-5 w-5" /> Text to voice test</CardTitle>
            <CardDescription>Model files download on demand and speech is generated locally in this browser using WebAssembly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2 text-sm font-medium">
              Language
              <Select value="en" disabled>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="en">English</SelectItem></SelectContent>
              </Select>
              <span className="block text-xs text-muted-foreground">This Kokoro checkpoint exposes English voices only in this integration. Hindi and Gujarati are not enabled here.</span>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Text to speak
              <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} maxLength={1500} placeholder="Enter English text to hear this model…" />
              <span className="block text-right text-xs text-muted-foreground">{text.length}/1500</span>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Voice
              <Select value={voice} onValueChange={(value) => setVoice(value as KokoroVoice)}>
                <SelectTrigger><SelectValue placeholder="Choose a voice" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="af_heart">Heart — female</SelectItem>
                  <SelectItem value="af_bella">Bella — female</SelectItem>
                  <SelectItem value="am_michael">Michael — male</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <audio ref={audioRef} controls className="w-full" />
            <div className="rounded-lg border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{ready ? "Model downloaded / loaded in this tab" : "Model not loaded yet"}</p>
              <p className="mt-1">First download needs internet and storage. Later use may reuse browser cache. Keep enough free RAM/storage on your phone.</p>
              <p className="mt-2">Delete clears matching ChatWork browser cache entries only. It cannot delete files separately saved in Android Downloads or unrelated website caches.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="w-full" variant="outline" onClick={() => void loadModel()} disabled={loading || ready}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Downloading / loading…</> : ready ? "Model ready" : <><Download className="mr-2 h-4 w-4" />Download Model</>}
              </Button>
              <Button className="w-full" onClick={() => void testModel()} disabled={loading || generating}>
                {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating voice…</> : <><Play className="mr-2 h-4 w-4" />Test Model — Play Voice</>}
              </Button>
            </div>
            <Button className="w-full" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />Delete Model
            </Button>
          </CardContent>
        </Card>

        {confirmDelete && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Confirm model deletion</CardTitle>
              <CardDescription>Are you sure you want to delete the Kokoro model cache managed by ChatWork in this browser? You will need to download it again before testing.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row">
              <Button className="w-full" variant="destructive" onClick={() => void deleteModel()}>Yes, Delete Model</Button>
              <Button className="w-full" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel — Keep Model</Button>
            </CardContent>
          </Card>
        )}
        <p className="text-xs text-muted-foreground">Kokoro is English-focused in this integration. Hindi/Gujarati model testing needs a separate compatible model/runtime. ChatWork's existing paired-phone TTS and device speech fallback are not changed.</p>
      </div>
    </main>
  );
}
