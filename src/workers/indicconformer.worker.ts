/// <reference lib="webworker" />
import { configureOrtWeb, loadHuggingfaceModel } from 'onnx-asr-web/browser';

type Incoming =
  | { type: 'init' }
  | { type: 'transcribe'; id: number; pcm: Float32Array };

const scope = self as DedicatedWorkerGlobalScope;
const MODEL_REPO = 'OpenVoiceOS/ai4bharat-indicconformer-gu-onnx';
const MODEL_CACHE = 'workly-indicconformer-gu-int8-v1';
const HF_PREFIX = 'https://huggingface.co/OpenVoiceOS/ai4bharat-indicconformer-gu-onnx/resolve/main/';
let model: Awaited<ReturnType<typeof loadHuggingfaceModel>> | null = null;
let initializing: Promise<void> | null = null;

function send(message: Record<string, unknown>) {
  scope.postMessage(message);
}

/**
 * Keep the large quantized model and its small metadata files in Cache Storage.
 * The cache is origin-scoped and survives normal website/app restarts.
 */
function installPersistentModelFetch() {
  const originalFetch = scope.fetch.bind(scope);
  scope.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
    if (!request.url.startsWith(HF_PREFIX) || request.method !== 'GET' || request.headers.has('range')) {
      return originalFetch(request);
    }

    try {
      const cache = await caches.open(MODEL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await originalFetch(request);
      if (response.ok && response.status === 200) {
        try { await cache.put(request, response.clone()); } catch { /* model can still run for this session */ }
      }
      return response;
    } catch {
      return originalFetch(request);
    }
  }) as typeof fetch;
}

async function initialize() {
  if (model) {
    send({ type: 'ready', source: 'memory' });
    return;
  }
  if (initializing) return initializing;

  initializing = (async () => {
    installPersistentModelFetch();
    configureOrtWeb({
      wasmPaths: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/',
    });
    model = await loadHuggingfaceModel(MODEL_REPO, {
      revision: 'main',
      quantization: 'int8',
    });
    send({ type: 'ready', source: 'cache-or-network' });
  })();

  try {
    await initializing;
  } catch (error) {
    model = null;
    send({
      type: 'error',
      stage: 'init',
      message: error instanceof Error ? error.message : 'Gujarati speech model could not be loaded.',
    });
  } finally {
    initializing = null;
  }
}

async function transcribe(message: Extract<Incoming, { type: 'transcribe' }>) {
  if (!model) {
    send({ type: 'error', id: message.id, stage: 'transcribe', message: 'Gujarati speech model is not ready.' });
    return;
  }
  try {
    const started = performance.now();
    const result = await model.transcribeSamples(message.pcm, 16000);
    send({
      type: 'result',
      id: message.id,
      text: result.text || '',
      language: 'gu',
      ms: performance.now() - started,
    });
  } catch (error) {
    send({
      type: 'error',
      id: message.id,
      stage: 'transcribe',
      message: error instanceof Error ? error.message : 'Gujarati speech recognition failed.',
    });
  }
}

scope.onmessage = (event: MessageEvent<Incoming>) => {
  const message = event.data;
  if (message.type === 'init') void initialize();
  if (message.type === 'transcribe') void transcribe(message);
};
