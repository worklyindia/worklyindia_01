import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  subscribeActiveVideo,
  setActiveVideo,
  clearActiveVideo,
} from '@/lib/activeVideoPlayer';
import remarkGfm from 'remark-gfm';
// @ts-ignore
import remarkMath from 'remark-math';
import remarkEmoji from 'remark-emoji';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { CANONICAL_DOMAIN } from '@/config/domainConfig';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Allow safe HTML tags but strip dangerous ones
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] || []), 'style', 'className', 'class'],
    'span': [...(defaultSchema.attributes?.['span'] || []), 'style', 'className', 'class'],
    'div': [...(defaultSchema.attributes?.['div'] || []), 'style', 'className', 'class'],
    'p': [...(defaultSchema.attributes?.['p'] || []), 'style'],
    'ol': [...(defaultSchema.attributes?.['ol'] || []), 'type', 'start', 'reversed'],
    'li': [...(defaultSchema.attributes?.['li'] || []), 'value'],
    'font': ['color', 'size'],
    'code': ['className', 'class'],
    'math': ['className', 'class'],
    'iframe': ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'title', 'loading'],
    'img': [...(defaultSchema.attributes?.['img'] || []), 'loading', 'width', 'height'],
    'progress': ['value', 'max'],
    'meter': ['value', 'min', 'max', 'low', 'high', 'optimum'],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'span', 'div', 'font', 'center', 'mark', 'ins', 'sub', 'sup',
    'details', 'summary', 'kbd', 'abbr', 'ruby', 'rt', 'rp',
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub',
    'mfrac', 'mover', 'munder', 'msqrt', 'mtable', 'mtr', 'mtd',
    'section', 'article', 'aside', 'header', 'footer', 'figure', 'figcaption',
    'progress', 'meter', 'iframe',
  ],
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src || []), 'https'],
  },
};

/**
 * Image that never shows a broken icon.
 * Many Google Images / Facebook / news CDN results block hotlinking, which is
 * why search results rendered as a torn-paper icon in chat. On the first
 * failure we retry through an image proxy, and only if that also fails do we
 * fall back to a labelled placeholder card with a link to the source.
 */
const ResilientImage = ({ src, alt }: { src: string; alt: string }) => {
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  const proxied = React.useMemo(() => {
    try {
      const clean = src.replace(/^https?:\/\//i, '');
      return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&w=1024&output=jpg`;
    } catch {
      return src;
    }
  }, [src]);

  if (!src) return null;

  if (stage === 2) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="fmt-img-fallback">
        🖼️ {alt || 'Image'} — open original
      </a>
    );
  }

  return (
    <img
      src={stage === 0 ? src : proxied}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="fmt-img"
      onError={() => setStage((s) => (s === 0 ? 1 : 2))}
    />
  );
};


const CopyIcon = ({ done }: { done: boolean }) =>
  done ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
  );

/** Copy button for code blocks */
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy} className="fmt-copy-btn" title="Copy code" type="button">
      <CopyIcon done={copied} />
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
};

/** Small inline copy icon shown next to copyable values (video id, tags, links...) */
const InlineCopy = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy"
      aria-label="Copy"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="fmt-inline-copy"
    >
      <CopyIcon done={copied} />
    </button>
  );
};

/**
 * Detect a YouTube video/Short from a URL.
 * Returns the video id plus whether it should render in vertical (Shorts) format.
 */
export const parseYouTubeUrl = (
  href?: string,
): { id: string; isShort: boolean; start?: number } | null => {
  if (!href) return null;
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '').toLowerCase();
    const isYt = host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtube-nocookie.com';
    if (!isYt) return null;

    const path = u.pathname;
    let id = '';
    let isShort = false;

    if (host === 'youtu.be') {
      id = path.slice(1).split('/')[0];
    } else if (path.startsWith('/shorts/')) {
      id = path.split('/')[2] || '';
      isShort = true;
    } else if (path.startsWith('/embed/') || path.startsWith('/live/') || path.startsWith('/v/')) {
      id = path.split('/')[2] || '';
    } else if (path === '/watch') {
      id = u.searchParams.get('v') || '';
    }

    if (!/^[\w-]{11}$/.test(id)) return null;

    const tRaw = u.searchParams.get('t') || u.searchParams.get('start') || '';
    const tMatch = /^(?:(\d+)h)?(?:(\d+)m)?(\d+)?s?$/.exec(tRaw);
    let start: number | undefined;
    if (tRaw) {
      if (/^\d+$/.test(tRaw)) start = Number(tRaw);
      else if (tMatch) {
        start = (+(tMatch[1] || 0)) * 3600 + (+(tMatch[2] || 0)) * 60 + (+(tMatch[3] || 0));
      }
    }

    return { id, isShort, start: start || undefined };
  } catch {
    return null;
  }
};

/**
 * Availability cache so the same video is only verified once per session.
 * true = playable, false = deleted / private / not embeddable.
 */
const ytAvailability = new Map<string, boolean>();

/**
 * Verify a video really exists and is embeddable BEFORE we render a player or a
 * "Watch on YouTube" button. oEmbed returns 401/403/404 for deleted, private or
 * embedding-disabled videos, which is exactly the set that renders YouTube's
 * "Video unavailable" screen inside an iframe.
 */
const verifyYouTubeVideo = async (id: string): Promise<boolean> => {
  if (ytAvailability.has(id)) return ytAvailability.get(id)!;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${id}`,
      )}&format=json`,
    );
    const ok = res.ok;
    ytAvailability.set(id, ok);
    return ok;
  } catch {
    // Network/CORS hiccup — don't punish a possibly-good video, but don't cache.
    return true;
  }
};

/**
 * Inline YouTube player used inside chat messages.
 * Click-to-play: shows the thumbnail first (fast, no third-party iframe cost),
 * then swaps in the real player so videos AND Shorts play right inside the chat.
 * Span-based markup so it stays valid inside markdown paragraphs.
 */
const YouTubeEmbed = ({
  id,
  isShort,
  start,
  href,
}: { id: string; isShort: boolean; start?: number; href: string }) => {
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(
    ytAvailability.has(id) ? ytAvailability.get(id)! : null,
  );
  // Unique per mounted player so two cards with the same video stay independent
  const playerKey = useRef(`yt-${id}-${Math.random().toString(36).slice(2)}`).current;

  // Verify availability before showing anything clickable.
  useEffect(() => {
    let cancelled = false;
    if (available !== null) return;
    verifyYouTubeVideo(id).then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [id, available]);

  // Only one video may play at a time: if another player claims playback,
  // unmount this iframe so its audio stops immediately.
  useEffect(() => {
    const unsubscribe = subscribeActiveVideo((activeKey) => {
      if (activeKey !== playerKey) setPlaying(false);
    });
    return () => {
      unsubscribe();
      clearActiveVideo(playerKey);
    };
  }, [playerKey]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // Use youtube.com (not -nocookie): better embed compatibility, so Shorts and
  // normal videos both play right here without sending the user to YouTube.
  const src =
    `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=1` +
    (start ? `&start=${start}` : '') +
    (origin ? `&origin=${encodeURIComponent(origin)}&enablejsapi=1` : '');

  // Still verifying → light skeleton, never a broken player.
  if (available === null) {
    return (
      <span className={`fmt-yt-embed ${isShort ? 'fmt-yt-short' : 'fmt-yt-wide'}`}>
        <span className="fmt-yt-frame fmt-yt-checking" aria-busy="true" />
      </span>
    );
  }

  // Deleted / private / embedding-disabled → clean card, and NO watch link
  // (that link would only open YouTube's "video isn't available any more" page).
  if (available === false) {
    return (
      <span className="fmt-yt-unavailable">
        <span className="fmt-yt-unavailable-icon">🎬</span>
        <span className="fmt-yt-unavailable-text">Video preview unavailable</span>
      </span>
    );
  }

  return (
    <span className={`fmt-yt-embed ${isShort ? 'fmt-yt-short' : 'fmt-yt-wide'}`}>
      <span className="fmt-yt-frame">
        {playing ? (
          <iframe
            src={src}
            title="YouTube video player"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="fmt-yt-poster"
            aria-label="Play video"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveVideo(playerKey);
              setPlaying(true);
            }}
          >
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
              }}
            />
            <span className="fmt-yt-play">▶</span>
            {isShort && <span className="fmt-yt-badge">Shorts</span>}
          </button>
        )}
      </span>
      {!playing && (
        <a
          href={`https://www.youtube.com/watch?v=${id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="fmt-yt-open"
        >
          ▶️ Watch on YouTube ↗
        </a>
      )}
    </span>
  );
};


/** Smart contextual label for a URL: "Apply Now", "Watch on YouTube", etc. */
const getSmartLinkLabel = (href: string): { label: string; icon: string } => {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const path = u.pathname.toLowerCase();

    // Job / apply pages
    if (/\/(job|jobs|apply|apply-now|vacancy|opening|career|careers)s?(\/|$)/.test(path) ||
        (host.endsWith(CANONICAL_DOMAIN) && (path.startsWith('/job') || path.startsWith('/j/') || path.startsWith('/apply')))) {
      return { label: 'Apply Now', icon: '💼' };
    }

    // Social / video platforms
    if (host.includes('youtube.com') || host === 'youtu.be') return { label: 'Watch on YouTube', icon: '▶️' };
    if (host.includes('instagram.com')) return { label: 'Open Instagram', icon: '📸' };
    if (host.includes('facebook.com') || host === 'fb.com' || host === 'fb.me') return { label: 'Open Facebook', icon: '👥' };
    if (host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')) return { label: 'Open X (Twitter)', icon: '🐦' };
    if (host.includes('linkedin.com')) return { label: 'Open LinkedIn', icon: '💼' };
    if (host === 't.me' || host.includes('telegram.me') || host.includes('telegram.org')) return { label: 'Join on Telegram', icon: '✈️' };
    if (host === 'wa.me' || host.includes('whatsapp.com')) return { label: 'Chat on WhatsApp', icon: '💬' };
    if (host.includes('pinterest.')) return { label: 'Open Pinterest', icon: '📌' };
    if (host.includes('tiktok.com')) return { label: 'Open TikTok', icon: '🎵' };
    if (host.includes('github.com')) return { label: 'Open GitHub', icon: '💻' };
    if (host.includes('discord.com') || host === 'discord.gg') return { label: 'Join Discord', icon: '🎮' };
    if (host.includes('reddit.com')) return { label: 'Open Reddit', icon: '👽' };
    if (host.includes('medium.com')) return { label: 'Read on Medium', icon: '📖' };

    // App stores
    if (host.includes('play.google.com')) return { label: 'Get on Play Store', icon: '📱' };
    if (host.includes('apps.apple.com') || host.includes('itunes.apple.com')) return { label: 'Get on App Store', icon: '🍎' };

    // Meetings / maps
    if (host.includes('zoom.us')) return { label: 'Join Zoom', icon: '🎥' };
    if (host.includes('meet.google.com')) return { label: 'Join Google Meet', icon: '🎥' };
    if (host.includes('teams.microsoft.com')) return { label: 'Join Teams', icon: '🎥' };
    if (host.includes('maps.google.com') || host.includes('goo.gl/maps') || host.includes('maps.app.goo.gl')) return { label: 'Open in Maps', icon: '📍' };

    // Own website (Workly India)
    if (host.endsWith(CANONICAL_DOMAIN)) {
      if (path === '/' || path === '') return { label: 'Visit Workly India', icon: '🌐' };
      if (path.startsWith('/companies') || path.startsWith('/company') || path.startsWith('/c/')) return { label: 'View Company', icon: '🏢' };
      if (path.startsWith('/candidate') || path.startsWith('/u/') || path.startsWith('/profile')) return { label: 'View Profile', icon: '👤' };
      if (path.startsWith('/blog')) return { label: 'Read Article', icon: '📰' };
      if (path.startsWith('/resume') || path.startsWith('/resume-builder')) return { label: 'Build Resume', icon: '📝' };
      if (path.startsWith('/rewards') || path.startsWith('/referral')) return { label: 'Open Rewards', icon: '🎁' };
      return { label: 'Open on Workly India', icon: '🌐' };
    }

    // File types
    if (/\.pdf(\?|$)/.test(path)) return { label: 'View PDF', icon: '📄' };
    if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/.test(path)) return { label: 'View Image', icon: '🖼️' };
    if (/\.(mp4|mov|webm)(\?|$)/.test(path)) return { label: 'Play Video', icon: '🎬' };

    // Fallback: clean hostname
    return { label: host, icon: '🔗' };
  } catch {
    return { label: href, icon: '🔗' };
  }
};

/**
 * Full-featured AI message renderer
 * 
 * ═══ MARKDOWN ═══
 * **bold**, _italic_, ~~strikethrough~~
 * # H1, ## H2, ### H3, #### H4
 * - bullet list, 1. numbered list
 * - [x] task done, - [ ] task pending
 * > blockquote
 * `inline code`, ```language code block```
 * | table | support |
 * [link](url), ![image](url)
 * ---, ***, ___ → dividers
 * footnote[^1], [^1]: definition
 * 
 * ═══ MATH (LaTeX) ═══
 * $inline math$, $$block math$$
 * 
 * ═══ EMOJI SHORTCODES ═══
 * :smile: → 😄, :heart: → ❤️, :fire: → 🔥
 * 
 * ═══ EXTENDED ═══
 * ==highlight== → highlighted text
 * <mark>, <kbd>, <sub>, <sup>, <ins>
 * <center>, <font color="">, <abbr>
 * <details><summary> → collapsible
 * <ruby><rt> → annotations
 * 
 * ═══ CODE ═══
 * Syntax highlighting for 100+ languages
 * Copy button on code blocks
 * Language label on code blocks
 */

/**
 * Renumber ordered-list items so they continue 1, 2, 3... instead of
 * restarting at 1 for every block. Counter is kept per indent level and is
 * reset by headings, horizontal rules and fenced code blocks.
 */
export function renumberOrderedLists(src: string): string {
  return renumberOrderedListsImpl(src);
}

/**
 * True when a fenced block is really plain prose (Hindi/Hinglish sentences the
 * model wrapped in backticks by mistake) rather than actual code.
 */
function isProseNotCode(lang: string, body: string): boolean {
  const t = (body || '').trim();
  if (!t) return true;
  const known = /^(js|jsx|ts|tsx|json|html|css|scss|bash|sh|shell|python|py|java|sql|yaml|yml|xml|php|go|rust|c|cpp|csharp|ruby|kotlin|swift|diff|dockerfile|ini|toml|md|markdown)$/i;
  if (lang && known.test(lang)) return false;
  if (/[\u0900-\u097F]/.test(t)) return true; // Devanagari → prose
  const codeish = /[{};<>]|=>|\bfunction\b|\bconst\b|\bimport\b|\breturn\b|^\s*[\w."']+\s*[:=]\s/m.test(t);
  if (codeish) return false;
  const words = t.split(/\s+/).length;
  return words > 6; // long spaced sentence without code syntax → prose
}

function renumberOrderedListsImpl(src: string): string {
  const lines = src.split('\n');
  const counters = new Map<number, number>();
  let inFence = false;

  const resetAll = () => counters.clear();

  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      if (/^\s*(#{1,6}\s|(-{3,}|\*{3,}|_{3,})\s*$)/.test(line)) {
        resetAll();
        return line;
      }

      const m = line.match(/^(\s*)(\d+)([.)])(\s+)(.*)$/);
      if (!m) return line;

      const indent = Math.floor(m[1].replace(/\t/g, '  ').length / 2);
      // deeper levels restart when a shallower item appears
      for (const key of Array.from(counters.keys())) {
        if (key > indent) counters.delete(key);
      }
      const next = (counters.get(indent) || 0) + 1;
      counters.set(indent, next);
      return `${m[1]}${next}${m[3]}${m[4]}${m[5]}`;
    })
    .join('\n');
}

/** Hashtag matcher used for render-time blue coloring. */
const HASHTAG_RE = /(^|[\s(])(#[\p{L}\p{N}\p{M}_]{2,40})/gu;

/**
 * Colors #hashtags blue inside already-rendered markdown children.
 * Done on text nodes (never by injecting HTML) so markup can never leak into
 * the chat as visible text.
 */
function hashtagize(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child !== 'string' || !child.includes('#')) return child;
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    HASHTAG_RE.lastIndex = 0;
    while ((m = HASHTAG_RE.exec(child))) {
      const start = m.index + m[1].length;
      if (start > last) out.push(child.slice(last, start));
      out.push(
        <span className="fmt-hashtag" key={`${start}-${m[2]}`}>
          {m[2]}
        </span>,
      );
      last = start + m[2].length;
    }
    if (!out.length) return child;
    if (last < child.length) out.push(child.slice(last));
    return <>{out}</>;
  });
}

/** "YouTube Tags (12):", "Tags:", "Hashtags:" — a tag list label in chat text. */
const TAG_LABEL_RE =
  /^\s*(?:(?:current|new|naya|nayi|updated|purana)\s+)?(?:youtube\s+|seo\s+)?(tags|hashtags|keywords)\b[^:：]{0,30}[:：]\s*([\s\S]+)$/i;

const plainText = (children: React.ReactNode): string =>
  React.Children.toArray(children)
    .map((c: any) => (typeof c === 'string' ? c : typeof c?.props?.children === 'string' ? c.props.children : ''))
    .join('');

/**
 * Never split a comma that sits inside a number ("12,000") or between digits —
 * that used to chop "₹ 12,000 - 20,000 / monthly" into three chips.
 */
const splitTagList = (value: string): string[] =>
  value
    .split(/[\n•]+|,(?!\s*\d)|(?<!\d)\s*,/)
    .map((v) => (v ?? '').replace(/^[\s\-–—*`]+|[\s`]+$/g, '').trim())
    .filter((v) => v.length >= 2 && v.length <= 60);

/** Text that is really a value (money, number range, date) — never a tag list. */
const looksLikeValueNotTags = (text: string): boolean =>
  /\d[\d,]*\s*(?:-|–|to)\s*\d/.test(text) ||
  /[₹$€£]/.test(text) ||
  /\d,\d/.test(text) ||
  /\b(?:per|\/)\s*(?:month|monthly|year|yearly|day|hour|week)\b/i.test(text);

/**
 * Renders a chat "Tags:" / "Hashtags:" list as tappable badges (same look as the
 * YouTube SEO card) instead of a long comma separated line.
 * Only an explicit Tags / Hashtags / Keywords label qualifies — any other comma
 * separated text (salary, location, sentences) stays plain text.
 */
function tagBadges(children: React.ReactNode): React.ReactNode | null {
  const text = plainText(children);
  if (!text || text.length > 1200) return null;
  if (looksLikeValueNotTags(text)) return null;

  const m = text.match(TAG_LABEL_RE);
  if (!m) return null;
  const label = text.slice(0, text.length - m[2].length).trim();
  const body = m[2];


  const items = splitTagList(body);
  if (items.length < 2) return null;
  // Every item must look like a tag/hashtag, not a sentence.
  if (!items.every((it) => it.split(/\s+/).length <= 6 && !/[.!?।]/.test(it))) return null;

  return (
    <>
      {label && <span className="fmt-tag-label">{label}</span>}
      <span className="fmt-tag-badges">
        {items.map((it, i) => (
          <span
            key={`${i}-${it}`}
            className={`fmt-tag-badge${it.startsWith('#') ? ' fmt-tag-badge-hash' : ''}`}
          >
            {it}
          </span>
        ))}
      </span>
    </>
  );
}

/** Tag badges when the node is a tag list, otherwise normal hashtag coloring. */
function tagsOrHashtags(children: React.ReactNode): React.ReactNode {
  return tagBadges(children) ?? hashtagize(children);
}

const FormattedMessage = React.memo(function FormattedMessage({
  text,
  embedVideos = true,
}: { text: string; embedVideos?: boolean }) {
  if (!text) return null;

  // 🧼 Safety net: if any earlier pipeline (or the model itself) left literal
  // chip markup in the text, unwrap it back to plain text instead of showing
  // "<span class=...>" to the user.
  let processedText = text
    .replace(/<span[^>]*class="[^"]*fmt-tag-badge[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    .replace(/&lt;span[^&]*?fmt-tag-badge[\s\S]*?&gt;([\s\S]*?)&lt;\/span&gt;/gi, '$1');

  // Pre-process ==highlight== to <mark>
  processedText = processedText.replace(/==([^=]+)==/g, '<mark>$1</mark>');


  // 🧯 Unbalanced code fences: the model (or a cut-off stream) sometimes leaves
  // an opening ``` without a closing one, which swallows the rest of the reply
  // into an ugly dark code block. Close it so normal text stays normal text.
  const fenceCount = (processedText.match(/^\s*```/gm) || []).length;
  if (fenceCount % 2 === 1) processedText += '\n```';

  // 🧹 Prose accidentally wrapped in a fence (Hindi/Hinglish sentences, no code
  // syntax) → unwrap it and render as normal chat text.
  processedText = processedText.replace(
    /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g,
    (full, lang: string, body: string) => (isProseNotCode(lang, body) ? `\n${body.trim()}\n` : full),
  );

  // Normalize: split "**Label:** Value" into stacked lines for list items and blockquotes
  // This ensures label is on top and value is below, preventing side-by-side on mobile
  processedText = processedText.replace(
    /^(\s*(?:[-*]|\d+\.)\s+)\*\*([^*]+):\*\*\s+(.+)$/gm,
    '$1**$2:**\n$1$3'
  );
  processedText = processedText.replace(
    /^(>\s*(?:🔵|🟢|🟡|🔴|📌|💡|📊|🎯|✅|❌|⚡|🔥|📅|🎂|📍|💰|🏢|📧|📞|🎓|💼|👤|🕐|📝)?\s*)\*\*([^*]+):\*\*\s+(.+)$/gm,
    '$1**$2:**\n> $3'
  );

  // 🔢 Continuous numbering: the model often writes "1." for every item, and
  // blank lines / sub-bullets split them into separate <ol>s that all restart
  // at 1. Renumber ordered items per indent level so they read 1, 2, 3...
  processedText = renumberOrderedLists(processedText);

  // 🏷️ "Tags:" lines → each comma separated tag becomes a badge chip.
  const tagChips = (label: string, list: string) => {
    // Money / ranges / per-month values are never tag lists — keep them intact.
    if (looksLikeValueNotTags(list)) return null;
    const tags = list
      .split(/[\n•]+|[,،](?!\s*\d)|(?<!\d)\s*[,،]/)
      .map((t) => (t ?? '').trim())
      .filter((t) => t && t.length <= 60 && !/^\*\*/.test(t));
    if (tags.length < 2) return null;
    const chips = tags
      .map(
        (t) =>
          `<span class="fmt-tag-badge" role="button" tabindex="0" title="Tap to copy">${t.replace(/[<>]/g, '')}</span>`,
      )
      .join(' ');
    return `${label}\n\n<span class="fmt-tag-list">${chips}</span>`;
  };

  processedText = processedText.replace(
    /(\*\*[^*\n]{0,30}?Tags[^*\n:]{0,12}:?\*\*[ \t]*:?[ \t]*)([^\n]+)/gi,
    (full, label: string, list: string) => tagChips(label, list) ?? full,
  );

  // Same, but for a plain (non-bold) "Tags:" line the model often writes.
  processedText = processedText.replace(
    /^([ \t]*(?:YouTube[ \t]+)?Tags[^\n:]{0,12}:?\*{0,2}[ \t]*)([^\n]+)$/gim,
    (full, label: string, list: string) => tagChips(`**${label.trim().replace(/\*/g, '')}**`, list) ?? full,
  );

  // Label on its own line and the tag list on the next line.
  processedText = processedText.replace(
    /^([ \t]*(?:\*\*|__)?(?:YouTube[ \t]+)?Tags(?:[ \t]*\(\d+\))?:?(?:\*\*|__)?[ \t]*)\n+([^\n]+,[^\n]+)$/gim,
    (full, label: string, list: string) =>
      tagChips(`**${label.trim().replace(/[*_]/g, '').replace(/:?$/, ':')}**`, list) ?? full,
  );

  // ✨ Readability: a bold "**Label:**" that starts mid-line gets its own line,
  // so long SEO packs don't run together as one dense wall of text.
  processedText = processedText.replace(
    /(\S)[ \t]+(?<!YouTube[ \t])(\*\*[^*\n]{1,60}?:\*\*)/g,
    '$1\n\n$2',
  );

  // ✨ Same, but for "**Label**:" (colon outside the bold) — the model mixes both.
  processedText = processedText.replace(
    /(\S)[ \t]+(\*\*[^*\n]{1,60}?\*\*[ \t]*:)/g,
    '$1\n\n$2',
  );

  // ✨ SEO packs: known section labels always start a fresh block with a gap,
  // even when the model writes them as plain text mid-sentence.
  processedText = processedText.replace(
    /([^\n])[ \t]+(?<!YouTube[ \t])((?:\*\*|__)?(?:Naya\s+|New\s+|Current\s+|Purana\s+|Updated\s+)?(?:Title|Description|Detail|Hashtags|Hashtag|YouTube\s+Tags|Tags|Category|Changes|Note)(?:\s*\(\d+\/\d+\))?(?:\*\*|__)?\s*:)/g,
    '$1\n\n$2',
  );

  // 🔵 Hashtags are NOT injected as raw HTML anymore (that could leak as visible
  // markup). They are colored blue at render time in `hashtagize()` below.



  // Tag badge tap → copy that tag.
  const onBadgeCopy = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement)?.closest?.('.fmt-tag-badge') as HTMLElement | null;
    if (!el) return;
    e.stopPropagation();
    const value = (el.textContent || '').replace(/\s*✓$/, '').trim();
    if (!value) return;
    try {
      void navigator.clipboard?.writeText(value);
    } catch {
      /* clipboard optional */
    }
    el.classList.add('fmt-tag-copied');
    setTimeout(() => el.classList.remove('fmt-tag-copied'), 1200);
  };

  return (
    <div className="formatted-message" onClick={onBadgeCopy}>

      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, [remarkEmoji, { accessible: true }]]}
        rehypePlugins={[rehypeRaw, rehypeKatex, [rehypeSanitize, sanitizeSchema]]}
        components={{
          // Links → YouTube embeds or mini buttons
          a: ({ node, children, href, ...props }) => {
            const displayText = String(children);

            // Detect emails (mailto: links OR plain email-looking text)
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            const isMailto = href?.startsWith('mailto:');
            const isEmailText = emailRegex.test(displayText.trim());
            if (isMailto || isEmailText) {
              const email = isMailto ? href!.replace(/^mailto:/i, '') : displayText.trim();
              return (
                <a
                  href={`mailto:${email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="fmt-email-link"
                >
                  {email}
                </a>
              );
            }

            // Detect phone numbers (tel: links)
            if (href?.startsWith('tel:')) {
              const phone = href.replace(/^tel:/i, '');
              return (
                <a
                  href={`tel:${phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="fmt-email-link"
                >
                  {displayText || phone}
                </a>
              );
            }

            // Regular links → mini buttons
            // ▶️ YouTube videos & Shorts → inline player (plays inside the chat)
            const yt = embedVideos ? parseYouTubeUrl(href) : null;
            if (yt) {
              return (
                <YouTubeEmbed
                  id={yt.id}
                  isShort={yt.isShort}
                  start={yt.start}
                  href={href!}
                />
              );
            }

            const isRawUrl = !displayText || displayText === href || /^https?:\/\//i.test(displayText) || displayText === href?.replace(/^https?:\/\//, '');
            let label = displayText;
            let icon = '🔗';
            if (isRawUrl && href) {
              const smart = getSmartLinkLabel(href);
              label = smart.label;
              icon = smart.icon;
            }
            return (
              <a
                href={href}
                {...props}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="fmt-link-btn"
              >
                <span className="fmt-link-icon">{icon}</span>
                <span className="fmt-link-text">{label}</span>
                <span className="fmt-link-arrow">↗</span>
              </a>
            );
          },
          // Headings
          h1: ({ children }) => <div className="fmt-h1">{children}</div>,
          h2: ({ children }) => <div className="fmt-h2">{children}</div>,
          h3: ({ children }) => <div className="fmt-h3">{children}</div>,
          h4: ({ children }) => <div className="fmt-h4">{children}</div>,
          // Code with syntax highlighting
          code: ({ node, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const raw = children === undefined || children === null ? '' : String(children);
            const codeString = raw.replace(/\n$/, '');
            const trimmed = codeString.trim();

            // 🚨 Never render leaked internals: empty blocks, literal "undefined",
            // or hallucinated tool/python code the model wrote as a code block.
            const isJunk =
              !trimmed ||
              /^(undefined|null|nan)$/i.test(trimmed) ||
              /tool_code|default_api\.|^\s*print\s*\(/i.test(trimmed) ||
              /^\s*[a-z_][a-z0-9_]*\s*=\s*(?:search_youtube|get_youtube_[a-z_]+|search_jobs|web_search|tools?\.)/i.test(trimmed);
            if (isJunk) return null;

            if (match) {

              return (
                <div className="fmt-code-wrapper">
                  <div className="fmt-code-header">
                    <span className="fmt-code-lang">{match[1]}</span>
                    <CopyButton text={codeString} />
                  </div>
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: '0 0 8px 8px',
                      fontSize: '12px',
                      padding: '10px 12px',
                    }}
                    wrapLongLines
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              );
            }
            // Inline value (video id, tag, link, code...) → one-tap copy icon.
            // Long sentences wrapped in backticks by mistake render as plain
            // text so the chat stays clean and readable.
            const isSentence =
              trimmed.split(/\s+/).length > 6 || trimmed.length > 80 || /[\u0900-\u097F]/.test(trimmed);
            if (isSentence) return <>{children}</>;

            const copyable = trimmed.length >= 4 && !/\s{2,}/.test(trimmed);
            return (
              <span className="fmt-inline-code-wrap">
                <code className="fmt-inline-code" {...props}>{children}</code>
                {copyable && <InlineCopy text={trimmed} />}
              </span>
            );
          },
          pre: ({ children }) => <>{children}</>,
          // Blockquote
          blockquote: ({ children }) => (
            <div className="fmt-blockquote">{children}</div>
          ),
          // Lists
          ul: ({ children, className }) => {
            const isTaskList = className?.includes('contains-task-list');
            return <ul className={isTaskList ? 'fmt-task-list' : 'fmt-bullet-list'}>{children}</ul>;
          },
          ol: ({ children, ...props }) => {
            const type = (props as any).type;
            let className = 'fmt-numbered-list';
            if (type === 'a') className = 'fmt-alpha-lower-list';
            else if (type === 'A') className = 'fmt-alpha-upper-list';
            else if (type === 'i') className = 'fmt-roman-lower-list';
            else if (type === 'I') className = 'fmt-roman-upper-list';
            const start = Number((props as any).start) || 1;
            return (
              <ol
                className={className}
                {...(start > 1 ? { start } : {})}
                style={{ counterReset: `fmt-counter ${start - 1}` }}
              >
                {children}
              </ol>
            );
          },
          li: ({ children, className, ...props }) => {
            const isTask = className?.includes('task-list-item');
            const childArray = React.Children.toArray(children).filter(
              (c: any) => !(typeof c === 'string' && c.trim() === '')
            );

            // Detect "wrapper" li whose content is ONLY a nested list (ul/ol).
            // In that case, render the nested list directly without the number badge,
            // and signal CSS to skip counter-increment.
            const isNestedListOnly =
              childArray.length > 0 &&
              childArray.every((child: any) => {
                const t = child?.type;
                const tag = child?.props?.node?.tagName;
                const cls = child?.props?.className || '';
                return (
                  t === 'ul' || t === 'ol' ||
                  tag === 'ul' || tag === 'ol' ||
                  /fmt-(bullet|numbered|alpha|roman|task)-list/.test(cls)
                );
              });

            if (isNestedListOnly) {
              return (
                <li className="fmt-li-nested-only" {...props}>
                  {children}
                </li>
              );
            }

            const hasBold = childArray.some((child: any) => {
              if (!child) return false;
              if (child?.type === 'strong' || child?.props?.className === 'fmt-bold') return true;
              if (child?.props?.children) {
                const inner = React.Children.toArray(child.props.children);
                return inner.some((c: any) => c?.type === 'strong' || c?.props?.className === 'fmt-bold');
              }
              return false;
            });
            const liClass = isTask ? 'fmt-task-item' : hasBold ? 'fmt-li-header' : 'fmt-li-answer';
            return (
              <li className={liClass} {...props}>
                <div className="fmt-li-content">{tagsOrHashtags(children)}</div>
              </li>
            );
          },
          // Task checkboxes
          input: ({ type, checked, ...props }) => {
            if (type === 'checkbox') {
              return <span className={`fmt-checkbox ${checked ? 'fmt-checked' : ''}`}>
                {checked ? '✅' : '⬜'}
              </span>;
            }
            return <input type={type} {...props} />;
          },
          // Table
          table: ({ children }) => (
            <div className="fmt-table-wrapper">
              <table className="fmt-table">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="fmt-th">{hashtagize(children)}</th>,
          td: ({ children }) => <td className="fmt-td">{hashtagize(children)}</td>,
          // Formatting
          hr: () => <hr className="fmt-divider" />,
          strong: ({ children }) => <strong className="fmt-bold">{hashtagize(children)}</strong>,
          em: ({ children }) => <em className="fmt-italic">{children}</em>,
          del: ({ children }) => <del className="fmt-strike">{children}</del>,
          p: ({ children }) => <p className="fmt-p">{tagsOrHashtags(children)}</p>,

          img: ({ src, alt }) => <ResilientImage src={String(src || '')} alt={alt || ''} />,

          // HTML elements
          mark: ({ children }) => <mark className="fmt-highlight">{children}</mark>,
          kbd: ({ children }) => <kbd className="fmt-kbd">{children}</kbd>,
          sub: ({ children }) => <sub>{children}</sub>,
          sup: ({ children }) => <sup>{children}</sup>,
          ins: ({ children }) => <ins className="fmt-underline">{children}</ins>,
          details: ({ children }) => <details className="fmt-details">{children}</details>,
          summary: ({ children }) => <summary className="fmt-summary">{children}</summary>,
          center: ({ children }) => <div className="fmt-center">{children}</div>,
          abbr: ({ children, ...props }) => <abbr className="fmt-abbr" {...props}>{children}</abbr>,
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
});

FormattedMessage.displayName = 'FormattedMessage';

export const renderFormattedMessage = (
  text: string,
  opts?: { embedVideos?: boolean },
): React.ReactNode => (
  <FormattedMessage text={text} embedVideos={opts?.embedVideos !== false} />
);

/** Legacy export */
export const renderTextWithLinks = (
  text: string,
  opts?: { embedVideos?: boolean },
): React.ReactNode => {
  return renderFormattedMessage(text, opts);
};
