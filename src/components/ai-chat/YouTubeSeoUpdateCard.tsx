import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Youtube, AlertTriangle, Pencil, X, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  buildYouTubePayload,
  deriveHashtags,
  deriveTags,
  sanitizeDescription,
  sanitizeHashtags,
  sanitizeTags,
  sanitizeTitle,
  stripComparisonNoise,
  stripHashtagNoise,
} from '@/utils/youtubeSeoPayload';

import { recordSeoFeedback } from '@/utils/youtubeSeoLearning';



export type YtSeoField = 'title' | 'description' | 'tags' | 'hashtags' | 'categoryId';

export interface YtSeoUpdatePayload {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  hashtags?: string[];
  categoryId?: string;
  kind?: 'short' | 'long';
  label?: string;
  /**
   * Only these fields are being changed. Everything else must stay EXACTLY as
   * it is on YouTube right now (the card refills them from the live metadata).
   */
  fields?: YtSeoField[];
}

// Tolerant: closing fence optional (AI sometimes forgets it / stream cuts off)
const BLOCK_RE = /```yt[-_]?update\s*([\s\S]*?)(?:```|$)/i;

const YT_CATEGORY_NAMES: Record<string, string> = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism',
};

/**
 * Every path that produces an update payload runs through this: raw AI text is
 * never allowed to reach the YouTube API, and each field stays in its own lane.
 */
function cleanPayload(raw: YtSeoUpdatePayload): YtSeoUpdatePayload | null {
  const fields = raw.fields && raw.fields.length ? raw.fields : undefined;
  const wants = (f: YtSeoField) => !fields || fields.includes(f);

  const title = sanitizeTitle(raw.title);
  let description = sanitizeDescription(raw.description);
  let { tags } = sanitizeTags(raw.tags);
  let hashtags = sanitizeHashtags(
    raw.hashtags && raw.hashtags.length
      ? raw.hashtags
      : (String(raw.description || '').match(/#[\p{L}\p{N}\p{M}_]{2,}/gu) || []),
  );
  // AI sometimes returns an empty/spammed tag or hashtag list — never publish
  // a video with zero tags: rebuild them from the real title keywords.
  // (Only for a full pack — in a partial update the old values are kept.)
  if (!fields) {
    if (!tags.length) tags = deriveTags(title, hashtags);
    if (!hashtags.length) hashtags = deriveHashtags(title, tags);
  }
  // Drop bare keyword-dump lines ("khetvlog farming gaonkadunia khet") — those
  // belong in tags/hashtags, never in the viewer-facing description.
  description = stripHashtagNoise(description, hashtags, tags);
  // A description that is just the title again is not a description.
  if (description && title && description.trim() === title.trim()) description = '';

  const categoryId = /^\d+$/.test(String(raw.categoryId || '')) ? String(raw.categoryId) : undefined;

  if (fields) {
    // Partial update: at least one requested field must carry real content.
    const has =
      (wants('title') && !!title) ||
      (wants('description') && !!description) ||
      (wants('tags') && !!tags.length) ||
      (wants('hashtags') && !!hashtags.length) ||
      (wants('categoryId') && !!categoryId);
    if (!has) return null;
    return { ...raw, title, description, tags, hashtags, categoryId, fields };
  }

  // Full pack = card sirf tab jab SEO sach me READY ho.
  // Title AI commentary nikla ("maine title ko aakarshak banaya hai" /
  // "मैंने टाइटल को…") to sanitizeTitle khali laut'ta hai — us case me card
  // dikhana hi nahi hai, warna user ko adhura/galat SEO card milta hai.
  if (!title) return null;
  // Description + tags dono ready hone chahiye, warna card nahi.
  if (!description || !tags.length) return null;

  return { ...raw, title, description, tags, hashtags, categoryId, fields };
}

/**
 * Hashtags the AI actually wrote in the chat message (the "New SEO" part).
 * Only a real ready-made hashtag BLOCK counts (a line that is mostly hashtags)
 * — if the AI later mentions one or two "best" hashtags inside a sentence, that
 * must never replace the pack's hashtag list.
 */
function hashtagsFromText(text: string): string[] {
  const sec = newSeoSection(String(text || ''));
  const HASH_RE = /^#[\p{L}\p{N}\p{M}_]{2,40}$/u;
  const clusters: string[][] = [];
  let cur: string[] = [];
  for (const line of sec.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    const hashes = tokens.filter((tok) => HASH_RE.test(tok));
    if (tokens.length && hashes.length >= 2 && hashes.length / tokens.length >= 0.7) {
      cur.push(...hashes);
      continue;
    }
    if (cur.length) {
      clusters.push(cur);
      cur = [];
    }
  }
  if (cur.length) clusters.push(cur);
  if (clusters.length) return clusters.reduce((a, b) => (b.length > a.length ? b : a));
  return sec.match(/(?:^|[\s(])#[\p{L}\p{N}\p{M}_]{2,40}/gu)?.map((h) => h.trim()) || [];
}

const ALL_FIELDS: YtSeoField[] = ['title', 'description', 'tags', 'hashtags', 'categoryId'];

/**
 * Which fields is this block actually changing? An explicit `fields` array wins;
 * otherwise a block that simply omits (or empties) a field is treated as
 * "keep the current YouTube value" — so "sirf title badlo" changes only the title.
 */
function fieldsFromBlock(j: any): YtSeoField[] | undefined {
  if (Array.isArray(j?.fields) && j.fields.length) {
    const picked = j.fields
      .map((f: unknown) => String(f).trim().toLowerCase())
      .map((f: string) => (f === 'category' ? 'categoryId' : f === 'hashtag' ? 'hashtags' : f === 'tag' ? 'tags' : f))
      .filter((f: string): f is YtSeoField => (ALL_FIELDS as string[]).includes(f));
    if (picked.length) return Array.from(new Set(picked)) as YtSeoField[];
  }
  const present: YtSeoField[] = [];
  if (String(j?.title || '').trim()) present.push('title');
  if (String(j?.description || '').trim()) present.push('description');
  if (Array.isArray(j?.tags) && j.tags.length) present.push('tags');
  if (Array.isArray(j?.hashtags) && j.hashtags.length) present.push('hashtags');
  if (String(j?.categoryId || '').trim()) present.push('categoryId');
  // A full pack behaves exactly as before (no partial mode).
  const core: YtSeoField[] = ['title', 'description', 'tags'];
  return core.every((f) => present.includes(f)) ? undefined : present;
}

/** Reads the ```yt-update {...}``` block the AI adds after a YouTube SEO pack. */
export function extractYtUpdate(content: string): YtSeoUpdatePayload | null {

  const m = content?.match(BLOCK_RE);
  if (!m) return null;
  try {
    const j = JSON.parse(m[1].trim());
    const videoId = String(j.videoId || j.video_id || '').trim();
    if (!videoId) return null;
    const fields = fieldsFromBlock(j);
    const textHashtags = hashtagsFromText(stripYtUpdateBlock(content));
    return cleanPayload({
      videoId,
      title: String(j.title || ''),
      description: String(j.description || ''),
      tags: Array.isArray(j.tags) ? j.tags.map(String) : [],
      hashtags: Array.isArray(j.hashtags) && j.hashtags.length
        ? j.hashtags.map(String)
        : fields && !fields.includes('hashtags')
          ? []
          : textHashtags,

      categoryId: j.categoryId ? String(j.categoryId) : undefined,
      kind: j.kind === 'short' ? 'short' : 'long',
      label: j.label ? String(j.label) : undefined,
      fields,
    });
  } catch {
    return null;
  }
}

export function stripYtUpdateBlock(content: string): string {
  return (content || '')
    .replace(new RegExp(BLOCK_RE.source, 'gi'), '')
    .replace(/^[ \t]*`{0,3}[ \t]*yt[-_]?update[ \t]*`{0,3}[ \t]*:?[ \t]*$/gim, '')
    .replace(/`[ \t]*yt[-_]?update[ \t]*`/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Clean helper: strip markdown noise from a captured value */
const clean = (s: string) =>
  s
    .replace(/```[a-z-]*/gi, '')
    .replace(/[`*_>#]/g, '')
    .replace(/^\s*[-•–]\s*/gm, '')
    .trim();

/**
 * Finds a YouTube video id in free chat text: full url, "video id: xxx",
 * a backticked id, or an id in brackets like the list output "(gJNkesTxtag)".
 */
export function findVideoId(text: string): string {
  if (!text) return '';
  const m =
    text.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/) ||
    text.match(/\b(?:video\s*id|videoId|ID)\b\s*[:=]?\s*`?([A-Za-z0-9_-]{11})`?\b/i) ||
    text.match(/`([A-Za-z0-9_-]{11})`/) ||
    text.match(/[([]([A-Za-z0-9_-]{11})[)\]]/);
  return m?.[1] || '';
}

const SECTION_END = '(?=\\n\\s*(?:[*_`#]*\\s*)?(?:Title|Naya Title|Description|Detail|Tags|Hashtags|Changes|Category|Note|New SEO|Naya SEO|Current SEO|Purana SEO)\\b|$)';

/**
 * A SEO message often shows "Current SEO:" first and "New SEO Pack:" after it.
 * Only the new pack should be parsed, otherwise the card would offer to write
 * the video's existing (or empty) values back to YouTube.
 */
function newSeoSection(content: string): string {
  const m = content.match(/(?:^|\n)[^\n]{0,20}\b(?:New|Naya|Updated)\s+SEO\b[^\n]*\n([\s\S]+)$/i);
  return m ? m[1] : content;
}


/**
 * Fallback parser: AI sometimes writes the SEO pack as plain markdown
 * ("Title: ...", "Description: ...", "Tags: ...") and forgets the
 * ```yt-update``` block. We rebuild the update payload from that text so the
 * Update button still appears. Every captured value is sanitized before use.
 */
export function extractYtUpdateLoose(
  content: string,
  fallbackVideoId?: string,
): YtSeoUpdatePayload | null {
  if (!content) return null;
  // Try the "New SEO" section first; if that slice is too thin to parse
  // (AI skipped the header, or wrote everything in one block) retry on the
  // whole message so the update card NEVER goes missing.
  const section = newSeoSection(content);
  return (
    parseLooseSeo(section, content, fallbackVideoId) ||
    (section !== content ? parseLooseSeo(content, content, fallbackVideoId) : null)
  );
}

function parseLooseSeo(
  content: string,
  fullContent: string,
  fallbackVideoId?: string,
): YtSeoUpdatePayload | null {


  // Capture the WHOLE title section (it may contain a "Pehle:"/"Ab:" comparison);
  // sanitizeTitle then keeps only the new/final value.
  const titleM = content.match(
    new RegExp(`(?:^|\\n)[^\\n]{0,30}?\\b(?:Naya\\s+)?Title\\b[^\\n:]{0,20}:?\\s*\\n{0,2}([\\s\\S]{5,600}?)${SECTION_END}`, 'i'),
  );
  const title = titleM ? clean(titleM[1]) : '';
  if (!title) return null;



  const descM = content.match(
    new RegExp(`\\b(?:Description|Detail)\\b[^\\n:]{0,20}:?\\s*\\n{0,2}([\\s\\S]*?)${SECTION_END}`, 'i'),
  );
  const description = descM ? clean(descM[1]) : '';

  const tagsM = content.match(
    new RegExp(`\\b(?:YouTube\\s+)?Tags\\b[^\\n:]{0,20}:?\\s*\\n{0,2}([\\s\\S]*?)${SECTION_END}`, 'i'),
  );
  let tags: string[] = [];
  if (tagsM) {
    // Keep only the new ("Ab:") side of a before/after tag list.
    const raw = stripComparisonNoise(tagsM[1]);
    const ticked = [...raw.matchAll(/`([^`\n]{2,60})`/g)].map((m) => m[1].trim());
    tags = ticked.length ? ticked : clean(raw).split(/[,\n]/);
  }

  const hashM = content.match(
    new RegExp(`\\bHashtags\\b[^\\n:]{0,20}:?\\s*\\n{0,2}([\\s\\S]*?)${SECTION_END}`, 'i'),
  );
  let hashtags = hashM
    ? (stripComparisonNoise(hashM[1]).match(/#[\p{L}\p{N}\p{M}_]{2,}/gu) || [])
    : [];
  // No labelled "Hashtags:" section — take the hashtags the AI wrote inline
  // (usually one line under the description) so card === message.
  if (!hashtags.length) hashtags = hashtagsFromText(content);



  const catM =
    content.match(/\bCategory\b[^\n:]{0,20}:?\s*\n{0,2}[^\n]*?\bID:?\s*(\d{1,2})\b/i) ||
    content.match(/\bCategory\b[^\n:]{0,20}:?\s*\n{0,2}(\d{1,2})\b/i);
  let categoryId = catM?.[1];
  if (!categoryId) {
    const nameM = content.match(/\bCategory\b[^\n:]{0,20}:?\s*\n{0,2}([^\n(]{3,40})/i);
    const name = nameM?.[1]?.toLowerCase().trim();
    if (name) {
      const hit = Object.entries(YT_CATEGORY_NAMES).find(([, v]) => v.toLowerCase() === name);
      if (hit) categoryId = hit[0];
    }
  }

  const videoId = (findVideoId(fullContent) || fallbackVideoId || '').trim();
  if (!videoId) return null;


  return cleanPayload({
    videoId,
    title,
    description,
    tags,
    hashtags,
    categoryId,
    kind: 'long',
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 first:pt-0 last:pb-0 border-b border-red-100/70 last:border-b-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

const STRINGS = {
  hi: {
    videoSeo: 'वीडियो का नया SEO',
    shortSeo: 'Short का नया SEO',
    edit: 'एडिट',
    done: 'हो गया',
    title: 'टाइटल',
    description: 'डिस्क्रिप्शन',
    hashtags: 'हैशटैग',
    tags: 'यूट्यूब टैग',
    category: 'कैटेगरी',
    keepSame: '(जैसा है वैसा)',
    visibility: 'विज़िबिलिटी',
    audience: 'ऑडियंस',
    notKids: 'बच्चों के लिए नहीं',
    kids: 'बच्चों के लिए है',
    schedule: 'बेस्ट टाइम पर शेड्यूल करें',
    scheduleOff: 'शेड्यूल नहीं',
    scheduleOn: 'बेस्ट टाइम पर शेड्यूल करें',
    slotNote: 'सुझाया गया समय: शाम 7:30 बजे IST — इसी समय वीडियो अपने आप पब्लिक हो जाएगी।',
    newTag: 'नया टैग लिखें',
    add: 'जोड़ें',
    note: 'Update दबाते ही ये SEO (और विज़िबिलिटी/ऑडियंस) YouTube पर लाइव लग जाएगा। कुछ बदलना हो तो पहले "एडिट" दबाएँ।',
    saving: 'अपडेट हो रहा है...',
    retry: 'दोबारा कोशिश करें',
    update: 'अपडेट',
    updateSchedule: 'अपडेट + शेड्यूल',
    updated: 'YouTube पर अपडेट हो गया ✅',
    copyHint: 'टैप करके कॉपी करें',
    copied: 'कॉपी हो गया',
  },
  en: {
    videoSeo: "Video's new SEO",
    shortSeo: "Short's new SEO",
    edit: 'Edit',
    done: 'Done',
    title: 'Title',
    description: 'Description',
    hashtags: 'Hashtags',
    tags: 'YouTube tags',
    category: 'Category',
    keepSame: '(keep as is)',
    visibility: 'Visibility',
    audience: 'Audience',
    notKids: 'Not made for kids',
    kids: 'Made for kids',
    schedule: 'Schedule at the best time',
    scheduleOff: 'No schedule',
    scheduleOn: 'Schedule at the best time',
    slotNote: 'Suggested slot: 7:30 PM IST — the video goes public automatically at this time.',
    newTag: 'add a new tag',
    add: 'Add',
    note: 'This SEO (and visibility/audience) will be live on YouTube as soon as you press Update. If you want to change something, first press "Edit".',
    saving: 'Updating...',
    retry: 'Try again',
    update: 'Update',
    updateSchedule: 'Update + Schedule',
    updated: 'Updated on YouTube ✅',
    copyHint: 'Tap to copy',
    copied: 'Copied',
  },
} as const;


/** Best publishing slots for an Indian audience (IST). */
const SLOT_PRESETS = [
  { key: 'morning', label: 'Morning 8:00 AM', hour: 8, minute: 0 },
  { key: 'afternoon', label: 'Afternoon 1:00 PM', hour: 13, minute: 0 },
  { key: 'evening', label: 'Evening 7:30 PM', hour: 19, minute: 30 },
  { key: 'night', label: 'Night 9:30 PM', hour: 21, minute: 30 },
] as const;

/** Next occurrence of an IST hour:minute, returned in the device's local time. */
function slotAt(hour: number, minute: number): Date {
  const now = new Date();
  const shift = (330 + now.getTimezoneOffset()) * 60000;
  const istNow = new Date(now.getTime() + shift);
  const slot = new Date(istNow);
  slot.setHours(hour, minute, 0, 0);
  if (slot.getTime() <= istNow.getTime() + 15 * 60000) slot.setDate(slot.getDate() + 1);
  return new Date(slot.getTime() - shift);
}

/** Default: the soonest upcoming best slot. */
function suggestedSlot(): Date {
  return SLOT_PRESETS.map((s) => slotAt(s.hour, s.minute)).sort(
    (a, b) => a.getTime() - b.getTime(),
  )[0];
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** "2026-08-18T19:30" → parts for the 12-hour picker. */
const splitLocalInput = (v: string) => {
  const [date = '', time = '00:00'] = String(v || '').split('T');
  const [hStr = '0', mStr = '0'] = time.split(':');
  const h24 = Number(hStr) || 0;
  return {
    date,
    hour12: h24 % 12 === 0 ? 12 : h24 % 12,
    minute: Number(mStr) || 0,
    ampm: h24 < 12 ? 'AM' : 'PM',
  };
};

const joinLocalInput = (date: string, hour12: number, minute: number, ampm: string) => {
  const h24 = ampm === 'AM' ? (hour12 === 12 ? 0 : hour12) : hour12 === 12 ? 12 : hour12 + 12;
  return `${date}T${pad2(h24)}:${pad2(minute)}`;
};

/** "18/08/2026, 07:30 PM" — human readable 12-hour stamp. */
const prettyLocalInput = (v: string) => {
  const [date = '', time = ''] = String(v || '').split('T');
  const [y, mo, d] = date.split('-');
  const p = splitLocalInput(v);
  return time ? `${d}/${mo}/${y}, ${pad2(p.hour12)}:${pad2(p.minute)} ${p.ampm}` : '';
};

const inputCls =
  'w-full rounded-lg border border-red-200 bg-white px-2 py-1.5 text-[12px] text-gray-800 outline-none focus:border-red-400';

/** Remembers "this SEO pack was already pushed to YouTube" across reloads. */
const doneStoreKey = (id: string) => `yt-seo-done:${id}`;
const readDone = (id: string): string | null => {
  try {
    return localStorage.getItem(doneStoreKey(id));
  } catch {
    return null;
  }
};

export default function YouTubeSeoUpdateCard({
  data,
  cardId,
  onResult,
}: {
  data: YtSeoUpdatePayload;
  /** Stable per-message id — a NEW SEO pack gets a new id and shows a fresh card. */
  cardId?: string;
  onResult?: (message: string) => void;
}) {
  const persistId = cardId || `${data.videoId}:${data.title}`;
  // Partial update mode: only the listed fields change, the rest keep their
  // current YouTube value.
  const changedOnly = data.fields && data.fields.length ? data.fields : null;
  const keepField = changedOnly ? (f: YtSeoField) => !changedOnly.includes(f) : null;
  const savedNote = readDone(persistId);
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>(savedNote ? 'done' : 'idle');
  const [error, setError] = useState('');
  const [doneNote, setDoneNote] = useState(savedNote || '');
  const [editing, setEditing] = useState(false);


  // Editable SEO fields (pre-filled with the AI suggestion)
  const [title, setTitle] = useState(data.title);
  const [description, setDescription] = useState(data.description);
  const [hashtags, setHashtags] = useState<string[]>(data.hashtags || []);
  const [tags, setTags] = useState<string[]>(data.tags || []);
  const [categoryId, setCategoryId] = useState(data.categoryId || '');
  const [newTag, setNewTag] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Card chrome (labels, buttons, notes) is always English — only the SEO
  // content itself stays in the creator's language.
  const t = STRINGS.en;

  const copyChip = (value: string) => {
    try {
      void navigator.clipboard?.writeText(value);
    } catch {
      /* clipboard optional */
    }
    setCopied(value);
    setTimeout(() => setCopied((c) => (c === value ? null : c)), 1200);
  };


  // Live video status
  const [meta, setMeta] = useState<any>(null);
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'unlisted'>('public');
  const [madeForKids, setMadeForKids] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [publishAt, setPublishAt] = useState(toLocalInput(suggestedSlot()));

  useEffect(() => {
    if (state === 'done') return;
    let alive = true;
    (async () => {

      const { data: res } = await supabase.functions.invoke('unified-youtube-api', {
        body: { action: 'yt_video_meta', videoId: data.videoId },
      });
      if (!alive || !res?.success) return;
      const v = res.video || {};
      setMeta(v);
      setPrivacy((['public', 'private', 'unlisted'].includes(v.privacyStatus) ? v.privacyStatus : 'public') as any);
      setMadeForKids(!!v.madeForKids);
      if (!data.categoryId && v.categoryId) setCategoryId(String(v.categoryId));
      // Partial update ("sirf title badlo"): har wo field jo user ne nahi maanga
      // wo YouTube par jaisi hai waisi hi rahe — AI ka guess use nahi hoga.
      if (keepField) {
        if (keepField('title') && v.title) setTitle(String(v.title));
        if (keepField('description') && typeof v.description === 'string') {
          const cur = String(v.description);
          setDescription(cur);
          if (keepField('hashtags')) {
            setHashtags((cur.match(/#[\p{L}\p{N}\p{M}_]{2,40}/gu) || []).slice(0, 15));
          }
        }
        if (keepField('tags') && Array.isArray(v.tags)) setTags(v.tags.map(String));
        if (keepField('categoryId') && v.categoryId) setCategoryId(String(v.categoryId));
      }
      if (v.privacyStatus === 'private') {
        setSchedule(true);
        setPublishAt(toLocalInput(v.publishAt ? new Date(v.publishAt) : suggestedSlot()));
      }
    })();
    return () => {
      alive = false;
    };
  }, [data.videoId]);

  const addTag = () => {
    const t = newTag.trim().replace(/^#/, '');
    if (!t) return;
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) setTags([...tags, t]);
    setNewTag('');
  };

  const apply = async () => {
    if (state === 'saving') return; // double-click par duplicate request nahi
    setState('saving');
    setError('');

    try {
      const cur = meta || {};
      const built = buildYouTubePayload(
        { title, description, tags, hashtags, categoryId: categoryId || cur.categoryId },
        {
          current: {
            title: cur.title,
            description: cur.description,
            tags: cur.tags,
            categoryId: cur.categoryId,
          },
        },
      );
      if (!built.ok) throw new Error(built.errors[0] || 'SEO data invalid — kuch update nahi kiya.');

      // YouTube needs the schedule time comfortably in the future (whole minutes).
      const willSchedule =
        schedule && !!publishAt && new Date(publishAt).getTime() > Date.now() + 3 * 60000;
      if (schedule && !willSchedule) {
        throw new Error(
          'Schedule time abhi se kam se kam 3 minute aage rakhein (aage ka date/time chunein).',
        );
      }

      const { data: upRes, error: upErr } = await supabase.functions.invoke('unified-youtube-api', {
        body: {
          action: 'yt_video_update',
          videoId: data.videoId,
          patch: {
            title: built.payload.title,
            description: built.payload.description,
            tags: built.payload.tags,
            hashtags: built.payload.hashtags,
            categoryId: built.payload.categoryId,
            privacyStatus: willSchedule ? 'private' : privacy,
            publishAt: willSchedule ? new Date(publishAt).toISOString() : undefined,
            madeForKids,
            license: cur.license,
            embeddable: cur.embeddable,
            publicStatsViewable: cur.publicStatsViewable,
            defaultLanguage: cur.defaultLanguage,
          },
        },
      });
      if (upErr) throw upErr;
      if (!upRes?.success) throw new Error(upRes?.error || upRes?.errors?.[0] || 'Update failed');

      // Verify: YouTube se latest data dobara fetch karke confirm karo.
      let verified = false;
      try {
        const { data: chk } = await supabase.functions.invoke('unified-youtube-api', {
          body: { action: 'yt_video_meta', videoId: data.videoId },
        });
        const v = chk?.video;
        if (v) {
          setMeta(v);
          verified = String(v.title || '').trim() === built.payload.title.trim();
        }
      } catch {
        /* verification optional */
      }

      // Creator ki asli style seekhne ke liye AI suggestion vs final save karo.
      void recordSeoFeedback(
        data.videoId,
        {
          title: data.title,
          description: data.description,
          hashtags: data.hashtags || [],
          tags: data.tags || [],
        },
        {
          title: built.payload.title,
          description: built.payload.description,
          hashtags: built.payload.hashtags || [],
          tags: built.payload.tags || [],
          categoryId: built.payload.categoryId,
        },
      );

      const changed: string[] = Array.isArray(upRes.changed)
        ? upRes.changed
        : Array.isArray(upRes.willChange)
          ? upRes.willChange
          : [];
      const scheduleNote = willSchedule
        ? ` • Schedule: ${new Date(publishAt).toLocaleString('en-IN')}`
        : ` • Visibility: ${privacy}`;
      const note =
        (changed.length ? `Update fields: ${changed.join(', ')}` : 'Naya SEO YouTube par live lag gaya hai.') +
        scheduleNote +
        (verified ? ' • YouTube par verify ho gaya ✅' : '');
      setDoneNote(note);
      setState('done');
      try {
        localStorage.setItem(doneStoreKey(persistId), note);
      } catch {
        /* storage optional */
      }

      onResult?.(`✅ Update ho gaya! "${built.payload.title}" — ${note}`);
    } catch (e: any) {

      const msg = e?.message || 'Update failed';
      setError(msg);
      setState('error');
      onResult?.(`❌ Update nahi ho paya — ${msg}. Purana SEO safe hai, dobara "Update" dabao ya thodi der baad try karo.`);
    }
  };

  if (state === 'done') {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-3 py-3">
        <CheckCircle2 className="w-4 h-4 text-[#1da851] mt-0.5 shrink-0" />
        <div className="text-[12.5px] leading-relaxed text-[#075E54]">
          <p className="font-semibold">{t.updated}</p>
          <p className="opacity-80 mt-1">{doneNote}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50/60 p-3.5">
      <div className="flex items-center gap-2 mb-3">
        <Youtube className="w-4 h-4 text-red-600 shrink-0" />
        <p className="text-[13px] font-semibold text-gray-800 truncate flex-1">
          {data.label || (data.kind === 'short' ? t.shortSeo : t.videoSeo)}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing((v) => !v);
          }}
          className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-700"
        >
          <Pencil className="w-3 h-3" />
          {editing ? t.done : t.edit}
        </button>
      </div>

      <div className="mb-3 rounded-xl border border-red-100 bg-white/80 px-3 py-1">
        <Field label={`${t.title} (${title.length}/100)`}>
          {editing ? (
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
          ) : (
            <p className="text-[13px] font-medium leading-relaxed text-gray-900 break-words">{title}</p>
          )}
        </Field>

        <Field label={`${t.description} (${description.length}/5000)`}>
          {editing ? (
            <textarea
              className={`${inputCls} min-h-[140px] leading-relaxed`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
            />
          ) : (
            <p className="text-[12.5px] leading-[1.75] text-gray-700 whitespace-pre-wrap break-words">{description}</p>
          )}
        </Field>

        <Field label={t.hashtags}>
          {editing ? (
            <input
              className={inputCls}
              value={hashtags.join(' ')}
              onChange={(e) =>
                setHashtags(
                  e.target.value
                    .split(/[\s,]+/)
                    .map((h) => h.trim())
                    .filter(Boolean)
                    .map((h) => (h.startsWith('#') ? h : `#${h}`)),
                )
              }
            />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {hashtags.length ? (
                hashtags.map((h) => (
                  <button
                    key={h}
                    type="button"
                    title={copied === h ? t.copied : t.copyHint}
                    onClick={(e) => {
                      e.stopPropagation();
                      copyChip(h);
                    }}
                    className="rounded-full bg-[#1d7dfa]/10 px-2.5 py-1 text-[12px] font-semibold text-[#1d7dfa] border border-[#1d7dfa]/25 active:scale-95 transition-transform"
                  >
                    {copied === h ? `${h} ✓` : h}
                  </button>
                ))
              ) : (
                <span className="text-[12px] text-gray-400">—</span>
              )}
            </div>
          )}
        </Field>

        <Field label={`${t.tags} (${tags.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[12px] font-medium text-gray-700 border border-gray-200"
              >
                <button
                  type="button"
                  title={copied === tag ? t.copied : t.copyHint}
                  onClick={(e) => {
                    e.stopPropagation();
                    copyChip(tag);
                  }}
                  className="active:scale-95 transition-transform"
                >
                  {copied === tag ? `${tag} ✓` : tag}
                </button>
                {editing && (
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== tag))} className="text-gray-400 hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {editing && (
            <div className="mt-2 flex gap-1.5">
              <input
                className={inputCls}
                placeholder={t.newTag}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button type="button" onClick={addTag} className="rounded-lg border border-red-200 bg-white px-2.5 text-[11px] font-medium text-red-700">
                {t.add}
              </button>
            </div>
          )}
        </Field>

        <Field label={t.category}>
          {editing ? (
            <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t.keepSame}</option>
              {Object.entries(YT_CATEGORY_NAMES).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[12.5px] text-gray-800">
              {YT_CATEGORY_NAMES[categoryId] || (categoryId ? `Category ${categoryId}` : '—')}
            </p>
          )}
        </Field>
      </div>

      {/* Visibility (incl. Schedule) + Audience */}
      <div className="mb-3 rounded-xl border border-red-100 bg-white/80 p-3">
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-2 min-w-0">

            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t.visibility}</p>
            <select
              className={inputCls}
              value={schedule ? 'schedule' : privacy}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'schedule') {
                  setSchedule(true);
                } else {
                  setSchedule(false);
                  setPrivacy(v as any);
                }
              }}
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
              <option value="schedule">{t.scheduleOn}</option>
            </select>
          </div>
          <div className="col-span-3 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t.audience}</p>
            <select className={inputCls} value={madeForKids ? 'kids' : 'not'} onChange={(e) => setMadeForKids(e.target.value === 'kids')}>
              <option value="not">{t.notKids}</option>
              <option value="kids">{t.kids}</option>
            </select>
          </div>
        </div>

        {schedule && (
          <div className="mt-3 space-y-2 border-t border-red-100 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-gray-500" />
              {t.schedule}
            </p>
            {/* Pick a best slot (morning / afternoon / evening / night) */}
            <div className="flex flex-wrap gap-1.5">
              {SLOT_PRESETS.map((s) => {
                const val = toLocalInput(slotAt(s.hour, s.minute));
                const active = publishAt === val;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPublishAt(val);
                    }}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? 'border-red-500 bg-red-600 text-white'
                        : 'border-red-200 bg-white text-red-700'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* Date + 12-hour time with AM/PM */}
            <div className="grid grid-cols-8 gap-1.5">
              <input
                type="date"
                className={`${inputCls} col-span-3 px-1`}
                value={splitLocalInput(publishAt).date}
                min={toLocalInput(new Date()).slice(0, 10)}
                onChange={(e) => {
                  const p = splitLocalInput(publishAt);
                  setPublishAt(joinLocalInput(e.target.value, p.hour12, p.minute, p.ampm));
                }}
              />
              <select
                className={`${inputCls} col-span-3 px-1`}
                value={`${splitLocalInput(publishAt).hour12}:${pad2(splitLocalInput(publishAt).minute)}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(':').map(Number);
                  const p = splitLocalInput(publishAt);
                  setPublishAt(joinLocalInput(p.date, h, m, p.ampm));
                }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).flatMap((h) =>
                  [0, 15, 30, 45].map((m) => (
                    <option key={`${h}:${m}`} value={`${h}:${pad2(m)}`}>
                      {pad2(h)}:{pad2(m)}
                    </option>
                  )),
                )}
              </select>
              <select
                className={`${inputCls} col-span-2 px-1`}
                value={splitLocalInput(publishAt).ampm}
                onChange={(e) => {
                  const p = splitLocalInput(publishAt);
                  setPublishAt(joinLocalInput(p.date, p.hour12, p.minute, e.target.value));
                }}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>

            <p className="text-[11px] leading-relaxed text-gray-500">
              {prettyLocalInput(publishAt)} — the video goes public automatically at this time.
            </p>
          </div>
        )}
      </div>

      <p className="text-[12px] text-gray-600 leading-relaxed mb-3">{t.note}</p>
      {state === 'error' && (
        <div className="mb-3 flex items-start gap-1.5 text-[12px] text-red-600">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <button
        type="button"
        disabled={state === 'saving'}
        onClick={(e) => {
          e.stopPropagation();
          apply();
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-red-700 active:scale-95 disabled:opacity-50"
      >
        {state === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Youtube className="w-3.5 h-3.5" />}
        {state === 'saving' ? t.saving : state === 'error' ? t.retry : schedule ? t.updateSchedule : t.update}
      </button>
    </div>
  );
}

