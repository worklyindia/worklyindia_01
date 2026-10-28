/**
 * Central AI status generator.
 *
 * ONE rule: the status must describe what the assistant is ACTUALLY doing
 * right now, phrased in the same language/style the user just wrote in.
 *
 *   generateStatus({ userText, lang, action, tool })
 *
 * Priority: real action  ->  detected intent  ->  user language/style
 *           ->  tool being used  ->  generic fallback.
 *
 * Status text is plain text: NO emojis, short (3-8 words), ends with "...".
 */

/* ── Action states (real work stages) ────────────────────────────────── */

export type StatusAction =
  | "intent_detected"
  | "planning"
  | "searching"
  | "fetching"
  | "checking"
  | "analyzing"
  | "calculating"
  | "comparing"
  | "generating"
  | "writing"
  | "verifying"
  | "finalizing"
  | "completed"
  | "error";

/* ── Verbs used by the language templates ────────────────────────────── */

export type StatusVerb =
  | "look"      // dekh rahi hoon / checking
  | "search"    // search kar rahi hoon
  | "update"    // update kar rahi hoon
  | "verify"    // verify kar rahi hoon
  | "create"    // bana rahi hoon
  | "send"      // bhejne ki taiyari
  | "read"      // padh rahi hoon
  | "analyze"   // analyze kar rahi hoon
  | "prepare"   // prepare kar rahi hoon
  | "compare"   // compare kar rahi hoon
  | "error";    // problem aa gayi

export interface RequestStatusParts {
  /** Kept for backwards compatibility — always "" now (no emojis allowed). */
  emoji: string;
  verb: StatusVerb;
  /** Subject / target of the action, e.g. "YouTube channel", "Manoj Dey". */
  target: string;
}

const clip = (s: string, n = 40): string => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Hard guarantee: no emoji ever reaches the status line. */
export function stripStatusEmojis(text: string): string {
  return String(text ?? "")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\uFE0E\u200D]+/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ── Language detection (script based + Latin style hints) ───────────── */

export type StatusLangCode =
  | "hi" | "hinglish" | "en" | "bn" | "ta" | "te" | "mr" | "gu" | "gujlish"
  | "kn" | "ml" | "pa" | "or" | "ur" | "ar" | "zh" | "ja" | "ko" | "ru"
  | "es" | "fr" | "de" | "pt";

const SCRIPTS: Array<[StatusLangCode, RegExp]> = [
  ["hi", /[\u0900-\u097F]/],
  ["bn", /[\u0980-\u09FF]/],
  ["pa", /[\u0A00-\u0A7F]/],
  ["gu", /[\u0A80-\u0AFF]/],
  ["or", /[\u0B00-\u0B7F]/],
  ["ta", /[\u0B80-\u0BFF]/],
  ["te", /[\u0C00-\u0C7F]/],
  ["kn", /[\u0C80-\u0CFF]/],
  ["ml", /[\u0D00-\u0D7F]/],
  ["ur", /[\u0600-\u06FF]/],
  ["zh", /[\u4E00-\u9FFF]/],
  ["ja", /[\u3040-\u309F\u30A0-\u30FF]/],
  ["ko", /[\uAC00-\uD7AF]/],
  ["ru", /[\u0400-\u04FF]/],
];

/** Marathi shares Devanagari with Hindi — detect it from its own markers. */
const MARATHI_DEV = /(आहे|आहेस|आहात|करत|तुमचा|तुमच्या|माझं|माझा|काय|कसं|कसा|कशी|पाहिजे|मला)/;
/** Romanized Marathi. */
const MARATHI_LATIN =
  /\b(aahe|ahe|kasa|kashi|kase|kay|majha|majhi|mala|tumcha|tumhi|karto|karte|pahije|zala|nahi\s*ka)\b/i;
/** Romanized Gujarati ("Gujlish"). */
const GUJLISH =
  /\b(chhu|chu|chhe|che|kari|karo\s*chho|chho|mara|maru|mari|tamaru|tamara|tame|kem\s*cho|kem|joi|jou|jovu|batavo|kaik|shu|nathi|hoy)\b/i;

const HINGLISH =
  /\b(hai|hain|kya|kaise|kese|kaisa|kaisi|kar|karo|karna|karti|karta|kyu|kyun|nahi|nahin|mera|meri|mere|mujhe|aap|apka|aapka|aapko|chahiye|bata|batao|dekh|dekho|dhundo|naukri|kaam|bhej|bhejo|banao|bana|likho|mai|main|hum|abhi|jaldi|kon|kaun|acha|thik|theek)\b/i;

export function detectRequestLang(text: string): StatusLangCode {
  if (!text) return "en";
  for (const [lang, re] of SCRIPTS) {
    if (!re.test(text)) continue;
    if (lang === "hi" && MARATHI_DEV.test(text)) return "mr";
    return lang;
  }
  if (MARATHI_LATIN.test(text)) return "mr";
  if (GUJLISH.test(text)) return "gujlish";
  if (HINGLISH.test(text)) return "hinglish";
  if (/\b(hola|gracias|por\s?favor|cómo|qué|trabajo|empleo)\b/i.test(text)) return "es";
  if (/\b(bonjour|merci|comment|travail|emploi)\b/i.test(text)) return "fr";
  if (/\b(hallo|danke|bitte|arbeit|guten)\b/i.test(text)) return "de";
  if (/\b(olá|obrigado|trabalho|emprego)\b/i.test(text)) return "pt";
  return "en";
}

/* ── Verb templates per language ({t} = target) ──────────────────────── */

type VerbMap = Record<StatusVerb, string>;

const TEMPLATES: Record<StatusLangCode, VerbMap> = {
  en: {
    look: "Checking {t}...",
    search: "Searching {t}...",
    update: "Updating {t}...",
    verify: "Verifying {t}...",
    create: "Creating {t}...",
    send: "Preparing to send {t}...",
    read: "Reading {t}...",
    analyze: "Analyzing {t}...",
    prepare: "Preparing {t}...",
    compare: "Comparing {t}...",
    error: "There was a problem checking {t}...",
  },
  hinglish: {
    look: "{t} check kar rahi hoon...",
    search: "{t} search kar rahi hoon...",
    update: "{t} update kar rahi hoon...",
    verify: "{t} verify kar rahi hoon...",
    create: "{t} bana rahi hoon...",
    send: "{t} bhejne ki taiyari...",
    read: "{t} padh rahi hoon...",
    analyze: "{t} analyze kar rahi hoon...",
    prepare: "{t} prepare kar rahi hoon...",
    compare: "{t} compare kar rahi hoon...",
    error: "{t} check karte waqt problem aa gayi...",
  },
  hi: {
    look: "{t} देख रही हूँ...",
    search: "{t} खोज रही हूँ...",
    update: "{t} अपडेट कर रही हूँ...",
    verify: "{t} जाँच रही हूँ...",
    create: "{t} बना रही हूँ...",
    send: "{t} भेजने की तैयारी...",
    read: "{t} पढ़ रही हूँ...",
    analyze: "{t} एनालाइज़ कर रही हूँ...",
    prepare: "{t} तैयार कर रही हूँ...",
    compare: "{t} तुलना कर रही हूँ...",
    error: "{t} देखते समय दिक्कत आ गई...",
  },
  mr: {
    look: "{t} बघत आहे...",
    search: "{t} शोधत आहे...",
    update: "{t} अपडेट करत आहे...",
    verify: "{t} तपासत आहे...",
    create: "{t} तयार करत आहे...",
    send: "{t} पाठवण्याची तयारी...",
    read: "{t} वाचत आहे...",
    analyze: "{t} अ‍ॅनालाइझ करत आहे...",
    prepare: "{t} तयार करत आहे...",
    compare: "{t} तुलना करत आहे...",
    error: "{t} बघताना अडचण आली...",
  },
  bn: {
    look: "{t} দেখছি...",
    search: "{t} খুঁজছি...",
    update: "{t} আপডেট করছি...",
    verify: "{t} যাচাই করছি...",
    create: "{t} তৈরি করছি...",
    send: "{t} পাঠানোর প্রস্তুতি...",
    read: "{t} পড়ছি...",
    analyze: "{t} বিশ্লেষণ করছি...",
    prepare: "{t} প্রস্তুত করছি...",
    compare: "{t} তুলনা করছি...",
    error: "{t} দেখতে গিয়ে সমস্যা হয়েছে...",
  },
  ta: {
    look: "{t} பார்க்கிறேன்...",
    search: "{t} தேடுகிறேன்...",
    update: "{t} புதுப்பிக்கிறேன்...",
    verify: "{t} சரிபார்க்கிறேன்...",
    create: "{t} உருவாக்குகிறேன்...",
    send: "{t} அனுப்பத் தயாராகிறேன்...",
    read: "{t} படிக்கிறேன்...",
    analyze: "{t} பகுப்பாய்வு செய்கிறேன்...",
    prepare: "{t} தயார் செய்கிறேன்...",
    compare: "{t} ஒப்பிடுகிறேன்...",
    error: "{t} பார்க்கும்போது சிக்கல் ஏற்பட்டது...",
  },
  te: {
    look: "{t} చూస్తున్నాను...",
    search: "{t} వెతుకుతున్నాను...",
    update: "{t} అప్‌డేట్ చేస్తున్నాను...",
    verify: "{t} ధృవీకరిస్తున్నాను...",
    create: "{t} తయారు చేస్తున్నాను...",
    send: "{t} పంపడానికి సిద్ధమవుతున్నాను...",
    read: "{t} చదువుతున్నాను...",
    analyze: "{t} విశ్లేషిస్తున్నాను...",
    prepare: "{t} సిద్ధం చేస్తున్నాను...",
    compare: "{t} పోల్చుతున్నాను...",
    error: "{t} చూసేటప్పుడు సమస్య వచ్చింది...",
  },
  gu: {
    look: "{t} જોઈ રહી છું...",
    search: "{t} શોધી રહી છું...",
    update: "{t} અપડેટ કરી રહી છું...",
    verify: "{t} ચકાસી રહી છું...",
    create: "{t} બનાવી રહી છું...",
    send: "{t} મોકલવાની તૈયારી...",
    read: "{t} વાંચી રહી છું...",
    analyze: "{t} એનાલાઇઝ કરી રહી છું...",
    prepare: "{t} તૈયાર કરી રહી છું...",
    compare: "{t} સરખામણી કરી રહી છું...",
    error: "{t} જોતી વખતે તકલીફ આવી...",
  },
  gujlish: {
    look: "{t} check kari rahi chhu...",
    search: "{t} search kari rahi chhu...",
    update: "{t} update kari rahi chhu...",
    verify: "{t} verify kari rahi chhu...",
    create: "{t} banavi rahi chhu...",
    send: "{t} mokalvani taiyari...",
    read: "{t} vanchi rahi chhu...",
    analyze: "{t} analyze kari rahi chhu...",
    prepare: "{t} taiyar kari rahi chhu...",
    compare: "{t} sarkhamni kari rahi chhu...",
    error: "{t} check karta vakhte problem aavi...",
  },
  kn: {
    look: "{t} ನೋಡುತ್ತಿದ್ದೇನೆ...",
    search: "{t} ಹುಡುಕುತ್ತಿದ್ದೇನೆ...",
    update: "{t} ಅಪ್‌ಡೇಟ್ ಮಾಡುತ್ತಿದ್ದೇನೆ...",
    verify: "{t} ಪರಿಶೀಲಿಸುತ್ತಿದ್ದೇನೆ...",
    create: "{t} ರಚಿಸುತ್ತಿದ್ದೇನೆ...",
    send: "{t} ಕಳುಹಿಸಲು ಸಿದ್ಧತೆ...",
    read: "{t} ಓದುತ್ತಿದ್ದೇನೆ...",
    analyze: "{t} ವಿಶ್ಲೇಷಿಸುತ್ತಿದ್ದೇನೆ...",
    prepare: "{t} ಸಿದ್ಧಪಡಿಸುತ್ತಿದ್ದೇನೆ...",
    compare: "{t} ಹೋಲಿಸುತ್ತಿದ್ದೇನೆ...",
    error: "{t} ನೋಡುವಾಗ ಸಮಸ್ಯೆ ಆಯಿತು...",
  },
  ml: {
    look: "{t} നോക്കുന്നു...",
    search: "{t} തിരയുന്നു...",
    update: "{t} അപ്ഡേറ്റ് ചെയ്യുന്നു...",
    verify: "{t} പരിശോധിക്കുന്നു...",
    create: "{t} ഉണ്ടാക്കുന്നു...",
    send: "{t} അയയ്ക്കാൻ തയ്യാറാകുന്നു...",
    read: "{t} വായിക്കുന്നു...",
    analyze: "{t} വിശകലനം ചെയ്യുന്നു...",
    prepare: "{t} തയ്യാറാക്കുന്നു...",
    compare: "{t} താരതമ്യം ചെയ്യുന്നു...",
    error: "{t} നോക്കുമ്പോൾ പ്രശ്നം ഉണ്ടായി...",
  },
  pa: {
    look: "{t} ਵੇਖ ਰਹੀ ਹਾਂ...",
    search: "{t} ਲੱਭ ਰਹੀ ਹਾਂ...",
    update: "{t} ਅੱਪਡੇਟ ਕਰ ਰਹੀ ਹਾਂ...",
    verify: "{t} ਜਾਂਚ ਰਹੀ ਹਾਂ...",
    create: "{t} ਬਣਾ ਰਹੀ ਹਾਂ...",
    send: "{t} ਭੇਜਣ ਦੀ ਤਿਆਰੀ...",
    read: "{t} ਪੜ੍ਹ ਰਹੀ ਹਾਂ...",
    analyze: "{t} ਵਿਸ਼ਲੇਸ਼ਣ ਕਰ ਰਹੀ ਹਾਂ...",
    prepare: "{t} ਤਿਆਰ ਕਰ ਰਹੀ ਹਾਂ...",
    compare: "{t} ਤੁਲਨਾ ਕਰ ਰਹੀ ਹਾਂ...",
    error: "{t} ਵੇਖਦੇ ਸਮੇਂ ਸਮੱਸਿਆ ਆ ਗਈ...",
  },
  or: {
    look: "{t} ଦେଖୁଛି...",
    search: "{t} ଖୋଜୁଛି...",
    update: "{t} ଅପଡେଟ୍ କରୁଛି...",
    verify: "{t} ଯାଞ୍ଚ କରୁଛି...",
    create: "{t} ତିଆରି କରୁଛି...",
    send: "{t} ପଠାଇବାକୁ ପ୍ରସ୍ତୁତ...",
    read: "{t} ପଢ଼ୁଛି...",
    analyze: "{t} ବିଶ୍ଳେଷଣ କରୁଛି...",
    prepare: "{t} ପ୍ରସ୍ତୁତ କରୁଛି...",
    compare: "{t} ତୁଳନା କରୁଛି...",
    error: "{t} ଦେଖିବା ସମୟରେ ସମସ୍ୟା ହେଲା...",
  },
  ur: {
    look: "{t} دیکھ رہی ہوں...",
    search: "{t} تلاش کر رہی ہوں...",
    update: "{t} اپ ڈیٹ کر رہی ہوں...",
    verify: "{t} تصدیق کر رہی ہوں...",
    create: "{t} بنا رہی ہوں...",
    send: "{t} بھیجنے کی تیاری...",
    read: "{t} پڑھ رہی ہوں...",
    analyze: "{t} تجزیہ کر رہی ہوں...",
    prepare: "{t} تیار کر رہی ہوں...",
    compare: "{t} موازنہ کر رہی ہوں...",
    error: "{t} دیکھتے وقت مسئلہ آ گیا...",
  },
  ar: {
    look: "أتحقق من {t}...",
    search: "أبحث عن {t}...",
    update: "أحدّث {t}...",
    verify: "أتحقق من صحة {t}...",
    create: "أنشئ {t}...",
    send: "أستعد لإرسال {t}...",
    read: "أقرأ {t}...",
    analyze: "أحلل {t}...",
    prepare: "أحضّر {t}...",
    compare: "أقارن {t}...",
    error: "حدثت مشكلة أثناء التحقق من {t}...",
  },
  zh: {
    look: "正在查看 {t}...",
    search: "正在搜索 {t}...",
    update: "正在更新 {t}...",
    verify: "正在核实 {t}...",
    create: "正在创建 {t}...",
    send: "准备发送 {t}...",
    read: "正在阅读 {t}...",
    analyze: "正在分析 {t}...",
    prepare: "正在准备 {t}...",
    compare: "正在比较 {t}...",
    error: "查看 {t} 时出现问题...",
  },
  ja: {
    look: "{t} を確認しています...",
    search: "{t} を検索しています...",
    update: "{t} を更新しています...",
    verify: "{t} を検証しています...",
    create: "{t} を作成しています...",
    send: "{t} を送信する準備中...",
    read: "{t} を読んでいます...",
    analyze: "{t} を分析しています...",
    prepare: "{t} を準備しています...",
    compare: "{t} を比較しています...",
    error: "{t} の確認中に問題が発生しました...",
  },
  ko: {
    look: "{t} 확인 중...",
    search: "{t} 검색 중...",
    update: "{t} 업데이트 중...",
    verify: "{t} 검증 중...",
    create: "{t} 생성 중...",
    send: "{t} 전송 준비 중...",
    read: "{t} 읽는 중...",
    analyze: "{t} 분석 중...",
    prepare: "{t} 준비 중...",
    compare: "{t} 비교 중...",
    error: "{t} 확인 중 문제가 발생했습니다...",
  },
  ru: {
    look: "Смотрю {t}...",
    search: "Ищу {t}...",
    update: "Обновляю {t}...",
    verify: "Проверяю {t}...",
    create: "Создаю {t}...",
    send: "Готовлюсь отправить {t}...",
    read: "Читаю {t}...",
    analyze: "Анализирую {t}...",
    prepare: "Готовлю {t}...",
    compare: "Сравниваю {t}...",
    error: "Возникла проблема при проверке {t}...",
  },
  es: {
    look: "Revisando {t}...",
    search: "Buscando {t}...",
    update: "Actualizando {t}...",
    verify: "Verificando {t}...",
    create: "Creando {t}...",
    send: "Preparando el envío de {t}...",
    read: "Leyendo {t}...",
    analyze: "Analizando {t}...",
    prepare: "Preparando {t}...",
    compare: "Comparando {t}...",
    error: "Hubo un problema al revisar {t}...",
  },
  fr: {
    look: "Je consulte {t}...",
    search: "Je recherche {t}...",
    update: "Je mets à jour {t}...",
    verify: "Je vérifie {t}...",
    create: "Je crée {t}...",
    send: "Je prépare l'envoi de {t}...",
    read: "Je lis {t}...",
    analyze: "J'analyse {t}...",
    prepare: "Je prépare {t}...",
    compare: "Je compare {t}...",
    error: "Un problème est survenu en consultant {t}...",
  },
  de: {
    look: "Prüfe {t}...",
    search: "Suche {t}...",
    update: "Aktualisiere {t}...",
    verify: "Überprüfe {t}...",
    create: "Erstelle {t}...",
    send: "Bereite den Versand von {t} vor...",
    read: "Lese {t}...",
    analyze: "Analysiere {t}...",
    prepare: "Bereite {t} vor...",
    compare: "Vergleiche {t}...",
    error: "Beim Prüfen von {t} gab es ein Problem...",
  },
  pt: {
    look: "Verificando {t}...",
    search: "Procurando {t}...",
    update: "Atualizando {t}...",
    verify: "Verificando {t}...",
    create: "Criando {t}...",
    send: "Preparando o envio de {t}...",
    read: "Lendo {t}...",
    analyze: "Analisando {t}...",
    prepare: "Preparando {t}...",
    compare: "Comparando {t}...",
    error: "Houve um problema ao verificar {t}...",
  },
};

/* ── Localized target nouns ──────────────────────────────────────────── */

type TargetKey =
  | "youtube_channel" | "youtube_videos" | "youtube_data" | "youtube_analytics"
  | "channel_performance" | "viral_videos" | "subscribers" | "comments"
  | "video_seo" | "video" | "linkedin" | "instagram" | "twitter" | "facebook"
  | "jobs" | "resume" | "image" | "email" | "telegram" | "wallet" | "profile"
  | "company" | "web" | "answer" | "latest_info" | "screenshot" | "code"
  | "request" | "improvements" | "title";

const EN_TARGETS: Record<TargetKey, string> = {
  youtube_channel: "your YouTube channel",
  youtube_videos: "your YouTube videos",
  youtube_data: "the YouTube data",
  youtube_analytics: "your YouTube analytics",
  channel_performance: "channel performance",
  viral_videos: "your top videos",
  subscribers: "your subscribers",
  comments: "the video comments",
  video_seo: "the video SEO",
  video: "the video",
  linkedin: "the LinkedIn account",
  instagram: "the Instagram account",
  twitter: "the X (Twitter) account",
  facebook: "the Facebook page",
  jobs: "jobs",
  resume: "your resume",
  image: "the image",
  email: "the email",
  telegram: "the Telegram message",
  wallet: "your wallet",
  profile: "your profile",
  company: "the company details",
  web: "the web",
  answer: "the answer",
  latest_info: "the latest information",
  screenshot: "the screenshot",
  code: "the code",
  request: "your request",
  improvements: "improvement points",
  title: "the title",
};

const TARGETS: Partial<Record<StatusLangCode, Partial<Record<TargetKey, string>>>> = {
  en: EN_TARGETS,
  hinglish: {
    youtube_channel: "YouTube channel", youtube_videos: "YouTube videos",
    youtube_data: "YouTube data", youtube_analytics: "YouTube analytics",
    channel_performance: "Channel performance", viral_videos: "aapke top video",
    subscribers: "subscribers", comments: "video ke comments",
    video_seo: "video ka SEO", video: "video", linkedin: "LinkedIn account",
    instagram: "Instagram account", twitter: "Twitter account",
    facebook: "Facebook page", jobs: "jobs", resume: "aapka resume",
    image: "image", email: "email", telegram: "Telegram message",
    wallet: "wallet", profile: "profile", company: "company detail",
    web: "web", answer: "answer", latest_info: "latest information",
    screenshot: "screenshot", code: "code", request: "aapka request",
    improvements: "improvement points", title: "title",
  },
  gujlish: {
    youtube_channel: "YouTube channel", youtube_videos: "YouTube videos",
    youtube_data: "YouTube data", youtube_analytics: "YouTube analytics",
    channel_performance: "Channel performance", viral_videos: "tamara top video",
    subscribers: "subscribers", comments: "video na comments",
    video_seo: "video nu SEO", video: "video", linkedin: "LinkedIn account",
    instagram: "Instagram account", twitter: "Twitter account",
    facebook: "Facebook page", jobs: "jobs", resume: "tamaru resume",
    image: "image", email: "email", telegram: "Telegram message",
    wallet: "wallet", profile: "profile", company: "company detail",
    web: "web", answer: "answer", latest_info: "latest information",
    screenshot: "screenshot", code: "code", request: "tamari request",
    improvements: "improvement points", title: "title",
  },
  hi: {
    youtube_channel: "YouTube चैनल", youtube_videos: "YouTube वीडियो",
    youtube_data: "YouTube डेटा", youtube_analytics: "YouTube एनालिटिक्स",
    channel_performance: "चैनल परफ़ॉर्मेंस", viral_videos: "आपके टॉप वीडियो",
    subscribers: "सब्सक्राइबर", comments: "वीडियो के कमेंट",
    video_seo: "वीडियो का SEO", video: "वीडियो", linkedin: "LinkedIn अकाउंट",
    instagram: "Instagram अकाउंट", twitter: "Twitter अकाउंट",
    facebook: "Facebook पेज", jobs: "नौकरियाँ", resume: "आपका रिज़्यूमे",
    image: "इमेज", email: "ईमेल", telegram: "Telegram मैसेज",
    wallet: "वॉलेट", profile: "प्रोफ़ाइल", company: "कंपनी डिटेल",
    web: "वेब", answer: "जवाब", latest_info: "ताज़ा जानकारी",
    screenshot: "स्क्रीनशॉट", code: "कोड", request: "आपका रिक्वेस्ट",
    improvements: "सुधार के पॉइंट", title: "टाइटल",
  },
  mr: {
    youtube_channel: "YouTube चॅनल", youtube_videos: "YouTube व्हिडिओ",
    youtube_data: "YouTube डेटा", youtube_analytics: "YouTube अ‍ॅनालिटिक्स",
    channel_performance: "चॅनल परफॉर्मन्स", viral_videos: "तुमचे टॉप व्हिडिओ",
    subscribers: "सबस्क्रायबर", comments: "व्हिडिओचे कमेंट",
    video_seo: "व्हिडिओचा SEO", video: "व्हिडिओ", linkedin: "LinkedIn अकाउंट",
    instagram: "Instagram अकाउंट", twitter: "Twitter अकाउंट",
    facebook: "Facebook पेज", jobs: "नोकऱ्या", resume: "तुमचा रेझ्युमे",
    image: "इमेज", email: "ईमेल", telegram: "Telegram मेसेज",
    wallet: "वॉलेट", profile: "प्रोफाइल", company: "कंपनी डिटेल",
    web: "वेब", answer: "उत्तर", latest_info: "ताजी माहिती",
    screenshot: "स्क्रीनशॉट", code: "कोड", request: "तुमची विनंती",
    improvements: "सुधारणा पॉइंट", title: "टायटल",
  },
  gu: {
    youtube_channel: "YouTube ચેનલ", youtube_videos: "YouTube વીડિયો",
    youtube_data: "YouTube ડેટા", youtube_analytics: "YouTube એનાલિટિક્સ",
    channel_performance: "ચેનલ પરફોર્મન્સ", viral_videos: "તમારા ટોપ વીડિયો",
    subscribers: "સબસ્ક્રાઇબર", comments: "વીડિયોના કમેન્ટ",
    video_seo: "વીડિયોનું SEO", video: "વીડિયો", linkedin: "LinkedIn એકાઉન્ટ",
    instagram: "Instagram એકાઉન્ટ", twitter: "Twitter એકાઉન્ટ",
    facebook: "Facebook પેજ", jobs: "નોકરીઓ", resume: "તમારું રિઝ્યુમે",
    image: "ઇમેજ", email: "ઈમેલ", telegram: "Telegram મેસેજ",
    wallet: "વોલેટ", profile: "પ્રોફાઇલ", company: "કંપની ડિટેલ",
    web: "વેબ", answer: "જવાબ", latest_info: "તાજી માહિતી",
    screenshot: "સ્ક્રીનશોટ", code: "કોડ", request: "તમારી રિક્વેસ્ટ",
    improvements: "સુધારાના પોઇન્ટ", title: "ટાઇટલ",
  },
};

const targetText = (key: TargetKey, lang: StatusLangCode): string =>
  TARGETS[lang]?.[key] || EN_TARGETS[key] || key.replace(/_/g, " ");

/** Render localized status text from structured parts (always emoji-free). */
export function renderStatus(parts: RequestStatusParts, lang: StatusLangCode): string {
  const tpl = (TEMPLATES[lang] || TEMPLATES.en)[parts.verb] || TEMPLATES.en[parts.verb];
  const text = tpl.replace("{t}", parts.target).replace(/\s+/g, " ").trim();
  return stripStatusEmojis(text);
}

/* ── Special, target-less phrases ────────────────────────────────────── */

type PhraseKey = "reply" | "own_name" | "calculating" | "fallback" | "generic_error";

const PHRASES: Partial<Record<StatusLangCode, Record<PhraseKey, string>>> = {
  en: {
    reply: "Writing your reply...",
    own_name: "Telling you my name...",
    calculating: "Doing the calculation...",
    fallback: "Working on your request...",
    generic_error: "Something went wrong...",
  },
  hinglish: {
    reply: "Aapke message ka jawab de rahi hoon...",
    own_name: "Apna naam bata rahi hoon...",
    calculating: "Calculation kar rahi hoon...",
    fallback: "Aapke request par kaam kar rahi hoon...",
    generic_error: "Kuch problem aa gayi...",
  },
  hi: {
    reply: "आपके मैसेज का जवाब दे रही हूँ...",
    own_name: "अपना नाम बता रही हूँ...",
    calculating: "कैलकुलेशन कर रही हूँ...",
    fallback: "आपकी रिक्वेस्ट पर काम कर रही हूँ...",
    generic_error: "कुछ दिक्कत हो गई...",
  },
  gujlish: {
    reply: "Tamara message no jawab api rahi chhu...",
    own_name: "Maru naam batavi rahi chhu...",
    calculating: "Calculation kari rahi chhu...",
    fallback: "Tamari request par kaam kari rahi chhu...",
    generic_error: "Kaik problem aavi...",
  },
  gu: {
    reply: "તમારા મેસેજનો જવાબ આપી રહી છું...",
    own_name: "મારું નામ જણાવી રહી છું...",
    calculating: "ગણતરી કરી રહી છું...",
    fallback: "તમારી રિક્વેસ્ટ પર કામ કરી રહી છું...",
    generic_error: "કંઈક તકલીફ આવી...",
  },
  mr: {
    reply: "तुमच्या मेसेजचं उत्तर देत आहे...",
    own_name: "माझं नाव सांगत आहे...",
    calculating: "गणना करत आहे...",
    fallback: "तुमच्या विनंतीवर काम करत आहे...",
    generic_error: "काहीतरी अडचण आली...",
  },
  bn: {
    reply: "আপনার উত্তর লিখছি...",
    own_name: "আমার নাম বলছি...",
    calculating: "হিসাব করছি...",
    fallback: "আপনার অনুরোধ নিয়ে কাজ করছি...",
    generic_error: "কিছু সমস্যা হয়েছে...",
  },
  ta: {
    reply: "பதில் எழுதுகிறேன்...",
    own_name: "என் பெயரைச் சொல்கிறேன்...",
    calculating: "கணக்கிடுகிறேன்...",
    fallback: "உங்கள் கோரிக்கையில் வேலை செய்கிறேன்...",
    generic_error: "ஏதோ சிக்கல் ஏற்பட்டது...",
  },
  te: {
    reply: "మీ సమాధానం రాస్తున్నాను...",
    own_name: "నా పేరు చెబుతున్నాను...",
    calculating: "లెక్క చేస్తున్నాను...",
    fallback: "మీ అభ్యర్థనపై పని చేస్తున్నాను...",
    generic_error: "ఏదో సమస్య వచ్చింది...",
  },
  kn: {
    reply: "ನಿಮ್ಮ ಉತ್ತರ ಬರೆಯುತ್ತಿದ್ದೇನೆ...",
    own_name: "ನನ್ನ ಹೆಸರು ಹೇಳುತ್ತಿದ್ದೇನೆ...",
    calculating: "ಲೆಕ್ಕ ಮಾಡುತ್ತಿದ್ದೇನೆ...",
    fallback: "ನಿಮ್ಮ ವಿನಂತಿಯ ಮೇಲೆ ಕೆಲಸ ಮಾಡುತ್ತಿದ್ದೇನೆ...",
    generic_error: "ಏನೋ ಸಮಸ್ಯೆ ಆಯಿತು...",
  },
  ml: {
    reply: "മറുപടി എഴുതുന്നു...",
    own_name: "എന്റെ പേര് പറയുന്നു...",
    calculating: "കണക്ക് ചെയ്യുന്നു...",
    fallback: "നിങ്ങളുടെ അഭ്യർത്ഥനയിൽ ജോലി ചെയ്യുന്നു...",
    generic_error: "എന്തോ പ്രശ്നം ഉണ്ടായി...",
  },
  pa: {
    reply: "ਤੁਹਾਡਾ ਜਵਾਬ ਲਿਖ ਰਹੀ ਹਾਂ...",
    own_name: "ਆਪਣਾ ਨਾਮ ਦੱਸ ਰਹੀ ਹਾਂ...",
    calculating: "ਹਿਸਾਬ ਕਰ ਰਹੀ ਹਾਂ...",
    fallback: "ਤੁਹਾਡੀ ਬੇਨਤੀ 'ਤੇ ਕੰਮ ਕਰ ਰਹੀ ਹਾਂ...",
    generic_error: "ਕੁਝ ਸਮੱਸਿਆ ਆ ਗਈ...",
  },
  or: {
    reply: "ଆପଣଙ୍କ ଉତ୍ତର ଲେଖୁଛି...",
    own_name: "ମୋର ନାମ କହୁଛି...",
    calculating: "ହିସାବ କରୁଛି...",
    fallback: "ଆପଣଙ୍କ ଅନୁରୋଧ ଉପରେ କାମ କରୁଛି...",
    generic_error: "କିଛି ସମସ୍ୟା ହେଲା...",
  },
  ur: {
    reply: "آپ کا جواب لکھ رہی ہوں...",
    own_name: "اپنا نام بتا رہی ہوں...",
    calculating: "حساب کر رہی ہوں...",
    fallback: "آپ کی درخواست پر کام کر رہی ہوں...",
    generic_error: "کچھ مسئلہ ہو گیا...",
  },
  ar: {
    reply: "أكتب الرد...",
    own_name: "أخبرك باسمي...",
    calculating: "أجري الحساب...",
    fallback: "أعمل على طلبك...",
    generic_error: "حدثت مشكلة ما...",
  },
  zh: {
    reply: "正在写回复...",
    own_name: "正在告诉你我的名字...",
    calculating: "正在计算...",
    fallback: "正在处理你的请求...",
    generic_error: "出了点问题...",
  },
  ja: {
    reply: "返信を作成中...",
    own_name: "名前をお伝えしています...",
    calculating: "計算しています...",
    fallback: "リクエストに取り組んでいます...",
    generic_error: "問題が発生しました...",
  },
  ko: {
    reply: "답장을 작성 중...",
    own_name: "제 이름을 알려드리는 중...",
    calculating: "계산 중...",
    fallback: "요청을 처리 중...",
    generic_error: "문제가 발생했습니다...",
  },
  ru: {
    reply: "Готовлю ответ...",
    own_name: "Называю своё имя...",
    calculating: "Выполняю расчёт...",
    fallback: "Работаю над вашим запросом...",
    generic_error: "Что-то пошло не так...",
  },
  es: {
    reply: "Preparando la respuesta...",
    own_name: "Te digo mi nombre...",
    calculating: "Haciendo el cálculo...",
    fallback: "Trabajando en tu solicitud...",
    generic_error: "Algo salió mal...",
  },
  fr: {
    reply: "Je prépare la réponse...",
    own_name: "Je vous donne mon nom...",
    calculating: "Je fais le calcul...",
    fallback: "Je travaille sur votre demande...",
    generic_error: "Un problème est survenu...",
  },
  de: {
    reply: "Antwort wird vorbereitet...",
    own_name: "Ich nenne meinen Namen...",
    calculating: "Berechne...",
    fallback: "Ich arbeite an deiner Anfrage...",
    generic_error: "Etwas ist schiefgelaufen...",
  },
  pt: {
    reply: "Preparando a resposta...",
    own_name: "Dizendo o meu nome...",
    calculating: "Fazendo o cálculo...",
    fallback: "Trabalhando no seu pedido...",
    generic_error: "Algo deu errado...",
  },
};

const phrase = (lang: StatusLangCode, key: PhraseKey): string =>
  stripStatusEmojis(PHRASES[lang]?.[key] || PHRASES.en![key]);

/** "Writing your reply" status, in the user's own language. */
export function getReplyStatus(lang: StatusLangCode): string {
  return phrase(lang, "reply");
}

/* ── Filler / small talk / identity detection ────────────────────────── */

/**
 * Words that can never be a status "subject" on their own. Without this a
 * message like "Kese ho ap kya karte hai" produced nonsense such as
 * "Kese check kar rahi hoon...".
 */
const FILLER_WORDS = new Set([
  "kese", "kaise", "kaisa", "kaisi", "kya", "kyu", "kyun", "kaun", "kon",
  "karte", "karti", "karta", "karna", "karo", "kar", "ho", "hu", "hoon",
  "hai", "hain", "ap", "aap", "apka", "aapka", "tum", "tu", "mai", "main",
  "hum", "you", "u", "me", "i", "we", "what", "who", "how", "why", "is",
  "are", "am", "do", "doing", "the", "a", "an", "ok", "okay", "haan", "han",
  "nahi", "yes", "no", "kuch", "sab", "bhi", "to", "toh", "naam", "name",
  "kem", "cho", "che", "chho", "shu", "tame", "tamaru", "mara", "maru",
]);

function isFillerSubject(subject: string): boolean {
  const words = subject.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => FILLER_WORDS.has(w));
}

/** Pull the person/topic the user is asking about, if any. */
export function extractSubject(text: string): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  const patterns: RegExp[] = [
    /^(.{2,60}?)\s+(?:kon|kaun|kon sa|who)\b/i,
    /(?:about|baare\s*mein|bare\s*me|vishe)\s+(.{2,60}?)(?:[?.!,]|$)/i,
    /^(?:who\s+is|what\s+is)\s+(.{2,60}?)(?:[?.!,]|$)/i,
    /^(?:search|dhundo|dhundh|find|check|shodho)\s+(.{2,60}?)(?:[?.!,]|$)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) {
      const s = m[1]
        .replace(/\b(google|par|pe|ka|ki|ke|hai|kya|karte|karti|karta|please|plz)\b/gi, " ")
        .replace(/[^\p{L}\p{N}\s.@_-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (s.length >= 2 && !isFillerSubject(s)) return clip(s);
    }
  }
  return "";
}

/** Greetings / chit-chat that need no lookup work at all. */
const SMALL_TALK = [
  /^(hi+|hey+|hello+|yo+|hola|namaste|namaskar|salaam|assalam[\w\s]*)\b/i,
  /^(good\s*(morning|afternoon|evening|night))\b/i,
  /\b(k[ae]s[ei]|kaisa|kaisi|kasa|kashi)\s*(ho|hai|hain|h|aahe|ahe)\b/i,
  /\bkem\s*(cho|chho)\b/i,
  /\bhow\s*(are|r)\s*(you|u)\b/i,
  /\bkya\s*(kar\s*(rah[eiy]|rhe|rhi)\s*(ho|hai|h)|karte\s*(ho|hai|h)|karti\s*(ho|hai|h)|haal|hal)\b/i,
  /\bwhat\s*(are\s*you\s*doing|do\s*you\s*do)\b/i,
  /^(thanks|thank\s*you|thx|shukriya|dhanyavad|aabhar|ty)\b/i,
  /^(ok|okay|okk|hmm+|acha|accha|theek|thik|sahi|great|nice|cool|bye|good\s*bye)\b/i,
  /[\u0915][\u0948][\u0938][\u0947]\s*(हो|हैं|है)/,
  /^(नमस्ते|नमस्कार|हैलो|हाय|धन्यवाद|शुक्रिया|ठीक|अच्छा)/,
  /^(કેમ\s*છો|નમસ્તે|આભાર)/,
];

/** True when the message is a greeting / chit-chat with no real task in it. */
export function isSmallTalk(userText: string): boolean {
  const raw = String(userText ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return false;
  if (raw.split(/\s+/).length > 12) return false;
  return SMALL_TALK.some((re) => re.test(raw));
}

/** "Apka naam kya hai", "who are you", "tamaru naam su che" ... */
const IDENTITY = [
  /\b(aapka|apka|apna|tumhara|tera|your)\s*(naam|name)\b/i,
  /\b(tamaru|tamaru\s*naam|tumcha)\s*(naam|nav)?\b.*\b(su|shu|kay|che)\b/i,
  /\bwho\s*(are|r)\s*(you|u)\b/i,
  /\bwhat('?s| is)\s*your\s*name\b/i,
  /\b(kaun|kon)\s*ho\s*(tum|aap|ap)\b/i,
  /(आपका|तुम्हारा)\s*नाम/,
  /(તમારું)\s*નામ/,
  /(तुमचं|तुझं)\s*नाव/,
];

/** True for "what is your name / who are you" style questions. */
export function isIdentityQuestion(userText: string): boolean {
  const raw = String(userText ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return false;
  return IDENTITY.some((re) => re.test(raw));
}

/* ── Intent classification ───────────────────────────────────────────── */

export type StatusIntent =
  | "greeting"
  | "identity"
  | "general_question"
  | "web_search"
  | "youtube_channel"
  | "youtube_analytics"
  | "video_analysis"
  | "video_seo"
  | "comments"
  | "calculation"
  | "writing"
  | "translation"
  | "image_understanding"
  | "image_creation"
  | "code"
  | "jobs"
  | "profile"
  | "wallet"
  | "company"
  | "social"
  | "document"
  | "send"
  | "unknown";

export interface IntentResult {
  intent: StatusIntent;
  /** Opening status parts, or null when no status should be shown at all. */
  parts: RequestStatusParts | null;
  /** Follow-up stages, shown only when the real work reaches them. */
  followUps: RequestStatusParts[];
  /** Special target-less phrase to use instead of `parts`. */
  phraseKey?: PhraseKey;
  subject: string;
}

const P = (verb: StatusVerb, target: string): RequestStatusParts => ({
  emoji: "",
  verb,
  target,
});

export function classifyIntent(userText: string, lang?: StatusLangCode): IntentResult {
  const raw = String(userText ?? "").trim();
  const L = lang || detectRequestLang(raw);
  const t = raw.toLowerCase();
  const has = (re: RegExp) => re.test(t);
  const tt = (k: TargetKey) => targetText(k, L);
  const subject = extractSubject(raw);
  const none: IntentResult = { intent: "unknown", parts: null, followUps: [], subject };

  if (!raw) return none;

  // 1. Greetings / small talk — never claim work.
  if (isSmallTalk(raw)) {
    return { intent: "greeting", parts: null, followUps: [], phraseKey: "reply", subject: "" };
  }

  // 2. Identity questions — the answer is already known.
  if (isIdentityQuestion(raw)) {
    return { intent: "identity", parts: null, followUps: [], phraseKey: "own_name", subject: "" };
  }

  // 3. Calculation
  if (
    has(/\b\d+(\.\d+)?\s*(%|percent|percentage)\b/) ||
    has(/\b\d+\s*[\+\-\*x\/]\s*\d+\b/) ||
    (has(/\d/) && has(/\b(calculate|calculation|kitna|ketlu|kiti|ganit|hisab|sum|total|average)\b/))
  ) {
    return { intent: "calculation", parts: null, followUps: [], phraseKey: "calculating", subject };
  }

  // 4. Translation
  if (has(/\b(translate|translation|anuvad|tarjuma|bhashantar)\b/)) {
    const targetLang =
      raw.match(/\b(gujarati|hindi|english|marathi|bengali|tamil|telugu|punjabi|kannada|malayalam|urdu|spanish|french|german)\b/i)?.[0];
    return {
      intent: "translation",
      parts: P("prepare", targetLang ? `${targetLang} translation` : "translation"),
      followUps: [],
      subject,
    };
  }

  // 5. Code
  if (has(/\bcode\b|\bfunction\b|\bbug\b|\berror\s*(log|message)\b|\bscript\b/)) {
    return {
      intent: "code",
      parts: P("look", tt("code")),
      followUps: [P("analyze", tt("code"))],
      subject,
    };
  }

  // 6. Screenshot / image understanding
  if (has(/\b(screenshot|screen\s*shot|ye image|is image|image dekh|photo dekh|picture dekh)\b/)) {
    return {
      intent: "image_understanding",
      parts: P("look", tt("screenshot")),
      followUps: [P("analyze", tt("screenshot"))],
      subject,
    };
  }

  // 7. Image creation
  if (has(/\b(image|photo|picture|poster|banner|logo|thumbnail)\b/) &&
      has(/\b(banao|bana|banade|banavo|generate|create|make|design|draw)\b/)) {
    return { intent: "image_creation", parts: P("create", tt("image")), followUps: [], subject };
  }

  // 8. YouTube family
  if (has(/\bseo\b/) && has(/youtube|video|title|tag|description/)) {
    return {
      intent: "video_seo",
      parts: has(/update|change|badal|improve|optimi[sz]e|kar\s*do|karo/)
        ? P("update", tt("video_seo"))
        : P("look", tt("video_seo")),
      followUps: [],
      subject,
    };
  }
  if (has(/analytic|analytics|insight|performance|watch\s*time|impression|ctr\b/)) {
    return {
      intent: "youtube_analytics",
      parts: P("look", tt("youtube_analytics")),
      followUps: [P("analyze", tt("channel_performance"))],
      subject,
    };
  }
  if (has(/comment/) && has(/video|youtube|channel/)) {
    return { intent: "comments", parts: P("read", tt("comments")), followUps: [], subject };
  }
  if (has(/\bvideo\b/) && has(/analyz|analys|samjh|review|check|dekh/)) {
    return {
      intent: "video_analysis",
      parts: P("analyze", tt("video")),
      followUps: [],
      subject,
    };
  }
  if (has(/youtube|\byt\b|channel|chanel/)) {
    if (has(/viral|most\s*view|sabse\s*(zyada|jyada)\s*view|top\s*video|best\s*video/)) {
      return { intent: "youtube_analytics", parts: P("look", tt("viral_videos")), followUps: [], subject };
    }
    if (has(/subscriber/)) {
      return { intent: "youtube_analytics", parts: P("look", tt("subscribers")), followUps: [], subject };
    }
    if (has(/\bvideo/)) {
      return { intent: "youtube_channel", parts: P("look", tt("youtube_videos")), followUps: [], subject };
    }
    const followUps = has(/improve|better|grow|suggestion|tips|kya karna/)
      ? [P("analyze", tt("channel_performance")), P("prepare", tt("improvements"))]
      : [];
    return { intent: "youtube_channel", parts: P("look", tt("youtube_channel")), followUps, subject };
  }

  // 9. Other social platforms
  if (has(/linkedin/)) {
    return { intent: "social", parts: P("look", subject ? `${subject} – LinkedIn` : tt("linkedin")), followUps: [], subject };
  }
  if (has(/instagram|\binsta\b/)) {
    return { intent: "social", parts: P("look", tt("instagram")), followUps: [], subject };
  }
  if (has(/twitter|\bx\.com\b/)) {
    return { intent: "social", parts: P("look", tt("twitter")), followUps: [], subject };
  }
  if (has(/facebook|\bfb\b/)) {
    return { intent: "social", parts: P("look", tt("facebook")), followUps: [], subject };
  }

  // 10. Writing / content creation
  if (has(/\b(title|description|caption|script|post|tweet|hashtag|bio|cover\s*letter)\b/) &&
      has(/\b(bana|banao|banavo|likh|likho|write|create|generate|prepare|draft|suggest)\b/)) {
    const what = raw.match(/\b(youtube\s+)?(title|description|caption|script|post|tweet|hashtag|bio|cover\s*letter)\b/i)?.[0];
    return { intent: "writing", parts: P("prepare", clip(what || tt("title"), 30)), followUps: [], subject };
  }

  // 11. Platform work
  if (has(/\bjob|naukri|vacancy|hiring|nokri/)) {
    return { intent: "jobs", parts: P("search", tt("jobs")), followUps: [], subject };
  }
  if (has(/resume|\bcv\b/)) {
    return { intent: "profile", parts: P("look", tt("resume")), followUps: [], subject };
  }
  if (has(/\bpdf\b|document|report|letter\b/)) {
    return { intent: "document", parts: P("prepare", "document"), followUps: [], subject };
  }
  if (has(/email\s*(bhej|send|karo)|send.*email|telegram/)) {
    return {
      intent: "send",
      parts: P("send", has(/telegram/) ? tt("telegram") : tt("email")),
      followUps: [],
      subject,
    };
  }
  if (has(/wallet|balance|refund|points|withdraw/)) {
    return { intent: "wallet", parts: P("look", tt("wallet")), followUps: [], subject };
  }
  if (has(/profile/)) {
    return { intent: "profile", parts: P("look", tt("profile")), followUps: [], subject };
  }
  if (has(/company|employer/)) {
    return { intent: "company", parts: P("look", tt("company")), followUps: [], subject };
  }

  // 12. Web search / latest info
  if (has(/\b(news|khabar|samachar|latest|aaj\s*ka|today'?s|trending|price|rate|weather)\b/)) {
    return {
      intent: "web_search",
      parts: P("look", tt("latest_info")),
      followUps: [P("analyze", tt("latest_info"))],
      subject,
    };
  }
  if (has(/\b(search|google|dhundo|dhundh|khojo|shodho)\b/)) {
    return { intent: "web_search", parts: P("search", subject || tt("web")), followUps: [], subject };
  }

  // 13. Plain question with a real subject → checking the answer
  if (has(/\?|kon|kaun|kya|kyu|kyun|what|who|why|how|when|where|kevi|kayu|shu\b/)) {
    return { intent: "general_question", parts: P("look", tt("answer")), followUps: [], subject };
  }

  // 14. Fallback — never the default when anything above matched.
  return { intent: "unknown", parts: null, followUps: [], phraseKey: "fallback", subject };
}

/* ── Action-state layer ──────────────────────────────────────────────── */

const ACTION_VERB: Partial<Record<StatusAction, StatusVerb>> = {
  searching: "search",
  fetching: "look",
  checking: "look",
  analyzing: "analyze",
  comparing: "compare",
  generating: "create",
  writing: "prepare",
  verifying: "verify",
  finalizing: "prepare",
  error: "error",
};

export interface GenerateStatusInput {
  userText?: string;
  lang?: StatusLangCode;
  /** Real work stage the assistant is in right now. */
  action?: StatusAction;
  /** Real tool/API being called, when one is running. */
  tool?: string;
  /** Explicit subject override (e.g. taken from the tool arguments). */
  target?: string;
}

/**
 * THE central status generator.
 * Priority: real action -> intent -> language/style -> tool -> fallback.
 */
export function generateStatus(input: GenerateStatusInput): string {
  const { userText = "", action, tool, target } = input;
  const lang = input.lang || detectRequestLang(userText);
  const intent = classifyIntent(userText, lang);

  if (action === "completed") return "";

  // Greeting / identity / calculation → fixed truthful phrase, no fake work.
  if (intent.phraseKey && action !== "error") {
    if (intent.phraseKey === "fallback" && (action || tool)) {
      // A real action is running — describe that instead of the fallback.
    } else {
      return phrase(lang, intent.phraseKey);
    }
  }

  if (action === "error") {
    const errTarget = target || intent.parts?.target;
    return errTarget
      ? renderStatus(P("error", errTarget), lang)
      : phrase(lang, "generic_error");
  }

  const verb = action ? ACTION_VERB[action] : undefined;
  const resolvedTarget =
    target ||
    intent.parts?.target ||
    (tool ? humanizeTool(tool) : "") ||
    targetText("request", lang);

  if (verb) return renderStatus(P(verb, resolvedTarget), lang);
  if (intent.parts) return renderStatus(intent.parts, lang);
  return phrase(lang, "fallback");
}

/** "get_youtube_channel_details" → "YouTube channel details" */
function humanizeTool(tool: string): string {
  return clip(
    String(tool)
      .replace(/^(get|fetch|read|list|search|check|update|create|generate|send|analyze)_/, "")
      .replace(/_/g, " ")
      .replace(/\byoutube\b/gi, "YouTube")
      .trim(),
    30,
  );
}

/** Follow-up stage statuses for a message, in order. */
export function getFollowUpStatuses(userText: string, lang?: StatusLangCode): string[] {
  const L = lang || detectRequestLang(userText);
  return classifyIntent(userText, L).followUps.map((p) => renderStatus(p, L));
}

/* ── Backwards-compatible helpers ────────────────────────────────────── */

/** Structured, language-independent description of what is about to happen. */
export function buildRequestStatusParts(userText: string): RequestStatusParts | null {
  return classifyIntent(userText).parts;
}

/**
 * Final opener status string in the user's own language.
 * Returns "" when no status should be shown (pure greetings are handled by
 * the caller through `classifyIntent`).
 */
export function buildRequestStatus(userText: string, lang?: StatusLangCode): string {
  const language = lang || detectRequestLang(userText);
  return generateStatus({ userText, lang: language });
}

/** Error status for a failed run, in the user's language. */
export function buildErrorStatus(userText: string, lang?: StatusLangCode): string {
  const language = lang || detectRequestLang(userText);
  return generateStatus({ userText, lang: language, action: "error" });
}

/* ── Localizing server-generated (Hinglish) status lines ─────────────── */

const VERB_PATTERNS: Array<[RegExp, StatusVerb]> = [
  [/\b(update kar rahi hoon|update kar rahe hain)\b/i, "update"],
  [/\b(analyze kar rahi hoon|analyse kar rahi hoon)\b/i, "analyze"],
  [/\b(verify kar rahi hoon)\b/i, "verify"],
  [/\b(search kar rahi hoon|dhundh rahi hoon|dhoondh rahi hoon|dhundh rahe hain)\b/i, "search"],
  [/\b(padh rahi hoon|read kar rahi hoon)\b/i, "read"],
  [/\b(bana rahi hoon|banarahi hoon|generate kar rahi hoon)\b/i, "create"],
  [/\b(taiyaar kar rahi hoon|prepare kar rahi hoon)\b/i, "prepare"],
  [/\b(bhej rahi hoon|bhejne ki taiyari|send kar rahi hoon)\b/i, "send"],
  [/\b(dekh rahi hoon|dekhrahi hoon|check kar rahi hoon|nikaal rahi hoon)\b/i, "look"],
];

/**
 * Convert a Hinglish status line produced by the backend into the language the
 * user is actually writing in, always emoji-free.
 */
export function localizeStatusText(text: string, lang: StatusLangCode): string {
  const raw = stripStatusEmojis(text);
  if (!raw) return "";
  if (lang === "hinglish") return raw;

  const body = raw;
  for (const [re, verb] of VERB_PATTERNS) {
    if (!re.test(body)) continue;
    const target = body
      .replace(re, " ")
      .replace(/\.{2,}|…/g, " ")
      .replace(/\b(par|pe|ka|ki|ke|mein|me)\b\s*$/i, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!target) return raw;
    return renderStatus(P(verb, target), lang);
  }

  if (/kar rahi hoon|rahi hoon|rahe hain/i.test(body)) {
    const rest = body
      .replace(/\b(kar rahi hoon|rahi hoon|rahe hain)\b/gi, " ")
      .replace(/\.{2,}|…/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (rest) return renderStatus(P("look", rest), lang);
  }

  return raw;
}
