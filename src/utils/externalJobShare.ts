/**
 * External-partner (Careerjet / Adzuna / Jooble) share URL payload helpers.
 *
 * Why this exists
 * ---------------
 * Recipients of a shared external-job link have no sessionStorage, so the
 * detail page must hydrate from the URL itself. The payload rides in a
 * url-safe base64 `?d=` param.
 *
 * We use compact single-letter keys and drop the description (detail page
 * already trims to 500 chars anyway) so the encoded URL stays well under
 * WhatsApp / X truncation limits, even for long job titles + company names
 * in non-ASCII scripts (Hindi, etc). Both the new compact format and the
 * legacy verbose format decode correctly for backward compatibility with
 * links shared before this change.
 */

export interface SharedExternalJob {
  external_id: string;
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  type?: string;
  description?: string;
  snippet?: string;
  link?: string;
  source?: string;
  updated?: string | null;
  company_logo?: string | null;
  category?: string | null;
}

/** Compact payload with single-letter keys. Description intentionally dropped. */
interface CompactPayload {
  x: string;              // external_id
  t?: string;             // title
  c?: string;             // company
  l?: string;             // location
  s?: string;             // salary
  y?: string;             // type
  lk?: string;            // link
  src?: string;           // source
  u?: string | null;      // updated
  lg?: string | null;     // company_logo
  cat?: string | null;    // category
}

function urlSafeB64Encode(str: string): string {
  const utf8 = typeof window !== 'undefined' && typeof window.btoa === 'function'
    ? window.btoa(unescape(encodeURIComponent(str)))
    : // Node/edge fallback
      (globalThis as unknown as { Buffer?: { from: (s: string, e: string) => { toString: (f: string) => string } } })
        .Buffer!.from(str, 'utf-8').toString('base64');
  return utf8.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function urlSafeB64Decode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return decodeURIComponent(escape(window.atob(b64)));
  }
  const Buf = (globalThis as unknown as { Buffer?: { from: (s: string, e: string) => { toString: (f: string) => string } } }).Buffer;
  return Buf!.from(b64, 'base64').toString('utf-8');
}

/**
 * Encode a job into the url-safe base64 `?d=` value. Returns '' on failure so
 * callers can gracefully fall back to a bare `/ej/:source/:extId` URL.
 */
export function encodeSharedJob(job: SharedExternalJob): string {
  try {
    const compact: CompactPayload = {
      x: String(job.external_id || ''),
      t: job.title,
      c: job.company,
      l: job.location,
      s: job.salary,
      y: job.type,
      lk: job.link,
      src: job.source,
      u: job.updated ?? null,
      lg: job.company_logo ?? null,
      cat: job.category ?? null,
    };
    // Drop null / undefined / empty-string fields to shrink the URL
    for (const k of Object.keys(compact) as (keyof CompactPayload)[]) {
      const v = compact[k];
      if (v === undefined || v === null || v === '') delete compact[k];
    }
    return urlSafeB64Encode(JSON.stringify(compact));
  } catch {
    return '';
  }
}

/**
 * Decode a `?d=` payload back into a hydration-ready job object. Supports
 * both the new compact format (single-letter keys) and the legacy verbose
 * format (`external_id`, `title`, …) that older shared links still use.
 * Returns null if the payload cannot be decoded or lacks an `external_id`.
 */
export function decodeSharedJob(payload: string | null | undefined): SharedExternalJob | null {
  if (!payload) return null;
  try {
    const json = urlSafeB64Decode(payload);
    const raw = JSON.parse(json) as Record<string, unknown>;

    // Legacy format has `external_id` at the top level.
    if (typeof raw.external_id === 'string' && raw.external_id) {
      return raw as unknown as SharedExternalJob;
    }

    // Compact format
    const x = typeof raw.x === 'string' ? raw.x : '';
    if (!x) return null;

    const asStr = (v: unknown): string | undefined =>
      typeof v === 'string' && v ? v : undefined;
    const asNullableStr = (v: unknown): string | null | undefined => {
      if (v === null) return null;
      if (typeof v === 'string' && v) return v;
      return undefined;
    };

    return {
      external_id: x,
      title: asStr(raw.t),
      company: asStr(raw.c),
      location: asStr(raw.l),
      salary: asStr(raw.s),
      type: asStr(raw.y),
      link: asStr(raw.lk),
      source: asStr(raw.src),
      updated: asNullableStr(raw.u),
      company_logo: asNullableStr(raw.lg),
      category: asNullableStr(raw.cat),
    };
  } catch {
    return null;
  }
}
