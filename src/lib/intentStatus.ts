/**
 * Thin compatibility wrapper around the central status generator.
 *
 * All status text now comes from `src/lib/requestStatus.ts` so there is a
 * single source of truth for intent, language and action-state phrasing.
 */
import type { StatusLang } from './instantStatus';
import {
  generateStatus,
  extractSubject as extractStatusSubject,
  type StatusLangCode,
} from './requestStatus';

export function getIntentStatus(text: string, lang?: StatusLang): string {
  return generateStatus({ userText: text, lang: lang as StatusLangCode | undefined });
}

export const extractSubject = extractStatusSubject;
