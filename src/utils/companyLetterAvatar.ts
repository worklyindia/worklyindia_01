/**
 * Generate a colorful letter avatar for a company when no real logo is
 * available. Each company gets a stable, varied color picked from a palette
 * based on a hash of the name, so different companies visually look distinct
 * (instead of every fallback looking like the same generic Jooble "J" tile).
 */

const PALETTE: { bg: string; fg: string }[] = [
  { bg: 'bg-rose-500', fg: 'text-white' },
  { bg: 'bg-orange-500', fg: 'text-white' },
  { bg: 'bg-amber-500', fg: 'text-white' },
  { bg: 'bg-lime-600', fg: 'text-white' },
  { bg: 'bg-emerald-600', fg: 'text-white' },
  { bg: 'bg-teal-600', fg: 'text-white' },
  { bg: 'bg-cyan-600', fg: 'text-white' },
  { bg: 'bg-sky-600', fg: 'text-white' },
  { bg: 'bg-blue-600', fg: 'text-white' },
  { bg: 'bg-indigo-600', fg: 'text-white' },
  { bg: 'bg-violet-600', fg: 'text-white' },
  { bg: 'bg-purple-600', fg: 'text-white' },
  { bg: 'bg-fuchsia-600', fg: 'text-white' },
  { bg: 'bg-pink-600', fg: 'text-white' },
  { bg: 'bg-red-600', fg: 'text-white' },
  { bg: 'bg-slate-700', fg: 'text-white' },
];

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export interface LetterAvatar {
  letter: string;
  bg: string;
  fg: string;
}

export const getCompanyLetterAvatar = (company?: string | null): LetterAvatar => {
  const name = (company || '').trim();
  const letter = (name[0] || '?').toUpperCase();
  const idx = name ? hash(name.toLowerCase()) % PALETTE.length : 0;
  const { bg, fg } = PALETTE[idx];
  return { letter, bg, fg };
};
