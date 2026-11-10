/**
 * Shared AI Chat Brain — single source of truth for all reply channels.
 *
 * Telegram, WhatsApp, Email reply functions delegate to this helper which
 * internally calls the `ai-career-chat` edge function. That gives every
 * channel:
 *
 *   • The SAME system prompt, tools, models, and behaviour as the in-app AI Chat page
 *   • Image generation (generate_image_for_user tool)
 *   • PDF / file generation (create_file_for_user tool)
 *   • Web search, vision, profile lookups, etc.
 *   • Single source of truth for plan/usage limits — `ai-career-chat`
 *     itself increments usage exactly ONCE per request via
 *     `incrementAIChatUsage`. Channel functions MUST NOT call
 *     `incrementAiChatUsage` again, otherwise users get double-counted.
 *
 * Returns the AI's final assistant text plus any media URLs (images / files)
 * that the AI generated, extracted from the markdown so each channel can send
 * them as native attachments instead of plain links.
 */

export interface BrainCallOptions {
  /** The end user's full message text (already stripped of bot patterns). */
  userMessage: string;
  /** Auth'd user id when the channel identity is linked to a Workly account. */
  userId: string | null;
  /** Channel hint — fed to the AI as system context so replies are formatted right. */
  channel: 'telegram' | 'whatsapp' | 'email';
  /** Optional language hint ('hi' | 'en'). The AI will auto-detect either way. */
  language?: 'hi' | 'en';
  /** Optional extra context block (profile data, diagnostic snapshot, etc.). */
  extraContext?: string;
  /** Optional history of prior turns to maintain conversation memory. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Hard timeout in ms. Defaults to 120s — long enough for image generation. */
  timeoutMs?: number;
}

export interface BrainCallResult {
  /** Final assistant text. Markdown image links and file links have been stripped/normalised. */
  text: string;
  /** Image URLs the AI generated this turn (in order). */
  images: string[];
  /** File URLs (PDFs, docs, etc.) the AI generated this turn (in order). */
  files: string[];
  /** True if a usage-limit response was returned (channel should send upgradeMessage). */
  limitReached: boolean;
  /** Limit-reached payload (when limitReached=true). */
  limitInfo?: { plan?: string; used?: number; limit?: number; message?: string };
  /** Model that produced the reply (for logging). */
  model?: string;
  /** Raw error message when the call failed entirely. */
  error?: string;
}

function pushUnique(target: string[], value?: string | null) {
  if (!value) return;
  if (!target.includes(value)) target.push(value);
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|svg)(\?[^\s)]*)?$/i;
const FILE_EXT_RE = /\.(pdf|docx?|xlsx?|pptx?|csv|zip|txt|rtf|odt|ods|odp)(\?[^\s)]*)?$/i;
// Match markdown image: ![alt](url)  AND markdown link: [label](url)
const MD_IMAGE_RE = /!\[[^\]]*\]\(([^)\s]+)\)/g;
const MD_LINK_RE = /(?<!\!)\[[^\]]*\]\(([^)\s]+)\)/g;
// Bare http(s) URLs as a fallback
const BARE_URL_RE = /https?:\/\/[^\s)<>'"]+/g;

/**
 * Extract image and file URLs from the AI's markdown reply, then return a
 * cleaned version of the text suitable for plain-text channels.
 */
function extractMedia(rawText: string): { text: string; images: string[]; files: string[] } {
  const images = new Set<string>();
  const files = new Set<string>();

  // 1) Markdown image syntax → image attachments
  for (const m of rawText.matchAll(MD_IMAGE_RE)) {
    if (m[1]) images.add(m[1]);
  }
  // 2) Markdown links → file attachments if extension matches
  for (const m of rawText.matchAll(MD_LINK_RE)) {
    const url = m[1];
    if (!url) continue;
    if (IMAGE_EXT_RE.test(url)) images.add(url);
    else if (FILE_EXT_RE.test(url)) files.add(url);
  }
  // 3) Bare URLs not already captured
  for (const m of rawText.matchAll(BARE_URL_RE)) {
    const url = m[0];
    if (images.has(url) || files.has(url)) continue;
    if (IMAGE_EXT_RE.test(url)) images.add(url);
    else if (FILE_EXT_RE.test(url)) files.add(url);
  }

  // Strip markdown image syntax from the text — the channel will send the
  // image as a native attachment, so the URL would be redundant noise.
  let text = rawText.replace(MD_IMAGE_RE, '').trim();
  // Collapse triple+ blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return { text, images: [...images], files: [...files] };
}

/**
 * Read the streaming SSE response from ai-career-chat and accumulate the full text.
 */
async function readSSEStream(response: Response): Promise<{ text: string; serverError?: string }> {
  if (!response.body) return { text: '', serverError: 'no_body' };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let serverError: string | undefined;

  const processLine = (line: string) => {
    if (!line.startsWith('data: ')) return;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') return;
    try {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'error') {
        serverError = parsed.message || parsed.code || 'ai_error';
        return;
      }
      const delta = parsed.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') fullText += delta;
    } catch {
      /* ignore per-chunk parse errors */
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
    if (buffer.trim()) processLine(buffer.trim());
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }

  return { text: fullText, serverError };
}

/**
 * Invoke ai-career-chat with a single user message and return the AI's reply
 * + any media it generated. Falls back to a friendly error message if the
 * AI is unreachable.
 */
export async function callAiChatBrain(opts: BrainCallOptions): Promise<BrainCallResult> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return {
      text: '',
      images: [],
      files: [],
      limitReached: false,
      error: 'SUPABASE env not configured',
    };
  }

  const channelHint = opts.channel === 'telegram'
    ? 'CHANNEL: Telegram. Keep replies under 200 words. Telegram supports HTML (<b>, <i>) but NOT markdown links — use plain URLs. When you generate an image or file, the channel will send it as a native attachment, so DO NOT also paste the URL in text.'
    : opts.channel === 'whatsapp'
    ? 'CHANNEL: WhatsApp. Keep replies under 200 words. Use *bold* for emphasis, plain URLs (no markdown links). Generated images/files are sent as native attachments — do not also paste the URL.'
    : 'CHANNEL: Email reply. Plain text style; use short paragraphs. Generated images/files are sent as inline attachments / links by the channel — keep the body conversational.';

  const langHint = opts.language === 'hi'
    ? 'LANGUAGE: Reply in Hindi/Hinglish.'
    : opts.language === 'en'
    ? 'LANGUAGE: Reply in English.'
    : 'LANGUAGE: Auto-detect from the user message.';

  // Build messages: a synthetic system "channel/context" message, then optional
  // history, then the current user message.
  const systemContext = [channelHint, langHint, opts.extraContext?.trim() || ''].filter(Boolean).join('\n\n');

  const messages: Array<any> = [];
  // ai-career-chat already injects its own master system prompt; we prepend
  // ours as an extra "user" priming turn so it survives without conflict.
  messages.push({
    role: 'user',
    content: `[SYSTEM CONTEXT — not from end user]\n${systemContext}\n[END SYSTEM CONTEXT]`,
  });
  messages.push({ role: 'assistant', content: 'Understood — I will follow that channel context.' });

  if (opts.history && opts.history.length > 0) {
    // Cap history to last 12 turns so we don't blow the prompt budget.
    for (const turn of opts.history.slice(-12)) {
      messages.push({ role: turn.role, content: turn.content });
    }
  }
  messages.push({ role: 'user', content: opts.userMessage });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-career-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Accept': 'text/event-stream, application/json',
      },
      body: JSON.stringify({
        messages,
        user_id: opts.userId || undefined,
        currentPage: `inbound-${opts.channel}`,
        hasImages: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    // Limit reached (HTTP 429 from ai-career-chat)
    if (resp.status === 429) {
      const body = await resp.json().catch(() => ({} as any));
      return {
        text: '',
        images: [],
        files: [],
        limitReached: true,
        limitInfo: { plan: body?.plan, message: body?.message },
      };
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return {
        text: '',
        images: [],
        files: [],
        limitReached: false,
        error: `HTTP ${resp.status}: ${errText.slice(0, 200)}`,
      };
    }

    const ct = resp.headers.get('content-type') || '';
    let rawText = '';

    let directImages: string[] = [];
    let directFiles: string[] = [];

    if (ct.includes('application/json')) {
      const json = await resp.json().catch(() => null);
      if (!json) {
        return { text: '', images: [], files: [], limitReached: false, error: 'malformed json' };
      }
      // Cached or single-shot text response shape
      if (json?.success && json?.imageUrl) {
        // generate-image action shape — not expected from chat path, but handle it
        rawText = `![image](${json.imageUrl})`;
      } else {
        rawText = json?.response || json?.message || '';
      }

      pushUnique(directImages, json?.image_url);
      pushUnique(directImages, json?.imageUrl);
      pushUnique(directFiles, json?.file_url);

      if (Array.isArray(json?.images)) {
        for (const url of json.images) pushUnique(directImages, url);
      }
      if (Array.isArray(json?.files)) {
        for (const url of json.files) pushUnique(directFiles, url);
      }
    } else {
      // SSE
      const { text, serverError } = await readSSEStream(resp);
      if (serverError && !text) {
        return { text: '', images: [], files: [], limitReached: false, error: serverError };
      }
      rawText = text;
    }

    if (!rawText.trim()) {
      return { text: '', images: [], files: [], limitReached: false, error: 'empty_response' };
    }

    const { text, images, files } = extractMedia(rawText);
    for (const url of directImages) pushUnique(images, url);
    for (const url of directFiles) pushUnique(files, url);

    return { text, images, files, limitReached: false };
  } catch (e: any) {
    clearTimeout(timer);
    const isAbort = e?.name === 'AbortError';
    return {
      text: '',
      images: [],
      files: [],
      limitReached: false,
      error: isAbort ? 'timeout' : (e?.message || 'unknown_error'),
    };
  }
}
