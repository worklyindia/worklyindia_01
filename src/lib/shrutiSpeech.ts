import { requestOwnerPhoneTranscription } from '@/lib/ownerPhoneVoiceRelay';
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
let transcriptionQueue: Float32Array[] = [];
let pendingTranscriptParts: string[] = [];
let transcriptFlushTimer: ReturnType<typeof setTimeout> | null = null;
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
  // Speech recognition is performed by the paired Workly Voice Android app.
  // The website only captures microphone audio and securely queues it for the phone.
  return Promise.resolve();
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

function scheduleTranscriptFlush() {
  if (transcriptFlushTimer) clearTimeout(transcriptFlushTimer);
  if (!active || speechStartedAt || chunks.length || transcriptionQueue.length || transcribing || !pendingTranscriptParts.length) return;
  transcriptFlushTimer = setTimeout(() => {
    transcriptFlushTimer = null;
    if (!active || speechStartedAt || chunks.length || transcriptionQueue.length || transcribing) return;
    const text = pendingTranscriptParts.join(' ').replace(/\s+/g, ' ').trim();
    pendingTranscriptParts = [];
    if (text) emit('workly-voice-transcript', { text, languageTag: 'auto', source: 'workly-voice-android-app-long-audio' });
  }, 1800);
}

async function processTranscriptionQueue() {
  if (transcribing || !active) return;
  transcribing = true;
  emit('workly-shruti-status', { status: 'transcribing', queuedSegments: transcriptionQueue.length });
  try {
    while (active && transcriptionQueue.length) {
      const pcm = transcriptionQueue.shift()!;
      const wav = new ArrayBuffer(44 + pcm.length * 2);
      const view = new DataView(wav);
      const writeText = (offset: number, value: string) => {
        for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
      };
      writeText(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); writeText(8, 'WAVE');
      writeText(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
      view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
      view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeText(36, 'data');
      view.setUint32(40, pcm.length * 2, true);
      for (let i = 0; i < pcm.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, pcm[i]));
        view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
      }
      const bytes = new Uint8Array(wav);
      let binary = '';
      const stride = 0x8000;
      for (let i = 0; i < bytes.length; i += stride) binary += String.fromCharCode(...bytes.subarray(i, i + stride));

      let result: Awaited<ReturnType<typeof requestOwnerPhoneTranscription>> | null = null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3 && active; attempt += 1) {
        try {
          result = await requestOwnerPhoneTranscription(btoa(binary));
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
      if (!active) break;
      if (!result) {
        emit('workly-voice-error', { message: lastError instanceof Error ? lastError.message : 'A speech segment could not be transcribed after 3 attempts.' });
        continue;
      }
      const text = result.text.trim();
      if (text) pendingTranscriptParts.push(text);
      emit('workly-shruti-status', {
        status: 'segment-transcribed',
        language: result.languageTag,
        queuedSegments: transcriptionQueue.length,
      });
    }
  } finally {
    transcribing = false;
    if (active && transcriptionQueue.length) void processTranscriptionQueue();
    else scheduleTranscriptFlush();
  }
}

function submitUtterance() {
  if (!chunks.length) return;
  const captured = chunks;
  chunks = [];
  const length = captured.reduce((total, chunk) => total + chunk.length, 0);
  const joined = new Float32Array(length);
  let offset = 0;
  for (const chunk of captured) { joined.set(chunk, offset); offset += chunk.length; }
  const pcm = resample16k(joined, context?.sampleRate || 48000);
  if (pcm.length < 4800) {
    scheduleTranscriptFlush();
    return;
  }
  // Each segment stays below the relay's 1.3 MB WAV limit. Queue it instead
  // of dropping it when an earlier segment is still being transcribed.
  if (transcriptionQueue.length >= 40) {
    emit('workly-voice-error', { message: 'Too much speech is queued. Pause briefly while ChatWork finishes transcribing the earlier audio.' });
    scheduleTranscriptFlush();
    return;
  }
  transcriptionQueue.push(pcm);
  emit('workly-shruti-status', { status: 'segment-queued', queuedSegments: transcriptionQueue.length });
  void processTranscriptionQueue();
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
  transcriptionQueue = [];
  pendingTranscriptParts = [];
  if (transcriptFlushTimer) clearTimeout(transcriptFlushTimer);
  transcriptFlushTimer = null;
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
  transcriptionQueue = [];
  pendingTranscriptParts = [];
  if (transcriptFlushTimer) clearTimeout(transcriptFlushTimer);
  transcriptFlushTimer = null;
  speechStartedAt = 0;
  lastVoiceAt = 0;
  noiseFloor = 0.003;
  speechThreshold = 0.018;
  transcribing = false;
}
