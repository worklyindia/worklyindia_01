type LocalRecognition = {
  processLocally: boolean;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type LocalSpeechRecognitionConstructor = {
  new (): LocalRecognition;
  prototype: LocalRecognition;
  available?: (options: { langs: string[]; processLocally: true }) => Promise<string>;
  install?: (options: { langs: string[]; processLocally: true }) => Promise<boolean>;
};

declare global {
  interface Window {
    SpeechRecognition?: LocalSpeechRecognitionConstructor;
    webkitSpeechRecognition?: LocalSpeechRecognitionConstructor;
  }
}

let recognition: LocalRecognition | null = null;
let speaking = false;

export function isBrowserLocalVoiceAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  return !!Ctor && 'processLocally' in Ctor.prototype && !!Ctor.available;
}

export async function startBrowserLocalRecognition(language = 'en-US'): Promise<boolean> {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor || !('processLocally' in Ctor.prototype) || !Ctor.available) return false;

  const lang = language || 'en-US';
  {
    const status = await Ctor.available({ langs: [lang], processLocally: true });
    if (status !== 'available') {
      if ((status === 'downloadable' || status === 'downloading') && Ctor.install) {
        const installed = await Ctor.install({ langs: [lang], processLocally: true });
        if (!installed) throw new Error('Offline language pack could not be installed. Check internet and try again.');
        throw new Error('Offline language pack installed. Tap Start AI Call again.');
      }
      throw new Error(`On-device speech recognition is unavailable for ${lang} in this browser.`);
    }
  }

  stopBrowserLocalRecognition();
  const next = new Ctor();
  next.processLocally = true;
  next.lang = lang;
  next.continuous = false;
  next.interimResults = false;
  next.onresult = (event) => {
    const text = event.results?.[event.resultIndex ?? 0]?.[0]?.transcript?.trim();
    if (text) {
      window.dispatchEvent(new CustomEvent('workly-voice-transcript', {
        detail: { text, languageTag: lang },
      }));
    }
  };
  next.onerror = (event) => {
    window.dispatchEvent(new CustomEvent('workly-voice-error', {
      detail: { message: event.error === 'not-allowed' ? 'Microphone permission was denied.' : `On-device recognition error: ${event.error || 'unknown'}` },
    }));
  };
  next.onend = () => {
    if (recognition === next) recognition = null;
    window.dispatchEvent(new CustomEvent('workly-voice-status', { detail: { status: 'finished' } }));
  };
  recognition = next;
  next.start();
  window.dispatchEvent(new CustomEvent('workly-voice-status', { detail: { status: 'listening' } }));
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
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return false;
  window.speechSynthesis.cancel();
  const voices = window.speechSynthesis.getVoices();
  const prefix = language.toLowerCase().split('-')[0];
  const localVoice = voices.find((voice) => voice.localService && voice.lang.toLowerCase() === language.toLowerCase())
    || voices.find((voice) => voice.localService && voice.lang.toLowerCase().startsWith(prefix + '-'));
  if (!localVoice) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = localVoice;
  utterance.lang = localVoice.lang;
  utterance.onstart = () => {
    speaking = true;
    window.dispatchEvent(new CustomEvent('workly-voice-status', { detail: { status: 'speaking' } }));
  };
  utterance.onend = () => {
    speaking = false;
    window.dispatchEvent(new CustomEvent('workly-voice-status', { detail: { status: 'finished' } }));
  };
  utterance.onerror = () => {
    speaking = false;
    window.dispatchEvent(new CustomEvent('workly-voice-error', { detail: { message: 'Local text-to-speech is unavailable for this language.' } }));
  };
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopBrowserLocalReply(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  speaking = false;
}
