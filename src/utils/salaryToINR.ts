/**
 * Convert an external job salary string (Jooble often returns USD/EUR/GBP)
 * into an Indian Rupee (INR) display formatted with both yearly and monthly
 * amounts using Indian digit grouping (e.g. "₹63,00,000/year (₹5,25,000/month)").
 *
 * Indian users compare jobs primarily by monthly salary, so we always show it
 * alongside the yearly figure. LPA / lakh shorthand is intentionally avoided.
 */

const FX_TO_INR: Record<string, number> = {
  USD: 83,
  '$': 83,
  EUR: 90,
  '€': 90,
  GBP: 105,
  '£': 105,
  CAD: 61,
  AUD: 55,
  SGD: 62,
  AED: 22,
};

const INR_MARKERS = /(₹|inr|rs\.?|rupees?)/i;

/** Format a plain number using Indian digit grouping (e.g. 6300000 → "₹63,00,000"). */
const inr = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * Format an annual INR amount as "₹YY,YY,YYY/year (₹MM,MM,MMMM/month)".
 * Returns empty string for non-positive / non-finite values.
 */
const formatAnnualINR = (annual: number): string => {
  if (!isFinite(annual) || annual <= 0) return '';
  const monthly = annual / 12;
  return `${inr(annual)}/year (${inr(monthly)}/month)`;
};

const detectCurrency = (s: string): { code: string; rate: number } | null => {
  const upper = s.toUpperCase();
  for (const key of Object.keys(FX_TO_INR)) {
    if (upper.includes(key.toUpperCase())) {
      return { code: key, rate: FX_TO_INR[key] };
    }
  }
  return null;
};

export type SalaryPeriod = 'Hourly' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export const detectPeriod = (s: string): SalaryPeriod => {
  const lower = s.toLowerCase();
  if (/(per\s*hour|\/\s*hr|\bhour(ly)?\b|\bhr\b)/.test(lower)) return 'Hourly';
  if (/(per\s*day|\/\s*day|\bdaily\b|\bday\b|\bpd\b)/.test(lower)) return 'Daily';
  if (/(per\s*week|\/\s*wk|\bweek(ly)?\b)/.test(lower)) return 'Weekly';
  if (/(per\s*month|\/\s*mo|\bmonth(ly)?\b|\bmo\b|\bpm\b)/.test(lower)) return 'Monthly';
  return 'Yearly';
};

/** Maps detected period to a clean unit label used in "Per {Unit}" suffix. */
export const PERIOD_UNIT: Record<SalaryPeriod, string> = {
  Hourly: 'Hour',
  Daily: 'Day',
  Weekly: 'Week',
  Monthly: 'Month',
  Yearly: 'Year',
};

/** Strip trailing period tokens like "/monthly", "per hour", "yearly", "/year". */
export const stripPeriodTokens = (s: string): string => {
  return s
    .replace(/\s*\/\s*(hourly|hour|hr|daily|day|weekly|week|wk|monthly|month|mo|yearly|year|yr|annually|annum|pa)\b\.?/gi, '')
    .replace(/\s*(per\s*(hour|day|week|month|year|annum)|\b(hourly|daily|weekly|monthly|yearly|annually)\b)\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

/**
 * Normalise any salary string to "<amount> Per <Unit>" form.
 * Examples: "$16 - $21 per hour" -> "$16 - $21 Per Hour",
 *           "₹18,000 - 28,000 / monthly" -> "₹18,000 - 28,000 Per Month".
 */
export const formatSalaryWithPeriod = (raw?: string | null): string => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const period = detectPeriod(s);
  const cleaned = stripPeriodTokens(s);
  return `${cleaned} Per ${PERIOD_UNIT[period]}`;
};

const PERIOD_TO_ANNUAL: Record<SalaryPeriod, number> = {
  Hourly: 40 * 52,
  Daily: 5 * 52,
  Weekly: 52,
  Monthly: 12,
  Yearly: 1,
};

/** Detect "LPA" / "lakhs per annum" shorthand and return a multiplier. */
const detectMagnitude = (s: string): number => {
  const lower = s.toLowerCase();
  if (/\blpa\b|lakhs?\s*(per\s*)?(annum|year|yr|pa)?|\bl\s*(?:pa|p\.a\.?)/.test(lower)) return 100000;
  if (/\bcrore(s)?\b|\bcr\b/.test(lower)) return 10000000;
  return 1;
};

const scale = (n: number, unit?: string) => {
  if (!unit) return n;
  if (unit.toLowerCase() === 'k') return n * 1_000;
  if (unit.toLowerCase() === 'm') return n * 1_000_000;
  return n;
};

export const convertSalaryToINR = (raw?: string | null): string => {
  return explainSalaryToINR(raw).display;
};

export interface SalaryINRExplanation {
  display: string;
  breakdown: string;
  period: SalaryPeriod;
}

/**
 * Convert salary and also return a human-readable breakdown of how the INR
 * approximation was derived (period assumption, FX rate, formula) so users
 * can see exactly why the "Approx (INR)" number came out that way.
 */
export const explainSalaryToINR = (raw?: string | null): SalaryINRExplanation => {
  const empty: SalaryINRExplanation = { display: '', breakdown: '', period: 'Yearly' };
  if (!raw) return empty;
  const trimmed = String(raw).trim();
  if (!trimmed) return empty;

  const isINR = INR_MARKERS.test(trimmed) || /\blpa\b|lakhs?|\bcrore/i.test(trimmed);
  const currency = isINR ? null : detectCurrency(trimmed);
  const periodName = detectPeriod(trimmed);
  if (!isINR && !currency) return { ...empty, period: periodName };
  const rate = currency?.rate ?? 1;
  const currencyCode = isINR ? 'INR' : (currency?.code || '').toUpperCase();
  const periodMult = PERIOD_TO_ANNUAL[periodName];
  const magnitude = detectMagnitude(trimmed);
  const period = `per ${periodName.toLowerCase().replace('ly', periodName === 'Daily' ? ' day' : periodName === 'Weekly' ? ' week' : periodName === 'Monthly' ? ' month' : periodName === 'Hourly' ? ' hour' : ' year')}`;

  const cleaned = trimmed.replace(/,/g, '');
  const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(k|m)?\s*(?:-|to|–|—)\s*(\d+(?:\.\d+)?)\s*(k|m)?/i);
  const singleMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(k|m)?/i);

  const buildBreakdown = (baseAnnual: number): string => {
    const parts: string[] = [];
    parts.push(`Source: ${trimmed} (${period})`);
    if (!isINR) parts.push(`FX rate used: 1 ${currencyCode} ≈ ₹${rate}`);
    if (periodName === 'Hourly') parts.push('Annualised as: amount × 40 hrs/week × 52 weeks');
    else if (periodName === 'Daily') parts.push('Annualised as: amount × 5 days/week × 52 weeks');
    else if (periodName === 'Weekly') parts.push('Annualised as: amount × 52 weeks');
    else if (periodName === 'Monthly') parts.push('Annualised as: amount × 12 months');
    if (magnitude === 100000) parts.push('LPA detected → ×1,00,000');
    else if (magnitude === 10000000) parts.push('Crore detected → ×1,00,00,000');
    parts.push(`Yearly (INR) = ${inr(baseAnnual)}`);
    parts.push(`Monthly (INR) = Yearly ÷ 12 = ${inr(baseAnnual / 12)}`);
    parts.push('Note: This is an approximate conversion for easy comparison.');
    return parts.join('\n');
  };

  if (rangeMatch) {
    const low = scale(parseFloat(rangeMatch[1]), rangeMatch[2]) * magnitude * periodMult * rate;
    const high = scale(parseFloat(rangeMatch[3]), rangeMatch[4]) * magnitude * periodMult * rate;
    if (low > 0 && high > 0) {
      const display = `${inr(low)} – ${inr(high)}/year (${inr(low / 12)} – ${inr(high / 12)}/month)`;
      const avg = (low + high) / 2;
      return { display, breakdown: buildBreakdown(avg), period: periodName };
    }
  }

  if (singleMatch) {
    const annual = scale(parseFloat(singleMatch[1]), singleMatch[2]) * magnitude * periodMult * rate;
    const formatted = formatAnnualINR(annual);
    if (formatted) return { display: formatted, breakdown: buildBreakdown(annual), period: periodName };
  }

  return { ...empty, period: periodName };
};

