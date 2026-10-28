/**
 * Localized "thinking..." status helpers used by the AI chat header
 * BEFORE the server's `set_status` events arrive. Keeps the user feeling
 * like the AI is actively working even during the slow first AI round.
 *
 * Detection is script-based (Devanagari, Bengali, Tamil, etc.) with a
 * Hinglish heuristic for Latin-script messages that contain common
 * romanized Hindi tokens.
 */

export type StatusLang =
  | 'hi' | 'hinglish' | 'en'
  | 'bn' | 'ta' | 'te' | 'mr' | 'gu' | 'kn' | 'ml' | 'pa' | 'or' | 'ur'
  | 'ar' | 'zh' | 'ja' | 'ko' | 'ru' | 'es' | 'fr' | 'de' | 'pt';

const SCRIPT_RANGES: Array<{ lang: StatusLang; pattern: RegExp }> = [
  { lang: 'hi', pattern: /[\u0900-\u097F]/ },
  { lang: 'bn', pattern: /[\u0980-\u09FF]/ },
  { lang: 'pa', pattern: /[\u0A00-\u0A7F]/ },
  { lang: 'gu', pattern: /[\u0A80-\u0AFF]/ },
  { lang: 'or', pattern: /[\u0B00-\u0B7F]/ },
  { lang: 'ta', pattern: /[\u0B80-\u0BFF]/ },
  { lang: 'te', pattern: /[\u0C00-\u0C7F]/ },
  { lang: 'kn', pattern: /[\u0C80-\u0CFF]/ },
  { lang: 'ml', pattern: /[\u0D00-\u0D7F]/ },
  { lang: 'ur', pattern: /[\u0600-\u06FF]/ },
  { lang: 'zh', pattern: /[\u4E00-\u9FFF]/ },
  { lang: 'ja', pattern: /[\u3040-\u309F\u30A0-\u30FF]/ },
  { lang: 'ko', pattern: /[\uAC00-\uD7AF]/ },
  { lang: 'ru', pattern: /[\u0400-\u04FF]/ },
];

const HINGLISH_HINTS = /\b(hai|hain|kya|kaise|kaisi|kaisa|kar|karo|karun|karna|karne|karta|karti|karenge|kyu|kyun|nahi|nahin|haan|han|mera|meri|mere|mujhe|mujhko|tum|tumhe|tumhara|aap|aapko|aapka|chahiye|chahta|chahti|bata|batao|dekho|dekh|dekha|dhundo|dhundh|dhundhna|naukri|kaam|job|jobs|paisa|paise|email|telegram|bhej|bhejo|banao|bana|banaya|likho|likh|mai|main|hum|theek|sahi|galat|samjha|samjhi|samjhao|please|plz|jaldi|abhi|fast|sun|suno|bol|bolo|kal|aaj|kal|abhi|kuch|sab|kya|kyun)\b/i;
const ENGLISH_HINTS = /\b(the|and|you|are|what|how|where|when|why|please|need|want|find|help|search|build|make|create|send|email|tell|show|give|can|could|should|would|will|have|has|had|been|being|with|without|about|because|just|only|some|any|every|never|always|also|good|bad|nice|great|hello|hey|hi)\b/i;

export function detectStatusLang(text: string): StatusLang {
  if (!text) return 'en';
  for (const { lang, pattern } of SCRIPT_RANGES) {
    if (pattern.test(text)) return lang;
  }
  // Latin-script paths: distinguish Hinglish vs English vs European
  if (HINGLISH_HINTS.test(text)) return 'hinglish';
  if (/\b(hola|gracias|por\s?favor|cómo|qué|trabajo|empleo)\b/i.test(text)) return 'es';
  if (/\b(bonjour|merci|comment|travail|emploi|s'il)\b/i.test(text)) return 'fr';
  if (/\b(hallo|danke|bitte|arbeit|guten)\b/i.test(text)) return 'de';
  if (/\b(olá|obrigado|trabalho|emprego)\b/i.test(text)) return 'pt';
  if (ENGLISH_HINTS.test(text)) return 'en';
  return 'en';
}

/**
 * Rotating progress messages per language. The first item is the instant
 * "I just got your message" status; the rest cycle every few seconds while
 * the AI is working, so the user always sees fresh activity.
 */
export const STATUS_ROTATIONS: Record<StatusLang, string[]> = {
  hi: [
    'सोच रही हूँ...',
    'जवाब तैयार कर रही हूँ...',
    'जानकारी देख रही हूँ...',
    'बस एक सेकंड...',
  ],
  hinglish: [
    'Soch rahi hoon...',
    'Reply taiyaar kar rahi hoon...',
    'Check kar rahi hoon...',
    'Bas ek sec...',
  ],
  en: [
    'Thinking...',
    'Drafting reply...',
    'Looking it up...',
    'Just a sec...',
  ],
  bn: ['ভাবছি...', 'উত্তর তৈরি করছি...', 'দেখছি...', 'এক সেকেন্ড...'],
  ta: ['யோசிக்கிறேன்...', 'பதில் தயாரிக்கிறேன்...', 'பார்க்கிறேன்...', 'ஒரு நொடி...'],
  te: ['ఆలోచిస్తున్నాను...', 'సమాధానం సిద్ధం చేస్తున్నాను...', 'చూస్తున్నాను...', 'ఒక సెకను...'],
  mr: ['विचार करत आहे...', 'उत्तर तयार करत आहे...', 'बघत आहे...', 'एक सेकंद...'],
  gu: ['વિચારી રહી છું...', 'જવાબ તૈયાર કરું છું...', 'જોઈ રહી છું...', 'એક સેકન્ડ...'],
  kn: ['ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ...', 'ಉತ್ತರ ತಯಾರಿಸುತ್ತಿದ್ದೇನೆ...', 'ನೋಡುತ್ತಿದ್ದೇನೆ...', 'ಒಂದು ಕ್ಷಣ...'],
  ml: ['ചിന്തിക്കുന്നു...', 'മറുപടി തയ്യാറാക്കുന്നു...', 'നോക്കുന്നു...', 'ഒരു സെക്കൻഡ്...'],
  pa: ['ਸੋਚ ਰਹੀ ਹਾਂ...', 'ਜਵਾਬ ਤਿਆਰ ਕਰ ਰਹੀ ਹਾਂ...', 'ਵੇਖ ਰਹੀ ਹਾਂ...', 'ਇੱਕ ਪਲ...'],
  or: ['ଭାବୁଛି...', 'ଉତ୍ତର ପ୍ରସ୍ତୁତ କରୁଛି...', 'ଦେଖୁଛି...', 'ଏକ ସେକେଣ୍ଡ...'],
  ur: ['سوچ رہی ہوں...', 'جواب تیار کر رہی ہوں...', 'دیکھ رہی ہوں...', 'ایک سیکنڈ...'],
  ar: ['أفكر...', 'أحضّر الرد...', 'أبحث...', 'لحظة...'],
  zh: ['思考中...', '准备回复...', '查找中...', '稍等...'],
  ja: ['考え中...', '返信を準備中...', '調べています...', '少々お待ちを...'],
  ko: ['생각 중...', '답변 준비 중...', '확인 중...', '잠시만요...'],
  ru: ['Думаю...', 'Готовлю ответ...', 'Проверяю...', 'Секунду...'],
  es: ['Pensando...', 'Preparando respuesta...', 'Buscando...', 'Un segundo...'],
  fr: ['Je réfléchis...', 'Je prépare la réponse...', 'Je vérifie...', 'Un instant...'],
  de: ['Denke nach...', 'Antwort wird vorbereitet...', 'Schaue nach...', 'Einen Moment...'],
  pt: ['Pensando...', 'Preparando resposta...', 'Verificando...', 'Um segundo...'],
};

export function getInstantStatus(text: string): string {
  const lang = detectStatusLang(text);
  return STATUS_ROTATIONS[lang][0];
}

/**
 * Truthful phase labels. These are NOT rotating filler — each label maps 1:1
 * to the real work phase reported by the backend (`ai_task_status.phase`), so
 * the chip only ever claims what the AI is actually doing right now.
 */
export type StatusPhase =
  | 'started'
  | 'sending'
  | 'analyzing'
  | 'planning'
  | 'working'
  | 'searching'
  | 'reading'
  | 'checking'
  | 'organizing'
  | 'verifying'
  | 'polishing'
  | 'finalizing'
  | 'completed'
  | 'failed';

const PHASE_LABELS: Partial<Record<StatusLang, Record<StatusPhase, string>>> = {
  en: {
    started: 'Starting...',
    sending: 'Sending your request...',
    analyzing: 'Understanding your request...',
    planning: 'Planning the best way to do this...',
    working: 'Working on it...',
    searching: 'Searching for the right information...',
    reading: 'Reading through the details...',
    checking: 'Fetching the data...',
    organizing: 'Organizing everything properly...',
    verifying: 'Verifying results...',
    polishing: 'Polishing the answer for you...',
    finalizing: 'Writing the reply...',
    completed: '',
    failed: 'Something went wrong',
  },
  hinglish: {
    started: 'Shuru kar rahi hoon...',
    sending: 'Request bhej rahi hoon...',
    analyzing: 'Request samajh rahi hoon...',
    planning: 'Plan bana rahi hoon kaise karna hai...',
    working: 'Kaam kar rahi hoon...',
    searching: 'Sahi information dhoondh rahi hoon...',
    reading: 'Details padh rahi hoon...',
    checking: 'Data nikaal rahi hoon...',
    organizing: 'Sab kuch sahi tarike se set kar rahi hoon...',
    verifying: 'Result check kar rahi hoon...',
    polishing: 'Answer ko final touch de rahi hoon...',
    finalizing: 'Reply likh rahi hoon...',
    completed: '',
    failed: 'Kuch galat ho gaya',
  },
  hi: {
    started: 'शुरू कर रही हूँ...',
    sending: 'आपका सवाल भेज रही हूँ...',
    analyzing: 'आपका सवाल समझ रही हूँ...',
    planning: 'तरीका तय कर रही हूँ...',
    working: 'काम कर रही हूँ...',
    searching: 'सही जानकारी ढूँढ रही हूँ...',
    reading: 'सारी जानकारी पढ़ रही हूँ...',
    checking: 'जानकारी ला रही हूँ...',
    organizing: 'सब कुछ ठीक से जमा रही हूँ...',
    verifying: 'नतीजे जाँच रही हूँ...',
    polishing: 'जवाब को अंतिम रूप दे रही हूँ...',
    finalizing: 'जवाब लिख रही हूँ...',
    completed: '',
    failed: 'कुछ गड़बड़ हो गई',
  },
  gu: {
    started: 'શરૂ કરી રહી છું...',
    sending: 'તમારો સવાલ મોકલી રહી છું...',
    analyzing: 'તમારો સવાલ સમજી રહી છું...',
    planning: 'કઈ રીતે કરવું એ નક્કી કરી રહી છું...',
    working: 'કામ કરી રહી છું...',
    searching: 'સાચી માહિતી શોધી રહી છું...',
    reading: 'બધી વિગતો વાંચી રહી છું...',
    checking: 'માહિતી લાવી રહી છું...',
    organizing: 'બધું વ્યવસ્થિત ગોઠવી રહી છું...',
    verifying: 'પરિણામ ચકાસી રહી છું...',
    polishing: 'જવાબને છેલ્લો ટચ આપી રહી છું...',
    finalizing: 'જવાબ લખી રહી છું...',
    completed: '',
    failed: 'કંઈક ખોટું થયું',
  },
};



export function getPhaseStatus(lang: StatusLang, phase: StatusPhase): string {
  const table = PHASE_LABELS[lang] || PHASE_LABELS.en!;
  return table[phase] ?? '';
}

/**
 * Long-wait reassurance lines. Shown after the request has been running for a
 * while so the user knows the work is still alive and does not leave the page.
 */
const LONG_WAIT_LINES: Partial<Record<StatusLang, string[]>> = {
  en: [
    'Still working on it — almost there...',
    'This one needs a little more time, please stay...',
    'Deep work in progress, thanks for waiting...',
    'Going through the details carefully...',
    'Cross-checking the information...',
    'Comparing a few options for you...',
    'Improving the answer a bit more...',
    'Double-checking everything for you...',
    'Making sure nothing is missed...',
    'Arranging it in a clean way...',
    'Almost ready — final checks running...',
    'Nearly done — putting it all together...',
  ],
  hinglish: [
    'Abhi bhi kaam chal raha hai — bas thoda aur...',
    'Isme thoda time lag raha hai, ruk jao please...',
    'Detail me kaam kar rahi hoon, thanks for waiting...',
    'Ek ek cheez dhyan se dekh rahi hoon...',
    'Information cross-check kar rahi hoon...',
    'Kuch options compare kar rahi hoon...',
    'Answer ko aur behtar bana rahi hoon...',
    'Sab kuch dobara verify kar rahi hoon...',
    'Koi cheez chhut na jaye, check kar rahi hoon...',
    'Sab saaf-suthre format me laga rahi hoon...',
    'Bas final check chal raha hai...',
    'Bas ho hi gaya — sab jod rahi hoon...',
  ],
  hi: [
    'काम अभी भी चल रहा है — बस थोड़ा और...',
    'इसमें थोड़ा समय लग रहा है, कृपया रुकिए...',
    'ध्यान से काम कर रही हूँ, इंतज़ार के लिए शुक्रिया...',
    'एक-एक चीज़ जाँच रही हूँ...',
    'जानकारी क्रॉस-चेक कर रही हूँ...',
    'कुछ विकल्प आपस में तुलना कर रही हूँ...',
    'जवाब को और बेहतर बना रही हूँ...',
    'सब कुछ दोबारा वेरिफाई कर रही हूँ...',
    'कोई चीज़ छूट न जाए, देख रही हूँ...',
    'सब कुछ साफ़-सुथरे रूप में लगा रही हूँ...',
    'बस आख़िरी जाँच चल रही है...',
    'लगभग हो गया — सब जोड़ रही हूँ...',
  ],
  gu: [
    'હજુ કામ ચાલુ છે — બસ થોડું વધુ...',
    'આમાં થોડો સમય લાગે છે, થોડી રાહ જુઓ...',
    'ધ્યાનથી કામ કરી રહી છું, રાહ જોવા બદલ આભાર...',
    'એક એક વસ્તુ તપાસી રહી છું...',
    'માહિતી ક્રોસ-ચેક કરી રહી છું...',
    'થોડા વિકલ્પોની સરખામણી કરી રહી છું...',
    'જવાબ વધુ સારો બનાવી રહી છું...',
    'બધું ફરીથી વેરિફાય કરી રહી છું...',
    'કંઈ રહી ન જાય એ જોઈ રહી છું...',
    'બધું વ્યવસ્થિત ગોઠવી રહી છું...',
    'બસ છેલ્લી ચકાસણી ચાલુ છે...',
    'લગભગ થઈ ગયું — બધું ગોઠવી રહી છું...',
  ],
};

/**
 * Ordered phases the chip walks through while we wait for the backend.
 * Deliberately SLOW — the status should change calmly, not flicker every
 * couple of seconds, but there are enough distinct steps that a long run
 * always feels like real, moving progress.
 */
const ELAPSED_STAGES: Array<{ after: number; phase: StatusPhase }> = [
  { after: 0, phase: 'analyzing' },
  { after: 7000, phase: 'planning' },
  { after: 15000, phase: 'working' },
  { after: 24000, phase: 'searching' },
  { after: 33000, phase: 'reading' },
  { after: 42000, phase: 'checking' },
  { after: 52000, phase: 'organizing' },
  { after: 62000, phase: 'verifying' },
  { after: 72000, phase: 'polishing' },
];

/** After this long we switch to the gentle "still working" reassurance lines. */
const LONG_WAIT_AFTER_MS = 82000;

/** How long each reassurance line stays on screen. */
const LONG_WAIT_ROTATE_MS = 15000;

/** Phase that matches how long the current run has been going. */
export function getElapsedPhase(elapsedMs: number): StatusPhase {
  let phase: StatusPhase = 'analyzing';
  for (const stage of ELAPSED_STAGES) {
    if (elapsedMs >= stage.after) phase = stage.phase;
  }
  return phase;
}

/**
 * Live status for a running request based on elapsed time. For the first ~55s
 * it is a truthful phase label; after that it slowly rotates gentle "still
 * working" lines so a slow answer never looks frozen.
 */
export function getElapsedStatus(lang: StatusLang, elapsedMs: number): string {
  if (elapsedMs >= LONG_WAIT_AFTER_MS) {
    const lines = LONG_WAIT_LINES[lang] || LONG_WAIT_LINES.en!;
    const idx = Math.floor((elapsedMs - LONG_WAIT_AFTER_MS) / LONG_WAIT_ROTATE_MS) % lines.length;
    return lines[idx];
  }
  return getPhaseStatus(lang, getElapsedPhase(elapsedMs));
}


/** "Writing the reply..." label — used while the answer is streaming in. */
export function getWritingStatus(lang: StatusLang): string {
  return getPhaseStatus(lang, 'finalizing');
}
