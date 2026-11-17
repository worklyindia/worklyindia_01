type MediaPipeAudioModule = {
  FilesetResolver: {
    forAudioTasks(path: string): Promise<unknown>;
  };
  TextToSpeech: {
    createFromOptions(
      fileset: unknown,
      options: {
        baseOptions: { modelAssetPath: string; delegate: "GPU" | "CPU" };
        defaultVoiceId: string;
        speakingRate: number;
      },
    ): Promise<{
      synthesize(text: string, options?: { voiceId?: string }): Promise<{
        samples: Float32Array;
        sampleRateHz: number;
      }>;
      close(): void;
    }>;
  };
};

const MODEL_URL =
  "https://huggingface.co/litert-community/Kokoro-82M/resolve/main/kokoro_int8_gpu_fp16.litertlm";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@latest/wasm";

let enginePromise: Promise<Awaited<ReturnType<MediaPipeAudioModule["TextToSpeech"]["createFromOptions"]>>> | null = null;
let audioContext: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;
let playbackToken = 0;

function report(status: string, message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("workly-kokoro-status", {
      detail: { status, message },
    }));
  }
}

async function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      report("downloading", "Downloading Kokoro-82M model (about 295 MB) and preparing on-device voice…");
      // Load the MediaPipe Audio Tasks runtime only when the user enables Kokoro.
      const moduleUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@latest/+esm";
      const mediaPipe = await import(/* @vite-ignore */ moduleUrl) as MediaPipeAudioModule;
      const fileset = await mediaPipe.FilesetResolver.forAudioTasks(WASM_URL);
      try {
        const engine = await mediaPipe.TextToSpeech.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          defaultVoiceId: "af_heart",
          speakingRate: 1,
        });
        report("ready", "Kokoro-82M is ready. Speech is generated on this device.");
        return engine;
      } catch (error) {
        report("error", error instanceof Error ? error.message : "Kokoro model could not be loaded on this device.");
        throw error;
      }
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

export function isKokoroLanguageSupported(languageTag: string): boolean {
  const language = languageTag.toLowerCase().split("-")[0];
  return language === "en" || language === "hi";
}

/** Loads Kokoro only after an explicit user action; model weights are not part of the app bundle. */
export async function prepareKokoroTts(): Promise<void> {
  await getEngine();
}

export async function speakKokoroTts(text: string, languageTag: string): Promise<boolean> {
  if (!isKokoroLanguageSupported(languageTag)) return false;
  stopKokoroTts();
  const token = playbackToken;
  const engine = await getEngine();
  if (token !== playbackToken) return false;
  report("synthesizing", "Creating speech locally on this device…");
  const voiceId = languageTag.toLowerCase().startsWith("hi") ? "hf_alpha" : "af_heart";
  const audio = await engine.synthesize(text.slice(0, 4000), { voiceId });
  if (token !== playbackToken || !audio.samples.length) return false;

  const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) throw new Error("This browser does not support local audio playback.");
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new Context({ sampleRate: audio.sampleRateHz });
  }
  if (audioContext.state === "suspended") await audioContext.resume();

  const buffer = audioContext.createBuffer(1, audio.samples.length, audio.sampleRateHz);
  buffer.copyToChannel(audio.samples, 0);
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  activeSource = source;
  source.onended = () => {
    if (activeSource === source) {
      activeSource = null;
      report("finished", "Kokoro playback finished.");
      window.dispatchEvent(new CustomEvent("workly-voice-status", { detail: { status: "finished" } }));
    }
  };
  source.start();
  report("speaking", "Kokoro is speaking offline.");
  window.dispatchEvent(new CustomEvent("workly-voice-status", { detail: { status: "speaking" } }));
  return true;
}

export function stopKokoroTts(): void {
  playbackToken += 1;
  if (activeSource) {
    try { activeSource.stop(); } catch { /* already stopped */ }
    activeSource.disconnect();
    activeSource = null;
  }
}
