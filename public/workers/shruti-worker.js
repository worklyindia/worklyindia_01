/* Shruti offline speech recognition worker.
 * Model: Shruti Hindi (Hindi, Indian English, Hinglish), Apache-2.0.
 * Engine: Cactus needle WebAssembly, Apache-2.0. Audio stays on-device.
 */
'use strict';
importScripts('https://cdn.jsdelivr.net/gh/udgamlabs/shruti@main/examples/browser/needle/needle.js');

const MODEL_URL = 'https://pub-d7e0943326ee4d9da8045f267a70faac.r2.dev/shruti/shruti.cact';
const MODEL_SHA256 = 'b189e954aaed4a9fd41acbad3ac05e486381e96325b22a4c695b9ea5153d7065';
const MODEL_BYTES = 29546527;
const CACHE_NAME = 'workly-shruti-hi-v1';
const MAGIC = [0x84, 0x2a, 0xe1, 0x05];
let engine = null;
let ready = false;

function send(message) { self.postMessage(message); }
function validModel(bytes) {
  if (!bytes || bytes.length < 1024) return false;
  return MAGIC.every((byte, index) => bytes[index] === byte);
}
async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (value) => value.toString(16).padStart(2, '0')).join('');
}
async function loadModel() {
  let cache = null;
  try { cache = await caches.open(CACHE_NAME); } catch { /* storage may be unavailable */ }
  if (cache) {
    const cached = await cache.match(MODEL_URL);
    if (cached) {
      const bytes = new Uint8Array(await cached.arrayBuffer());
      if (validModel(bytes) && await sha256Hex(bytes) === MODEL_SHA256) return { bytes, source: 'cache' };
      await cache.delete(MODEL_URL);
    }
  }
  const response = await fetch(MODEL_URL, { mode: 'cors', credentials: 'omit' });
  if (!response.ok || !response.body) throw new Error('Shruti model download failed (HTTP ' + response.status + ').');
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  let lastReport = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    chunks.push(part.value);
    loaded += part.value.length;
    if (Date.now() - lastReport > 100) {
      lastReport = Date.now();
      send({ type: 'progress', loaded, total: MODEL_BYTES });
    }
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (!validModel(bytes)) throw new Error('Downloaded file is not a valid Shruti model.');
  if (await sha256Hex(bytes) !== MODEL_SHA256) throw new Error('Shruti model checksum verification failed.');
  if (cache) {
    try { await cache.put(MODEL_URL, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } })); } catch { /* model works for this session */ }
  }
  return { bytes, source: 'network' };
}
function alloc(size) {
  const pointer = engine._malloc(size);
  if (!pointer) throw new Error('Not enough memory to run Shruti.');
  return pointer;
}
function copyIn(bytes) {
  const pointer = alloc(Math.max(4, bytes.length));
  engine.HEAPU8.set(bytes, pointer);
  return pointer;
}
function lastError() {
  try { return engine.UTF8ToString(engine._needle_last_error()) || 'Speech engine error.'; }
  catch { return 'Speech engine error.'; }
}
async function initialize() {
  try {
    if (!ready) {
      const modelPromise = loadModel();
      const wasmResponse = await fetch('https://cdn.jsdelivr.net/gh/udgamlabs/shruti@main/examples/browser/needle/needle.wasm');
      if (!wasmResponse.ok) throw new Error('Could not download the Shruti runtime.');
      const wasmBinary = await wasmResponse.arrayBuffer();
      const model = await modelPromise;
      engine = await createNeedle({ wasmBinary, print: () => {}, printErr: () => {} });
      const pointer = copyIn(model.bytes);
      const code = engine._needle_load(pointer, BigInt(model.bytes.length));
      engine._free(pointer);
      if (code < 0) throw new Error(lastError());
      if (!(engine._needle_models() & 2)) throw new Error('Shruti speech model was not found.');
      ready = true;
      send({ type: 'ready', source: model.source });
    } else send({ type: 'ready', source: 'memory' });
  } catch (error) {
    send({ type: 'error', stage: 'init', message: error instanceof Error ? error.message : String(error) });
  }
}
function transcribe(message) {
  const pcm = message.pcm;
  const audioPointer = copyIn(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  const outputCapacity = Math.max(65536, Math.ceil(pcm.length / 16000) * 4096 + 16384);
  const outputPointer = alloc(outputCapacity);
  try {
    const started = performance.now();
    const count = engine._needle_transcribe(audioPointer, pcm.length, 0, 0, 0, outputPointer, outputCapacity);
    if (count < 0) throw new Error(lastError());
    const result = JSON.parse(engine.UTF8ToString(outputPointer));
    send({ type: 'result', id: message.id, text: result.text || '', language: result.language || 'und', ms: performance.now() - started });
  } catch (error) {
    send({ type: 'error', id: message.id, stage: 'transcribe', message: error instanceof Error ? error.message : String(error) });
  } finally {
    engine._free(outputPointer);
    engine._free(audioPointer);
  }
}
self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === 'init') return initialize();
  if (message.type === 'transcribe') {
    if (!ready) return send({ type: 'error', id: message.id, stage: 'transcribe', message: 'Shruti is not ready.' });
    transcribe(message);
  }
};
