type BrowserRecognition = {
  processLocally?: boolean;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type BrowserRecognitionConstructor = {
  new (): BrowserRecognition;
  prototype: BrowserRecognition;
  available?: (options: { langs: string[]; processLocally: true }) => Promise<string>;
  install?: (options: { langs: string[]; processLocally: true }) => Promise<boolean>;
};

let recognition: BrowserRecognition | null = null;

const getRecognitionConstructor = (): BrowserRecognitionConstructor | undefined => {
  if (typeof window === 'undefined') return undefined;
  // Keep experimental Web Speech API typings local instead of redeclaring
  // DOM Window properties, which conflict with TypeScript's lib.dom types.
  const browserWindow = window as unknown as {
    SpeechRecognition?: BrowserRecognitionConstructor;
    webkitSpeechRecognition?: BrowserRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
};

/** General browser speech recognition support (local or browser-provided service). */
export function isBrowserLocalVoiceAvailable(): boolean {
  return !!getRecognitionConstructor();
}

/** True only when this browser exposes the experimental on-device recognition API. */
export function isBrowserOnDeviceVoiceAvailable(): boolean {
  const Ctor = getRecognitionConstructor();
  return !!Ctor && 'processLocally' in Ctor.prototype && !!Ctor.available;
}

export async function startBrowserLocalRecognition(language = 'en-US', allowBrowserService = false): Promise<boolean> {
  const Ctor = getRecognitionConstructor();
  if (!Ctor) throw new Error('Speech recognition is not supported in this browser. Please use the latest Chrome or Edge.');

  const lang = language || 'en-US';
  const supportsLocal = 'processLocally' in Ctor.prototype && typeof Ctor.available === 'function';
  let useLocal = supportsLocal;

  if (supportsLocal && Ctor.available) {
    const status = await Ctor.available({ langs: [lang], processLocally: true });
    if (status !== 'available') {
      if ((status === 'downloadable' || status === 'downloading') && typeof Ctor.install === 'function') {
        const installed = await Ctor.install({ langs: [lang], processLocally: true });
        if (!installed) throw new Error('Offline language pack could not be installed. Check internet and try again.');
        throw new Error('Offline language pack installed. Tap Start AI Call again.');
      }
      useLocal = false;
    }
  }

  if (!useLocal && !allowBrowserService) {
    throw new Error('On-device speech recognition is unavailable. Allow browser speech recognition to continue, or use a browser with an installed offline language pack.');
  }

  stopBrowserLocalRecognition();
  const next = new Ctor();
  if ('processLocally' in Ctor.prototype) next.processLocally = useLocal;
  next.lang = lang;
  next.continuous = false;
  next.interimResults = true;
  let receivedSpeechResult = false;
  next.onresult = (event) => {
    const resultIndex = event.resultIndex ?? 0;
    for (let index = resultIndex; index < (event.results?.length ?? 0); index += 1) {
      const result = event.results[index];
      receivedSpeechResult = true;
      const text = result?.[0]?.transcript?.trim();
      if (!text) continue;
      window.dispatchEvent(new CustomEvent(result.isFinal ? 'workly-voice-transcript' : 'workly-voice-partial-transcript', {
        detail: { text, languageTag: lang, source: useLocal ? 'browser-on-device' : 'browser-speech-service' },
      }));
    }
  };
  next.onerror = (event) => {
    const message = event.error === 'not-allowed'
      ? 'Microphone permission was denied. Allow microphone access for this website.'
      : event.error === 'service-not-allowed'
        ? 'The browser speech service is blocked. Check browser permissions or use on-device speech recognition.'
        : `Browser speech recognition error: ${event.error || 'unknown'}`;
    window.dispatchEvent(new CustomEvent('workly-voice-error', { detail: { message } }));
  };
  next.onend = () => {
    if (recognition === next) recognition = null;
    window.dispatchEvent(new CustomEvent('workly-voice-status', { detail: { status: receivedSpeechResult ? 'recognition-ended' : 'finished' } }));
  };
  recognition = next;
  try {
    next.start();
  } catch (error) {
    recognition = null;
    throw error;
  }
  window.dispatchEvent(new CustomEvent('workly-voice-status', {
    detail: { status: 'listening', mode: useLocal ? 'on-device' : 'browser-service' },
  }));
  return true;
}

export function stopBrowserLocalRecognition(): void {
  const current = recognition;
  recognition = null;
  if (current) {
    current.onend = null;
    try { current.stop(); } catch { /* already stopped */ }
  }
}

export function speakBrowserLocalReply(text: string, language = 'en-US'): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return false;
  window.speechSynthesis.cancel();
  const voices = window.speechSynthesis.getVoices();
  const normalizedLanguage = language.toLowerCase();
  const prefix = normalizedLanguage.split('-')[0];
  // Never force a mismatched default voice (for example English) to read
  // Hindi/Gujarati text. Keep the requested language tag so the browser TTS
  // engine can choose its own compatible voice when the voice list is empty.
  const voice = voices.find((item) => item.lang.toLowerCase() === normalizedLanguage)
    || voices.find((item) => item.lang.toLowerCase().startsWith(prefix + '-'));
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  if (voice) utterance.voice = voice;
  utterance.onstart = () => window.dispatchEvent(new CustomEvent('workly-voice-status', { detail: { status: 'speaking' } }));
  utterance.onend = () => window.dispatchEvent(new CustomEvent('workly-voice-status', { detail: { status: 'finished' } }));
  utterance.onerror = () => window.dispatchEvent(new CustomEvent('workly-voice-error', { detail: { message: 'Browser text-to-speech is unavailable for this reply.' } }));
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopBrowserLocalReply(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
