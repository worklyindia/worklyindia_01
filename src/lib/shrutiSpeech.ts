type WorkerMessage =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; source: string }
  | { type: 'result'; id: number; text: string; language: string; ms: number }
  | { type: 'error'; id?: number; stage: string; message: string };

type RecognitionEngine = 'shruti' | 'indicconformer';

let worker: Worker | null = null;
let workerReady: Promise<void> | null = null;
let engine: RecognitionEngine = 'shruti';
let requestId = 0;
let media: MediaStream | null = null;
let context: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let chunks: Float32Array[] = [];
let speechStartedAt = 0;
let lastVoiceAt = 0;
let transcribing = false;
let active = false;

function emit(name: string, detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/**
 * Use the Gujarati IndicConformer only when Gujarati is an explicit device
 * language. Hindi and Indian English continue to use the smaller Shruti model.
 */
function preferredEngine(): RecognitionEngine {
  const languages = [...(navigator.languages || []), navigator.language, document.documentElement.lang]
    .filter(Boolean)
    .map((language) => language.toLowerCase());
  return languages.some((language) => language === 'gu' || language.startsWith('gu-'))
    ? 'indicconformer'
    : 'shruti';
}

function getWorker(): Worker {
  const preferred = preferredEngine();
  if (worker && engine !== preferred && !active) {
    worker.terminate();
    worker = null;
    workerReady = null;
  }
  if (!worker) {
    engine = preferred;
    worker = engine === 'indicconformer'
      ? new Worker(new URL('../workers/indicconformer.worker.ts', import.meta.url), { type: 'module' })
      : new Worker('/workers/shruti-worker.js');
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        emit('workly-shruti-status', { status: 'downloading', loaded: message.loaded, total: message.total, engine });
      } else if (message.type === 'ready') {
        emit('workly-shruti-status', { status: 'ready', source: message.source, engine });
      } else if (message.type === 'result') {
        const text = message.text.trim();
        const languageTag = engine === 'indicconformer'
          ? 'gu-IN'
          : message.language === 'hi' ? 'hi-IN' : message.language === 'en' ? 'en-IN' : 'und';
        emit('workly-shruti-status', { status: 'transcribed', language: message.language, ms: message.ms, engine });
        if (active && text) emit('workly-voice-transcript', {
          text,
          languageTag,
          source: engine === 'indicconformer' ? 'indicconformer-gu-int8' : 'shruti-on-device',
        });
        transcribing = false;
      } else if (message.type === 'error') {
        emit('workly-shruti-status', { status: 'error', message: message.message, engine });
        transcribing = false;
        if (message.stage === 'transcribe') {
          emit('workly-voice-error', { message: message.message });
        }
      }
    };
    worker.onerror = () => emit('workly-voice-error', {
      message: engine === 'indicconformer'
        ? 'Gujarati IndicConformer speech engine could not start in this browser.'
        : 'Shruti speech engine could not start in this browser.',
    });
  }
  return worker;
}

export function prepareShrutiRecognition(): Promise<void> {
  if (workerReady) return workerReady;
  const selectedEngine = preferredEngine();
  workerReady = new Promise((resolve, reject) => {
    const current = getWorker();
    const timeoutMs = selectedEngine === 'indicconformer' ? 480000 : 120000;
    const modelName = selectedEngine === 'indicconformer' ? 'Gujarati IndicConformer' : 'Shruti';
    const timeout = window.setTimeout(() => {
      current.removeEventListener('message', onMessage);
      workerReady = null;
      reject(new Error(`${modelName} took too long to load. Check your internet connection and try again.`));
    }, timeoutMs);
    const onMessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === 'ready') {
        window.clearTimeout(timeout);
        current.removeEventListener('message', onMessage);
        resolve();
      } else if (event.data.type === 'error' && event.data.stage === 'init') {
        window.clearTimeout(timeout);
        current.removeEventListener('message', onMessage);
        workerReady = null;
        reject(new Error(event.data.message));
      }
    };
    current.addEventListener('message', onMessage);
    current.postMessage({ type: 'init' });
  }).catch((error) => { workerReady = null; throw error; });
  return workerReady;
}

function resample16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === 16000) return input;
  const outputLength = Math.max(1, Math.round(input.length * 16000 / inputRate));
  const output = new Float32Array(outputLength);
  const ratio = inputRate / 16000;
  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = position - left;
    output[i] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

function submitUtterance() {
  if (!chunks.length || transcribing || !worker) return;
  const captured = chunks;
  chunks = [];
  const length = captured.reduce((total, chunk) => total + chunk.length, 0);
  const joined = new Float32Array(length);
  let offset = 0;
  for (const chunk of captured) { joined.set(chunk, offset); offset += chunk.length; }
  const pcm = resample16k(joined, context?.sampleRate || 48000);
  if (pcm.length < 4800) return;
  transcribing = true;
  emit('workly-shruti-status', { status: 'transcribing', engine });
  const id = ++requestId;
  worker.postMessage({ type: 'transcribe', id, pcm }, [pcm.buffer]);
}

export async function startShrutiRecognition(): Promise<boolean> {
  if (active) return true;
  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
    throw new Error('On-device voice typing needs microphone permission on the secure Workly India website/app.');
  }
  await prepareShrutiRecognition();
  media = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('This device does not support on-device audio capture.');
  context = new AudioContextClass();
  await context.resume();
  source = context.createMediaStreamSource(media);
  processor = context.createScriptProcessor(4096, 1, 1);
  const silentGain = context.createGain();
  silentGain.gain.value = 0;
  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(context.destination);
  chunks = [];
  active = true;
  speechStartedAt = 0;
  lastVoiceAt = 0;
  processor.onaudioprocess = (event) => {
    if (!active || transcribing) return;
    const input = event.inputBuffer.getChannelData(0);
    let energy = 0;
    for (let i = 0; i < input.length; i += 1) energy += input[i] * input[i];
    const rms = Math.sqrt(energy / input.length);
    const now = Date.now();
    if (rms > 0.012) {
      if (!speechStartedAt) speechStartedAt = now;
      lastVoiceAt = now;
    }
    if (speechStartedAt) chunks.push(new Float32Array(input));
    if (speechStartedAt && now - lastVoiceAt > 950) {
      speechStartedAt = 0;
      lastVoiceAt = 0;
      submitUtterance();
    } else if (speechStartedAt && now - speechStartedAt > 18000) {
      speechStartedAt = 0;
      lastVoiceAt = 0;
      submitUtterance();
    }
  };
  emit('workly-voice-status', { status: 'listening', mode: engine === 'indicconformer' ? 'indicconformer-gu-int8' : 'shruti-on-device' });
  emit('workly-shruti-status', { status: 'listening', engine });
  return true;
}

export function stopShrutiRecognition(): void {
  active = false;
  if (processor) { processor.onaudioprocess = null; processor.disconnect(); processor = null; }
  if (source) { source.disconnect(); source = null; }
  if (media) { media.getTracks().forEach((track) => track.stop()); media = null; }
  if (context) { void context.close(); context = null; }
  chunks = [];
  speechStartedAt = 0;
  lastVoiceAt = 0;
  transcribing = false;
}
