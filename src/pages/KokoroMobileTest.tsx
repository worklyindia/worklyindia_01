import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KokoroTTS } from "kokoro-js";
import { ArrowLeft, Download, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type KokoroEngine = Awaited<ReturnType<typeof KokoroTTS.from_pretrained>>;

export default function KokoroMobileTest() {
  const navigate = useNavigate();
  const engine = useRef<KokoroEngine | null>(null);
  const [text, setText] = useState("Hello! Welcome to Workly India. This is a mobile test of local text to speech.");
  const [voice, setVoice] = useState("af_heart");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [ready, setReady] = useState(false);

  const loadModel = async () => {
    if (engine.current) return;
    setLoading(true);
    try {
      engine.current = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "q8",
        device: "wasm",
      });
      setReady(true);
      toast.success("Kokoro model loaded on this device");
    } catch (error) {
      console.error("Kokoro model load failed", error);
      toast.error("Could not load Kokoro. Check browser support, storage and internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const generateSpeech = async () => {
    const cleanText = text.trim();
    if (!cleanText) {
      toast.error("Enter text to generate speech.");
      return;
    }
    setGenerating(true);
    try {
      if (!engine.current) {
        await loadModel();
      }
      if (!engine.current) return;
      const audio = await engine.current.generate(cleanText, { voice });
      audio.save("workly-kokoro-voice.wav");
      toast.success("Speech generated. Audio download started.");
    } catch (error) {
      console.error("Kokoro speech generation failed", error);
      toast.error("Speech generation failed on this device. Use the existing phone TTS instead.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/ai-voice-models")} aria-label="Back to TTS models"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">ChatWork</p>
            <h1 className="text-2xl font-bold">Kokoro Mobile Test</h1>
            <p className="text-sm text-muted-foreground">Local browser text-to-speech</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Volume2 className="h-5 w-5" /> Generate speech on this device</CardTitle>
            <CardDescription>The model runs in your browser using WebAssembly. Your text is processed locally after the model has loaded.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2 text-sm font-medium">
              Text to speak
              <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} maxLength={1500} placeholder="Type text in English..." />
              <span className="block text-right text-xs text-muted-foreground">{text.length}/1500</span>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Voice
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger><SelectValue placeholder="Choose a voice" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="af_heart">Heart (female)</SelectItem>
                  <SelectItem value="af_bella">Bella (female)</SelectItem>
                  <SelectItem value="am_michael">Michael (male)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <div className="rounded-lg border p-3 text-sm text-muted-foreground">
              {ready ? "Model loaded and ready on this device. The browser may cache model files for later use." : "First load downloads a large model. Use Wi-Fi and keep this page open. Performance depends on your phone memory, CPU and browser."}
              <p className="mt-2">This Kokoro checkpoint is English-focused. Hindi and Gujarati are not supported by this test. It does not replace or change ChatWork's existing phone TTS.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="w-full" variant="outline" onClick={() => void loadModel()} disabled={loading || ready}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading model…</> : ready ? "Model ready" : "Load model on this phone"}
              </Button>
              <Button className="w-full" onClick={() => void generateSpeech()} disabled={loading || generating}>
                {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : <><Download className="mr-2 h-4 w-4" />Generate & download WAV</>}
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">If the browser closes, clears site data, or the phone runs low on memory, the model may need to load again. If this test fails, the existing ChatWork phone TTS fallback remains available.</p>
      </div>
    </main>
  );
}
