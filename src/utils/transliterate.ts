/**
 * Best-effort Devanagari (Hindi script) to Roman/Latin transliteration.
 * The job database is stored in English/Hinglish, so speaking in Hindi
 * script produces zero results. This converts common Devanagari characters
 * to Roman letters so searches like "नौकरी" become "naukri".
 *
 * This is intentionally simple — not linguistically perfect, but enough
 * for job/company keyword matching.
 */

const VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
};

const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gy',
  'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f', 'ज़': 'z', 'क़': 'q',
};

const MATRAS: Record<string, string> = {
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
  'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ं': 'n', 'ँ': 'n', 'ः': 'h',
};

const HALANT = '्';

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

export const containsDevanagari = (text: string): boolean =>
  DEVANAGARI_REGEX.test(text || '');

export const devanagariToLatin = (input: string): string => {
  if (!input) return '';
  if (!containsDevanagari(input)) return input;

  let out = '';
  const chars = Array.from(input);

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];

    if (VOWELS[ch]) {
      out += VOWELS[ch];
      continue;
    }
    if (CONSONANTS[ch]) {
      out += CONSONANTS[ch];
      // If followed by halant, no inherent 'a'
      if (next === HALANT) {
        i++; // skip halant
        continue;
      }
      // If followed by a matra, matra will supply the vowel
      if (next && MATRAS[next]) {
        out += MATRAS[next];
        i++;
        continue;
      }
      // Otherwise inherent 'a' (schwa)
      out += 'a';
      continue;
    }
    if (MATRAS[ch]) {
      // Standalone matra (rare) — just emit
      out += MATRAS[ch];
      continue;
    }
    if (ch === HALANT) {
      continue;
    }
    // Digits, punctuation, spaces — keep as-is (also convert Devanagari digits)
    const devDigit = '०१२३४५६७८९'.indexOf(ch);
    if (devDigit >= 0) {
      out += String(devDigit);
      continue;
    }
    out += ch;
  }

  // Clean up: remove trailing schwas that make words look ugly ("naukaree" → "naukri" is out of scope,
  // but strip double spaces)
  return out.replace(/\s+/g, ' ').trim();
};

/**
 * Sanitize a voice/text search query: keep English/Hinglish only.
 * Devanagari and other non-Latin scripts are transliterated when possible.
 */
export const sanitizeSearchQuery = (text: string): string => {
  if (!text) return '';
  if (!containsDevanagari(text)) return text;
  return devanagariToLatin(text);
};
