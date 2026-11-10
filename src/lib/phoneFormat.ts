/**
 * Country-aware "as you type" formatting for national phone numbers.
 * '#' = digit. Countries without a pattern get grouped in blocks of 3-4.
 */
const PATTERNS: Record<string, string> = {
  IN: '##### #####',
  US: '(###) ###-####',
  CA: '(###) ###-####',
  GB: '#### ######',
  AE: '## ### ####',
  SA: '## ### ####',
  AU: '### ### ###',
  SG: '#### ####',
  PK: '### #######',
  BD: '#### ######',
  NP: '###-#######',
  LK: '## ### ####',
  DE: '### ########',
  FR: '# ## ## ## ##',
  IT: '### ### ####',
  ES: '### ### ###',
  BR: '(##) #####-####',
  CN: '### #### ####',
  JP: '##-####-####',
  RU: '(###) ###-##-##',
  MY: '##-### ####',
  PH: '### ### ####',
  ID: '###-####-####',
  NG: '### ### ####',
  ZA: '## ### ####',
  KE: '### ######',
  QA: '#### ####',
  KW: '#### ####',
  OM: '#### ####',
  BH: '#### ####',
  NL: '# ########',
  NZ: '## ### ####',
  MX: '## #### ####',
  TR: '(###) ### ## ##',
};

import { AsYouType, getExampleNumber, validatePhoneNumberLength, isValidPhoneNumber, type CountryCode as LibCC } from 'libphonenumber-js/max';
import examples from 'libphonenumber-js/mobile/examples';

const cache: Record<string, number> = {};
/** Max national digits per country, from worldwide numbering rules. */
export const maxNationalDigits = (code: string, dial: string) => {
  if (cache[code]) return cache[code];
  let max = Math.max(4, 15 - dial.length);
  try {
    // Grow until the number becomes TOO_LONG for this country.
    for (let n = 4; n <= 15 - dial.length; n++) {
      if (validatePhoneNumberLength('9'.repeat(n), code as LibCC) === 'TOO_LONG') { max = n - 1; break; }
    }
    const ex = getExampleNumber(code as LibCC, examples);
    if (ex) max = Math.max(Math.min(max, ex.nationalNumber.length), ex.nationalNumber.length);
  } catch { /* unknown region: keep E.164 limit */ }
  cache[code] = max;
  return max;
};

export const formatNationalPhone = (code: string, digits: string) => {
  const d = (digits || '').replace(/\D/g, '');
  if (!d) return '';
  try {
    const out = new AsYouType(code as LibCC).input(d);
    if (out && out.replace(/\D/g, '') === d) return out;
  } catch { /* fall through */ }
  const pattern = PATTERNS[code];
  if (!pattern) return d.replace(/(\d{3,4})(?=\d)/g, '$1 ').trim();
  let res = ''; let i = 0;
  for (const ch of pattern) { if (i >= d.length) break; res += ch === '#' ? d[i++] : ch; }
  return res;
};

/** True when the number is a valid, complete number for that country. */
export const isCompleteNationalPhone = (code: string, dial: string, digits: string) => {
  const d = (digits || '').replace(/\D/g, '');
  if (!d) return false;
  try { return isValidPhoneNumber(d, code as LibCC); } catch { return d.length >= 6 && d.length <= 15 - dial.length; }
};

const PHONE_CHARS = /^[+\d\s()-]+$/;

/**
 * Login "Email or Mobile" field: once digits are typed the box locks to
 * phone mode (letters/@ ignored) until every digit is erased; digits are
 * formatted for the selected country as the user types.
 */
export const nextLoginIdentifier = (
  prev: string,
  raw: string,
  country: { code: string; dial: string },
) => {
  const prevPhone = !!prev && !prev.includes('@') && PHONE_CHARS.test(prev.trim()) && /\d/.test(prev);
  const rawTrim = (raw || '').trim();
  const rawIsPhone = !!rawTrim && PHONE_CHARS.test(rawTrim) && /\d/.test(rawTrim);
  if (prevPhone || (!prev && rawIsPhone)) {
    if (/[^+\d\s()-]/.test(raw)) return prev; // block letters/@ in phone mode
    let digits = raw.replace(/\D/g, '');
    if (rawTrim.startsWith('+') && digits.startsWith(country.dial)) digits = digits.slice(country.dial.length);
    digits = digits.replace(/^0+/, '').slice(0, maxNationalDigits(country.code, country.dial));
    return formatNationalPhone(country.code, digits);
  }
  return raw;
};

/** Value used for server lookups: phone → +<dial><national>, email unchanged. */
export const loginLookupValue = (value: string, country: { dial: string }) => {
  const v = (value || '').trim();
  if (v && !v.includes('@') && PHONE_CHARS.test(v) && /\d/.test(v)) {
    const d = v.replace(/\D/g, '');
    return d ? `+${country.dial}${d}` : '';
  }
  return v;
};
