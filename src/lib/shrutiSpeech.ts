type WorkerMessage =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; source: string }
  | { type: 'result'; id: number; text: string; language: string; ms: number }
  | { type: 'error'; id?: number; stage: string; message: string };

let worker: Worker | null = null;
let workerReady: Promise<void> | null = null;
let requestId = 0;
let media: MediaStream | null = null;
let context: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let highPass: BiquadFilterNode | null = null;
let chunks: Float32Array[] = [];
let preRoll: Float32Array[] = [];
let speechStartedAt = 0;
let lastVoiceAt = 0;
let noiseFloor = 0.003;
let speechThreshold = 0.018;
let voiceCandidateFrames = 0;
let transcribing = false;
let active = false;

function emit(name: string, detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker('/workers/shruti-worker.js');
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        emit('workly-shruti-status', { status: 'downloading', loaded: message.loaded, total: message.total });
      } else if (message.type === 'ready') {
        emit('workly-shruti-status', { status: 'ready', source: message.source });
      } else if (message.type === 'result') {
        const text = message.text.trim();
        emit('workly-shruti-status', { status: 'transcribed', language: message.language, ms: message.ms });
        if (active && text) emit('workly-voice-transcript', { text, languageTag: message.language === 'hi' ? 'hi-IN' : message.language === 'en' ? 'en-IN' : 'und', source: 'shruti-on-device' });
        transcribing = false;
      } else if (message.type === 'error') {
        emit('workly-shruti-status', { status: 'error', message: message.message });
        transcribing = false;
      }
    };
    worker.onerror = () => emit('workly-voice-error', { message: 'Shruti speech engine could not start in this browser.' });
  }
  return worker;
}

export function prepareShrutiRecognition(): Promise<void> {
  if (workerReady) return workerReady;
  workerReady = new Promise((resolve, reject) => {
    const current = getWorker();
    const timeout = window.setTimeout(() => reject(new Error('Shruti took too long to load. Please try again.')), 120000);
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
  emit('workly-shruti-status', { status: 'transcribing' });
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
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      latency: 0.02,
    },
  });
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('This device does not support on-device audio capture.');
  context = new AudioContextClass();
  await context.resume();
  source = context.createMediaStreamSource(media);
  highPass = context.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 110;
  highPass.Q.value = 0.707;
  processor = context.createScriptProcessor(4096, 1, 1);
  const silentGain = context.createGain();
  silentGain.gain.value = 0;
  source.connect(highPass);
  highPass.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(context.destination);
  chunks = [];
  preRoll = [];
  noiseFloor = 0.003;
  speechThreshold = 0.018;
  voiceCandidateFrames = 0;
  active = true;
  speechStartedAt = 0;
  lastVoiceAt = 0;
  processor.onaudioprocess = (event) => {
    if (!active) return;
    const input = event.inputBuffer.getChannelData(0);
    const frame = new Float32Array(input);
    let energy = 0;
    let peak = 0;
    for (let i = 0; i < input.length; i += 1) {
      const sample = Math.abs(input[i]);
      energy += input[i] * input[i];
      if (sample > peak) peak = sample;
    }
    const rms = Math.sqrt(energy / input.length);
    const now = Date.now();

    // Track the room-noise baseline only while speech is not active.
    // A high-pass filter above removes much of low-frequency wind/handling rumble.
    if (!speechStartedAt) {
      noiseFloor = noiseFloor * 0.94 + Math.min(rms, 0.025) * 0.06;
      speechThreshold = Math.max(0.012, Math.min(0.035, noiseFloor * 3.2 + 0.006));
      preRoll.push(frame);
      if (preRoll.length > 4) preRoll.shift();
    }

    const isVoiceFrame = rms >= speechThreshold && peak >= speechThreshold * 1.8;
    if (isVoiceFrame) {
      voiceCandidateFrames += 1;
      // Require sustained speech energy (about 250 ms) before treating sound as
      // a user interruption. Short clicks, gusts and isolated background peaks
      // must not stop the AI voice.
      if (!speechStartedAt && voiceCandidateFrames >= 3) {
        speechStartedAt = now;
        chunks = preRoll.map((part) => new Float32Array(part));
      }
      if (speechStartedAt) lastVoiceAt = now;
    } else if (!speechStartedAt) {
      voiceCandidateFrames = 0;
    }

    if (speechStartedAt) chunks.push(frame);

    // Longer hangover prevents short wind gusts or quiet syllable gaps from
    // chopping a sentence into multiple partial utterances.
    if (speechStartedAt && now - lastVoiceAt > 1500) {
      speechStartedAt = 0;
      lastVoiceAt = 0;
      voiceCandidateFrames = 0;
      preRoll = [];
      submitUtterance();
    } else if (speechStartedAt && now - speechStartedAt > 18000) {
      speechStartedAt = 0;
      lastVoiceAt = 0;
      preRoll = [];
      submitUtterance();
    }
  };
  emit('workly-voice-status', { status: 'listening', mode: 'shruti-on-device' });
  emit('workly-shruti-status', { status: 'listening' });
  return true;
}

export function stopShrutiRecognition(): void {
  active = false;
  if (processor) { processor.onaudioprocess = null; processor.disconnect(); processor = null; }
  if (source) { source.disconnect(); source = null; }
  if (highPass) { highPass.disconnect(); highPass = null; }
  if (media) { media.getTracks().forEach((track) => track.stop()); media = null; }
  if (context) { void context.close(); context = null; }
  chunks = [];
  preRoll = [];
  speechStartedAt = 0;
  lastVoiceAt = 0;
  noiseFloor = 0.003;
  speechThreshold = 0.018;
  transcribing = false;
}
