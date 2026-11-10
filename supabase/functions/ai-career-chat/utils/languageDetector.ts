export type SupportedLang =
  | 'hi' // Hindi
  | 'en' // English
  | 'bn' // Bengali
  | 'ta' // Tamil
  | 'te' // Telugu
  | 'mr' // Marathi
  | 'gu' // Gujarati
  | 'kn' // Kannada
  | 'ml' // Malayalam
  | 'pa' // Punjabi (Gurmukhi)
  | 'or' // Odia
  | 'ur' // Urdu
  | 'ar' // Arabic
  | 'zh' // Chinese
  | 'ja' // Japanese
  | 'ko' // Korean
  | 'ru' // Russian / Cyrillic
  | 'es' // Spanish
  | 'fr' // French
  | 'de' // German
  | 'pt'; // Portuguese

const SCRIPT_RANGES: Array<{ lang: SupportedLang; pattern: RegExp }> = [
  { lang: 'hi', pattern: /[\u0900-\u097F]/ },        // Devanagari (Hindi/Marathi)
  { lang: 'bn', pattern: /[\u0980-\u09FF]/ },        // Bengali
  { lang: 'pa', pattern: /[\u0A00-\u0A7F]/ },        // Gurmukhi (Punjabi)
  { lang: 'gu', pattern: /[\u0A80-\u0AFF]/ },        // Gujarati
  { lang: 'or', pattern: /[\u0B00-\u0B7F]/ },        // Odia
  { lang: 'ta', pattern: /[\u0B80-\u0BFF]/ },        // Tamil
  { lang: 'te', pattern: /[\u0C00-\u0C7F]/ },        // Telugu
  { lang: 'kn', pattern: /[\u0C80-\u0CFF]/ },        // Kannada
  { lang: 'ml', pattern: /[\u0D00-\u0D7F]/ },        // Malayalam
  { lang: 'ur', pattern: /[\u0600-\u06FF]/ },        // Arabic script (Urdu/Arabic) — refined below
  { lang: 'zh', pattern: /[\u4E00-\u9FFF]/ },        // CJK
  { lang: 'ja', pattern: /[\u3040-\u309F\u30A0-\u30FF]/ }, // Hiragana/Katakana
  { lang: 'ko', pattern: /[\uAC00-\uD7AF]/ },        // Hangul
  { lang: 'ru', pattern: /[\u0400-\u04FF]/ },        // Cyrillic
];

const LANG_NAME: Record<SupportedLang, string> = {
  hi: 'Hindi', en: 'English', bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
  mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
  or: 'Odia', ur: 'Urdu', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
  ko: 'Korean', ru: 'Russian', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese',
};

// Simple Latin-script keyword sniffers for common European languages
const LATIN_HINTS: Array<{ lang: SupportedLang; words: RegExp }> = [
  { lang: 'es', words: /\b(hola|gracias|por favor|cómo|qué|buenos|días|trabajo|empleo)\b/i },
  { lang: 'fr', words: /\b(bonjour|merci|s'il vous plaît|comment|quoi|travail|emploi|oui|non)\b/i },
  { lang: 'de', words: /\b(hallo|danke|bitte|wie|was|arbeit|guten|tag|ja|nein)\b/i },
  { lang: 'pt', words: /\b(olá|obrigado|por favor|como|trabalho|emprego|sim|não)\b/i },
];

export function detectLanguage(text: string): SupportedLang {
  if (!text) return 'en';

  // Script-based detection (highest confidence)
  for (const { lang, pattern } of SCRIPT_RANGES) {
    if (pattern.test(text)) {
      // Distinguish Urdu vs Arabic by common Urdu-only chars
      if (lang === 'ur' && /[\u0627\u0644\u0645]/.test(text) && !/[\u06A9\u06AF\u06CC\u06BE\u0679]/.test(text)) {
        return 'ar';
      }
      return lang;
    }
  }

  // Latin-script keyword hints
  for (const { lang, words } of LATIN_HINTS) {
    if (words.test(text)) return lang;
  }

  return 'en';
}

export function getLanguageName(lang: SupportedLang): string {
  return LANG_NAME[lang] || 'English';
}

export function getResponseInLanguage(lang: SupportedLang | string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    error_auth: {
      hi: 'क्षमा करें, आपको यह कार्य करने के लिए लॉगिन करना होगा।',
      en: 'Sorry, you need to be logged in to perform this action.'
    },
    error_general: {
      hi: 'क्षमा करें, कुछ गलत हो गया। कृपया दोबारा प्रयास करें।',
      en: 'Sorry, something went wrong. Please try again.'
    },
    success_update: {
      hi: 'सफलतापूर्वक अपडेट किया गया!',
      en: 'Successfully updated!'
    }
  };

  return translations[key]?.[lang as string] || translations[key]?.['en'] || '';
}
