import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = "https://jubwzelupbntbetpajqb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4";

export interface AITaskStatusMeta {
  /** Unique id of the AI run — used to follow the same task over Realtime. */
  runId?: string;
  /** Real work phase reported by the AI / server. */
  phase?: 'started' | 'analyzing' | 'checking' | 'verifying' | 'finalizing' | 'completed' | 'failed';
  progress?: number;
}

/**
 * Client-observable milestones of the request. These are REAL events (not
 * timers): the request left the browser, the server accepted it, the server
 * returned data, the first reply token arrived. The chat header uses them to
 * keep the status truthful during the window where the server has not yet
 * pushed any `set_status` event of its own.
 */
export type AIChatLifecycle =
  | 'request_sent'
  | 'server_accepted'
  | 'server_returned_data'
  | 'reply_writing';

export interface AIChatStreamCallbacks {
  onStatus?: (text: string, meta?: AITaskStatusMeta) => void;
  /** Fired on real request milestones — see AIChatLifecycle. */
  onLifecycle?: (stage: AIChatLifecycle) => void;
  /** Fired once with the run id as soon as the server starts the task. */
  onRunId?: (runId: string) => void;
  onProgressMessage?: (text: string) => void;
  /** Image generation has started server-side — show the live "Creating image" card. */
  onImageStart?: () => void;
  /** A generated image is ready (public URL) — render it even if the model text omits it. */
  onImage?: (url: string) => void;
  onDelta?: (delta: string, fullText: string) => void;
  onCached?: (response: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Direct fetch to ai-career-chat edge function.
 * Reliable handling for both JSON cached responses and SSE streams.
 *
 * Error contract (Error.message will contain one of these prefixes when known):
 *   AUTH_REQUIRED        — session expired / 401-403
 *   USAGE_LIMIT          — plan/quota exhausted (HTTP 402/429 or text "limit")
 *   AI_UNAVAILABLE       — gateway/model failure (5xx, "All models")
 *   EMPTY_STREAM         — stream closed with no assistant content
 *   NETWORK              — fetch threw (offline / DNS / abort)
 *   TIMEOUT              — request timed out
 *   VISION_FAILED        — vision-specific failure
 */
// Errors safe to silently retry (transient). User-facing errors like AUTH_REQUIRED
// or USAGE_LIMIT must NOT be retried — they need user action.
const TRANSIENT_PREFIXES = ['NETWORK', 'AI_UNAVAILABLE'];
const isTransient = (msg: string): boolean =>
  TRANSIENT_PREFIXES.some(p => msg.startsWith(p + ':'));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * If the user's message is about their device / battery / network / IP /
 * fingerprint etc., attach a freshly measured device snapshot so the AI always
 * answers with LIVE values (captured at this exact moment), never stale rows.
 */
function extractUserText(body: Record<string, any>): string {
  if (typeof body.message === 'string' && body.message) return body.message;
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role !== 'user') continue;
    const c = m.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) {
      const t = c.map((p: any) => (typeof p === 'string' ? p : p?.text || '')).join(' ').trim();
      if (t) return t;
    }
  }
  return '';
}

async function attachLiveDeviceSnapshot(body: Record<string, any>): Promise<Record<string, any>> {
  try {
    const { isDeviceRelatedMessage, collectLiveDeviceSnapshot } = await import('@/lib/liveDeviceSnapshot');
    if (body.live_device) return body;
    const text = extractUserText(body);
    if (!isDeviceRelatedMessage(text)) return body;
    const snapshot = await collectLiveDeviceSnapshot();
    return snapshot ? { ...body, live_device: snapshot } : body;
  } catch {
    return body;
  }
}


export async function callAICareerChat(
  body: Record<string, any>,
  callbacks: AIChatStreamCallbacks,
  signal?: AbortSignal
): Promise<{ fullText: string; cached: boolean }> {
  // Pre-flight: if browser knows we're offline, fail fast with a clear message.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const err = new Error('NETWORK: device is offline');
    callbacks.onError?.(err);
    throw err;
  }

  // Live device snapshot (only for device-related questions)
  body = await attachLiveDeviceSnapshot(body);

  // Auto-retry transient failures with backoff. AI gateway hiccups
  // ("all models failed", 5xx, network blips) are almost always short-lived,
  // so we retry several times before ever showing the user an error.
  const MAX_ATTEMPTS = 4;
  let lastError: Error | null = null;


  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Buffer deltas per-attempt so a failed retry doesn't leave partial text
    // in the chat bubble. Flush to the real callback only on success.
    const bufferedDeltas: Array<{ delta: string; full: string }> = [];
    const wrapped: AIChatStreamCallbacks = {
      onStatus: callbacks.onStatus,
      onLifecycle: callbacks.onLifecycle,
      onRunId: callbacks.onRunId,
      onProgressMessage: callbacks.onProgressMessage,
      onImageStart: callbacks.onImageStart,
      onImage: callbacks.onImage,
      onDelta: (delta, full) => { bufferedDeltas.push({ delta, full }); },
      onCached: callbacks.onCached,
      onDone: callbacks.onDone,
      // Suppress onError on intermediate attempts; final throw reports it.
      onError: undefined,
    };

    try {
      const result = await callOnce(body, wrapped, signal);
      // Success — flush buffered deltas to the real callback now
      for (const { delta, full } of bufferedDeltas) {
        callbacks.onDelta?.(delta, full);
      }
      return result;
    } catch (e: any) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const msg = lastError.message || '';

      // Don't retry user-aborted requests or non-transient errors
      const aborted = signal?.aborted || msg.startsWith('TIMEOUT:');
      if (aborted || !isTransient(msg) || attempt === MAX_ATTEMPTS) {
        callbacks.onError?.(lastError);
        throw lastError;
      }

      console.warn(`[ai-chat] attempt ${attempt} failed (${msg.split(':')[0]}), retrying...`);
      // 0.8s → 1.8s → 3.2s — enough for a rate-limited/overloaded gateway to recover.
      await sleep(600 + attempt * 800);

    }
  }

  // Unreachable, but TS-safe
  if (lastError) { callbacks.onError?.(lastError); throw lastError; }
  throw new Error('AI_UNAVAILABLE: unknown failure');
}

async function callOnce(
  body: Record<string, any>,
  callbacks: AIChatStreamCallbacks,
  signal: AbortSignal | undefined
): Promise<{ fullText: string; cached: boolean }> {
  let response: Response;
  try {
    callbacks.onLifecycle?.('request_sent');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || SUPABASE_PUBLISHABLE_KEY;

    response = await fetch(`${SUPABASE_URL}/functions/v1/ai-career-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream, application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e: any) {
    const isAbort = e?.name === 'AbortError';
    // Only emit onError on the final attempt — caller will retry transient
    // failures, and we don't want to spam the UI with intermediate errors.
    const err = new Error(isAbort ? 'TIMEOUT: request was aborted' : `NETWORK: ${e?.message || 'fetch failed'}`);
    throw err;
  }

  if (!response.ok) {
    const txt = await response.text().catch(() => '');
    let prefix = 'AI_UNAVAILABLE';
    if (response.status === 401 || response.status === 403) prefix = 'AUTH_REQUIRED';
    else if (response.status === 402 || response.status === 429) prefix = 'USAGE_LIMIT';
    else if (response.status >= 500) prefix = 'AI_UNAVAILABLE';

    // Try to surface server's structured error message
    let serverMsg = '';
    try {
      const parsed = JSON.parse(txt);
      serverMsg = parsed?.userMessage || parsed?.error || '';
      if (parsed?.type === 'VISION_FAILED') prefix = 'VISION_FAILED';
      if (parsed?.type === 'AI_BUSY' || String(parsed?.error || '').includes('AI_BUSY')) prefix = 'AI_BUSY';
    } catch {
      serverMsg = txt.slice(0, 200);
      if (serverMsg.includes('AI_BUSY')) prefix = 'AI_BUSY';
    }
    const err = new Error(`${prefix}: HTTP ${response.status}${serverMsg ? ' — ' + serverMsg : ''}`);
    callbacks.onError?.(err);
    throw err;
  }

  // Server accepted the request and is now doing the real work.
  callbacks.onLifecycle?.('server_accepted');

  const contentType = response.headers.get('content-type') || '';

  // JSON cached/non-stream response
  if (contentType.includes('application/json')) {
    const json = await response.json().catch(() => null);
    callbacks.onLifecycle?.('server_returned_data');
    if (!json) {
      const err = new Error('AI_UNAVAILABLE: malformed JSON response');
      callbacks.onError?.(err);
      throw err;
    }
    if (json?.error || json?.debug) {
      const prefix = json?.type === 'VISION_FAILED' ? 'VISION_FAILED' : 'AI_UNAVAILABLE';
      const err = new Error(`${prefix}: ${json?.userMessage || json?.error || 'AI returned an error'}`);
      callbacks.onError?.(err);
      throw err;
    }
    if (json?.success === true && json?.imageUrl) {
      const text = `Ye lo tumhari image! 🎨✨\n\n![Generated Image](${json.imageUrl})`;
      callbacks.onDelta?.(text, text);
      callbacks.onDone?.(text);
      return { fullText: text, cached: false };
    }
    if (json?.cached === true) {
      const text = json.response || json.message || '';
      callbacks.onCached?.(text);
      callbacks.onDone?.(text);
      return { fullText: text, cached: true };
    }
    // Non-streamed JSON with text
    const text = json?.response || json?.message || '';
    if (!text) {
      const err = new Error('EMPTY_STREAM: server returned no content');
      callbacks.onError?.(err);
      throw err;
    }
    callbacks.onDelta?.(text, text);
    callbacks.onDone?.(text);
    return { fullText: text, cached: false };
  }

  // SSE stream
  if (!response.body) {
    const err = new Error('AI_UNAVAILABLE: no response body');
    callbacks.onError?.(err);
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let sawAnyEvent = false;
  let serverError: { prefix: string; message: string } | null = null;

  const processLine = (line: string) => {
    if (!line.startsWith('data: ')) return;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') return;
    try {
      const parsed = JSON.parse(payload);
      sawAnyEvent = true;

      // Server-emitted structured error event
      if (parsed.type === 'error') {
        serverError = {
          prefix: parsed.code || 'AI_UNAVAILABLE',
          message: parsed.message || 'AI returned an error',
        };
        return;
      }
      if (parsed.type === 'run' && parsed.run_id) {
        callbacks.onRunId?.(parsed.run_id);
        return;
      }
      if (parsed.type === 'status' && parsed.text) {
        callbacks.onStatus?.(parsed.text, {
          runId: parsed.run_id,
          phase: parsed.phase,
          progress: parsed.progress,
        });
        return;
      }
      if (parsed.type === 'progress_message' && parsed.text) {
        callbacks.onProgressMessage?.(parsed.text);
        return;
      }
      if (parsed.type === 'image_start') {
        callbacks.onImageStart?.();
        return;
      }
      if (parsed.type === 'image' && parsed.url) {
        callbacks.onImage?.(parsed.url);
        return;
      }
      const content = parsed.choices?.[0]?.delta?.content;
      if (content) {
        if (!fullText) callbacks.onLifecycle?.('reply_writing');
        fullText += content;
        callbacks.onDelta?.(content, fullText);
      }
    } catch {
      // ignore per-chunk parse errors
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) processLine(line);
    }
    // Flush any remaining buffered line
    if (buffer.trim()) processLine(buffer.trim());
  } catch (e: any) {
    const isAbort = e?.name === 'AbortError';
    const err = new Error(isAbort ? 'TIMEOUT: stream aborted' : `NETWORK: ${e?.message || 'stream read failed'}`);
    callbacks.onError?.(err);
    throw err;
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }

  if (serverError) {
    const err = new Error(`${serverError.prefix}: ${serverError.message}`);
    callbacks.onError?.(err);
    throw err;
  }

  if (!fullText) {
    const err = new Error(
      sawAnyEvent
        ? 'EMPTY_STREAM: AI sent status updates but no content'
        : 'EMPTY_STREAM: AI returned no response'
    );
    callbacks.onError?.(err);
    throw err;
  }

  callbacks.onDone?.(fullText);
  return { fullText, cached: false };
}
