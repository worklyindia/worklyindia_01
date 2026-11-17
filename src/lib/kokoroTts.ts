type MediaPipeAudioModule = {
  FilesetResolver: {
    forAudioTasks(path: string): Promise<unknown>;
  };
  TextToSpeech: {
    createFromOptions(
      fileset: unknown,
      options: {
        baseOptions: { modelAssetPath: string; delegate: "GPU" | "CPU" };
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
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@1.2.3/wasm";

// Kokoro LiteRT bundles must retain their original filename inside MediaPipe's
// Wasm filesystem. Without this, some Tasks Audio versions save every model as
// "model.litertlm" and mis-detect Kokoro as another TTS architecture.
const DEFAULT_MODEL_FILE = "model.litertlm";
let activeModelUrl = MODEL_URL;
let filenameWorkaroundInstalled = false;

function installKokoroFilenameWorkaround() {
  if (filenameWorkaroundInstalled) return;
  const globalModule = globalThis as typeof globalThis & { ModuleFactory?: (...args: unknown[]) => Promise<any> };
  let factory = globalModule.ModuleFactory;
  const wrapFactory = (current: typeof factory) => {
    if (typeof current !== "function" || (current as any).__worklyKokoroFilenameWrapped) return current;
    return Object.assign(async (...args: unknown[]) => {
      const module = await current(...args);
      if (!module || typeof module.FS_createDataFile !== "function") return module;
      const getFilename = () => {
        try {
          const pathname = new URL(activeModelUrl, window.location.href).pathname;
          const filename = pathname.split("/").pop()?.replace(/[^A-Za-z0-9._-]/g, "_");
          return filename && filename.endsWith(".litertlm") ? filename : undefined;
        } catch {
          return undefined;
        }
      };
      const remap = (path: string) => {
        const filename = getFilename();
        return filename && path === `/${DEFAULT_MODEL_FILE}` ? `/${filename}` : path;
      };
      const createDataFile = module.FS_createDataFile;
      module.FS_createDataFile = (parent: string, name: string, ...rest: unknown[]) =>
        createDataFile.call(module, parent, parent === "/" && name === DEFAULT_MODEL_FILE ? (getFilename() || name) : name, ...rest);
      const unlink = module.FS_unlink;
      if (typeof unlink === "function") module.FS_unlink = (path: string) => unlink.call(module, remap(path));
      const createTextToSpeech = module.createTextToSpeech;
      if (typeof createTextToSpeech === "function") {
        module.createTextToSpeech = (path: string, ...rest: unknown[]) =>
          createTextToSpeech.call(module, remap(path), ...rest);
      }
      return module;
    }, { __worklyKokoroFilenameWrapped: true });
  };
  factory = wrapFactory(factory);
  Object.defineProperty(globalModule, "ModuleFactory", {
    configurable: true,
    get: () => factory,
    set: (nextFactory) => { factory = wrapFactory(nextFactory); },
  });
  filenameWorkaroundInstalled = true;
}

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
      const moduleUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@1.2.3/+esm";
      const mediaPipe = await import(/* @vite-ignore */ moduleUrl) as MediaPipeAudioModule;
      installKokoroFilenameWorkaround();
      const fileset = await mediaPipe.FilesetResolver.forAudioTasks(WASM_URL);
      try {
        const engine = await mediaPipe.TextToSpeech.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          speakingRate: 1,
        });
        report("ready", "Kokoro-82M is ready. Speech is generated on this device.");
        return engine;
      } catch (gpuError) {
        // Some Android WebViews do not expose WebGPU. Retry with the CPU bundle
        // rather than failing outright on those devices.
        report("downloading", "GPU voice is unavailable here. Trying Kokoro CPU mode…");
        const cpuModelUrl = "https://huggingface.co/litert-community/Kokoro-82M/resolve/main/kokoro_int8_fp16.litertlm";
        activeModelUrl = cpuModelUrl;
        try {
          const engine = await mediaPipe.TextToSpeech.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: cpuModelUrl, delegate: "CPU" },
            speakingRate: 1,
          });
          report("ready", "Kokoro-82M is ready in CPU mode. Speech is generated on this device.");
          return engine;
        } catch (cpuError) {
          const detail = cpuError instanceof Error ? cpuError.message : (gpuError instanceof Error ? gpuError.message : "Unsupported device");
          report("error", `Kokoro could not start in GPU or CPU mode: ${detail}`);
          throw cpuError;
        }
      }
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

/** Force a clean engine reload while reusing the browser's cached model file when available. */
export async function reloadKokoroTts(): Promise<void> {
  stopKokoroTts();
  if (enginePromise) {
    try {
      const currentEngine = await enginePromise;
      currentEngine.close();
    } catch {
      // A failed initialization has no engine to close; allow a clean retry.
    }
  }
  enginePromise = null;
  activeModelUrl = MODEL_URL;
  await prepareKokoroTts();
}

export function isKokoroLanguageSupported(languageTag: string): boolean {
  const language = languageTag.toLowerCase().split("-")[0];
  return language === "en" || language === "hi";
}

/** Loads Kokoro only after an explicit user action; model weights are not part of the app bundle. */
export async function prepareKokoroTts(): Promise<void> {
  const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) throw new Error("This browser does not support local audio playback.");
  // Create/unlock Web Audio during the explicit user tap so later AI replies
  // can play after the asynchronous model download has completed.
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new Context({ sampleRate: 24000 });
  }
  if (audioContext.state === "suspended") await audioContext.resume();
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
  let audio: { samples: Float32Array; sampleRateHz: number };
  try {
    audio = await engine.synthesize(text.slice(0, 4000), { voiceId });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Kokoro synthesis failed.";
    report("error", `Kokoro loaded, but speech generation failed: ${detail}`);
    throw error;
  }
  if (token !== playbackToken) return false;
  if (!audio.samples?.length || !audio.sampleRateHz) {
    const message = "Kokoro returned empty audio. Check the selected voice and model compatibility.";
    report("error", message);
    throw new Error(message);
  }

  const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) throw new Error("This browser does not support local audio playback.");
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new Context({ sampleRate: audio.sampleRateHz });
  }
  if (audioContext.state === "suspended") await audioContext.resume();
  if (audioContext.state !== "running") {
    throw new Error("Audio playback is blocked by the browser. Tap the page once and try again.");
  }

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
