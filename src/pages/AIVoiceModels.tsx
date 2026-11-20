import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Copy, Cpu, Download, ExternalLink, Languages, Mic2, Search, ShieldAlert, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type VoiceModel = {
  id: string;
  name: string;
  summary: string;
  languages: string;
  features: string[];
  hardware: string;
  modelId?: string;
  modelUrl: string;
  sourceUrl: string;
  note: string;
  license: string;
  group: "Indian languages" | "Voice cloning" | "Lightweight";
};

const models: VoiceModel[] = [
  {
    id: "qwen3",
    name: "Qwen3-TTS",
    summary: "Expressive speech, voice design, streaming and short-sample voice cloning.",
    languages: "Official list: Chinese, English, Japanese, Korean, German, French, Russian, Portuguese, Spanish and Italian. Hindi/Gujarati are not listed.",
    features: ["Voice cloning", "Voice design", "Streaming"],
    hardware: "GPU recommended; 0.6B is the smaller option, 1.7B is larger.",
    modelId: "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
    modelUrl: "https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base",
    sourceUrl: "https://github.com/QwenLM/Qwen3-TTS",
    note: "Choose a supported-language checkpoint and verify the language before using it for Hindi/Gujarati.",
    license: "Apache-2.0 (official model release)",
    group: "Voice cloning",
  },
  {
    id: "cosyvoice",
    name: "CosyVoice 3",
    summary: "Multilingual, natural-sounding speech with zero-shot voice cloning and streaming.",
    languages: "Multilingual; check the current model card for the exact language/checkpoint coverage.",
    features: ["Voice cloning", "Streaming", "Style control"],
    hardware: "GPU recommended for practical real-time use.",
    modelId: "FunAudioLLM/Fun-CosyVoice3-0.5B-2512",
    modelUrl: "https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512",
    sourceUrl: "https://github.com/FunAudioLLM/CosyVoice",
    note: "Confirm the required language and checkpoint support before deployment.",
    license: "Check the selected checkpoint and repository licence before commercial use.",
    group: "Voice cloning",
  },
  {
    id: "moss",
    name: "MOSS-TTS",
    summary: "Long-form speech, dialogue, voice design and real-time streaming model family.",
    languages: "Check the individual MOSS checkpoint card; language coverage varies by model.",
    features: ["Long-form speech", "Dialogue", "Voice design", "Streaming"],
    hardware: "Model-dependent; larger checkpoints need a capable GPU.",
    modelUrl: "https://github.com/OpenMOSS/MOSS-TTS",
    sourceUrl: "https://github.com/OpenMOSS/MOSS-TTS",
    note: "The official repository links the model family and its individual checkpoints.",
    license: "Repository states Apache-2.0; verify each checkpoint's model card.",
    group: "Voice cloning",
  },
  {
    id: "indicf5",
    name: "AI4Bharat IndicF5",
    summary: "Indian-language speech synthesis with reference-audio voice cloning.",
    languages: "Includes Hindi and Gujarati among its supported Indian languages.",
    features: ["Hindi", "Gujarati", "Reference voice cloning"],
    hardware: "GPU recommended; check the model card for memory requirements.",
    modelId: "ai4bharat/IndicF5",
    modelUrl: "https://huggingface.co/ai4bharat/IndicF5",
    sourceUrl: "https://github.com/AI4Bharat/IndicF5",
    note: "The model card points users to Indic-Speak as a newer recommended option; compare before choosing.",
    license: "MIT (model card; verify dependencies and datasets separately).",
    group: "Indian languages",
  },
  {
    id: "parler",
    name: "Indic Parler-TTS",
    summary: "Preset Indian voices with controllable voice descriptions and speaking style.",
    languages: "Indian language coverage includes Hindi and Gujarati; check available speaker examples.",
    features: ["Preset voices", "Voice style control", "Hindi", "Gujarati"],
    hardware: "GPU recommended for faster generation; test smaller deployments first.",
    modelId: "ai4bharat/indic-parler-tts",
    modelUrl: "https://huggingface.co/ai4bharat/indic-parler-tts",
    sourceUrl: "https://github.com/AI4Bharat/Indic-Parler-TTS",
    note: "Preset speaker/style selection; this is not the same as cloning a user's own voice.",
    license: "Check the model card and associated dataset terms.",
    group: "Indian languages",
  },
  {
    id: "chatterbox",
    name: "Chatterbox",
    summary: "Expressive TTS and voice cloning with model variants.",
    languages: "Language support depends on the selected Chatterbox variant; verify Hindi/Gujarati before use.",
    features: ["Voice cloning", "Expressive delivery"],
    hardware: "GPU recommended; model variants have different memory needs.",
    modelId: "ResembleAI/chatterbox",
    modelUrl: "https://huggingface.co/ResembleAI/chatterbox",
    sourceUrl: "https://github.com/resemble-ai/chatterbox",
    note: "Review the specific model variant's language support and commercial terms.",
    license: "Check the current model and weights licence before commercial deployment.",
    group: "Voice cloning",
  },
  {
    id: "fish",
    name: "Fish Speech",
    summary: "Expressive speech generation and voice cloning for advanced deployments.",
    languages: "Multilingual; verify the current checkpoint's supported languages.",
    features: ["Voice cloning", "Expressive speech"],
    hardware: "GPU strongly recommended for larger checkpoints.",
    modelUrl: "https://github.com/fishaudio/fish-speech",
    sourceUrl: "https://github.com/fishaudio/fish-speech",
    note: "Some Fish Audio weights/services use a community licence with commercial and hosted-service restrictions. Review it carefully.",
    license: "Fish Audio Community Licence may restrict commercial/hosted use.",
    group: "Voice cloning",
  },
  {
    id: "kokoro",
    name: "Kokoro-82M",
    summary: "Compact, fast preset-voice TTS model for lower-resource deployments.",
    languages: "Voice/language availability depends on the installed voice pack.",
    features: ["Lightweight", "Fast generation", "Preset voices"],
    hardware: "Most suitable for low-cost CPU or modest GPU experiments.",
    modelId: "hexgrad/Kokoro-82M",
    modelUrl: "https://huggingface.co/hexgrad/Kokoro-82M",
    sourceUrl: "https://github.com/hexgrad/kokoro",
    note: "No built-in personal voice cloning; confirm Hindi/Gujarati voice availability before downloading.",
    license: "Apache-2.0",
    group: "Lightweight",
  },
];

const filters = ["All models", "Indian languages", "Voice cloning", "Lightweight"] as const;

export default function AIVoiceModels() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All models");
  const [search, setSearch] = useState("");
  const visibleModels = useMemo(() => models.filter((model) => {
    const matchesFilter = filter === "All models" || model.group === filter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [model.name, model.summary, model.languages, ...model.features].join(" ").toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }), [filter, search]);

  const copyDownloadCommand = async (model: VoiceModel) => {
    if (!model.modelId) {
      toast.info("Open the official repository for this model's current download instructions.");
      return;
    }
    const command = `python -m pip install -U huggingface_hub && hf download ${model.modelId} --local-dir ./${model.id}-model`;
    try {
      await navigator.clipboard.writeText(command);
      toast.success("Download command copied");
    } catch {
      toast.error("Clipboard unavailable. Open the model files page instead.");
    }
  };

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">ChatWork</p>
            <h1 className="text-2xl font-bold tracking-tight">TTS Model Library</h1>
            <p className="text-sm text-muted-foreground">Browse model downloads, check language support and test compatible voices.</p>
          </div>
          <Mic2 className="h-7 w-7 text-primary" />
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Try Kokoro on this phone</p>
              <p className="text-muted-foreground">Kokoro browser-local English voice test. Download on demand and generate speech on this device.</p>
            </div>
            <Button className="shrink-0" onClick={() => navigate("/ai-voice-models/kokoro-mobile")}>Open mobile test</Button>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex gap-3 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Model download and phone testing are separate</p>
              <p className="text-muted-foreground">Each model opens its official download source; large checkpoints may need a PC/GPU runtime and may not run on a phone. Kokoro currently has the in-browser test here. The other seven models need their own compatible inference runtime before ChatWork can generate test audio. Existing paired-phone TTS relay remains unchanged.</p>
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search model, language or feature…" className="pl-9" />
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((item) => <Button key={item} size="sm" variant={filter === item ? "default" : "outline"} onClick={() => setFilter(item)}>{item}</Button>)}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {visibleModels.map((model) => (
            <Card key={model.id} className="flex flex-col">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{model.name}</CardTitle>
                  <Badge variant="secondary">{model.group}</Badge>
                </div>
                <CardDescription>{model.summary}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                <div className="flex items-start gap-2"><Languages className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{model.languages}</span></div>
                <div className="flex flex-wrap gap-1.5">{model.features.map((feature) => <Badge key={feature} variant="outline">{feature}</Badge>)}</div>
                <div className="flex items-start gap-2"><Cpu className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{model.hardware}</span></div>
                <p className="text-xs text-muted-foreground"><strong>Licence:</strong> {model.license}</p>
                <p className="text-xs text-muted-foreground">{model.note}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Button size="sm" onClick={() => model.id === "kokoro" ? navigate("/ai-voice-models/kokoro-mobile") : window.open(model.modelUrl, "_blank", "noopener,noreferrer")}><Download className="mr-2 h-4 w-4" />Download Model</Button>
                  {model.id === "kokoro" && <Button size="sm" variant="outline" onClick={() => navigate("/ai-voice-models/kokoro-mobile")}><Volume2 className="mr-2 h-4 w-4" />Test Model</Button>}
                  <Button size="sm" variant="outline" onClick={() => void copyDownloadCommand(model)}><Copy className="mr-2 h-4 w-4" />Copy setup command</Button>
                  <Button size="sm" variant="ghost" onClick={() => window.open(model.sourceUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-2 h-4 w-4" />Setup guide</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {visibleModels.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No models match this search.</CardContent></Card>}

        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          <p className="mb-1 flex items-center gap-2 font-semibold text-foreground"><Check className="h-4 w-4 text-primary" />Voice cloning permission</p>
          Clone only your own voice or a voice for which you have explicit permission. Review each model's licence, checkpoint terms and dataset terms before commercial use.
        </div>
      </div>
    </main>
  );
}
