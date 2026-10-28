import { useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, Loader2, Sparkles, Wand2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchSeoPack, YT_TAG_MAX_COUNT, YT_TAG_MAX_TOTAL_CHARS, YT_TITLE_IDEAL, YT_TITLE_MAX,
  type YTSeoPack,
} from '@/hooks/useYouTubeGrowth';

export interface SeoApplyPayload {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
}

interface Props {
  /** Existing video — the assistant reads live metadata from YouTube. */
  videoId?: string;
  /** New upload draft — what the user has typed so far. */
  draft?: {
    title?: string; description?: string; tags?: string[];
    categoryId?: string; defaultLanguage?: string; isShort?: boolean;
  };
  onApply: (patch: Partial<SeoApplyPayload>) => void;
}

const LEVEL_ICON = {
  error: <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-px" />,
  warn: <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-px" />,
  ok: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-px" />,
};

function scoreTone(score: number) {
  if (score >= 80) return 'bg-emerald-600';
  if (score >= 55) return 'bg-amber-500';
  return 'bg-rose-600';
}

export default function YouTubeSeoAssistant({ videoId, draft, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState<YTSeoPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState('');
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  const run = async () => {
    setLoading(true);
    setError(null);
    setApplied({});
    try {
      const res = await fetchSeoPack({ videoId, brief: brief.trim() || undefined, draft });
      setPack(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'SEO analysis failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const mark = (key: string) => setApplied((a) => ({ ...a, [key]: true }));

  const applyAll = () => {
    if (!pack) return;
    if (pack.suggestion.valid === false) {
      toast.error(pack.internal?.validationErrors?.[0] || 'SEO data is not valid — nothing applied.');
      return;
    }
    onApply({
      title: pack.suggestion.title,
      description: pack.suggestion.description,
      tags: pack.suggestion.tags,
      categoryId: pack.suggestion.categoryId,
    });
    setApplied({ title: true, description: true, tags: true, category: true });
    toast.success('SEO pack applied — review, then save to YouTube');
  };

  const s = pack?.suggestion;
  const cur = pack?.current;

  return (
    <section className="rounded-xl border border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-red-600 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">AI SEO Master</p>
          <p className="text-[10px] text-muted-foreground">
            Checks your current title, description, tags, hashtags and category against YouTube's own limits, then rebuilds them — channel name included so name-search finds this {draft?.isShort || pack?.kind === 'short' ? 'Short' : 'video'}.
          </p>
        </div>
      </div>

      <Textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={2}
        maxLength={800}
        placeholder="Optional: what is this video about? (topic, keywords, target audience)"
        className="text-xs resize-y bg-background"
      />

      <Button type="button" onClick={run} disabled={loading} className="w-full h-9 bg-red-600 hover:bg-red-700 text-white text-[11px]">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
        {pack ? 'Re-analyse & regenerate' : 'Analyse & generate SEO pack'}
      </Button>

      {error && <p className="text-[11px] text-rose-600">{error}</p>}

      {pack && s && cur && (
        <div className="space-y-3">
          {/* Validation problems — nothing is applied while these exist */}
          {(pack.internal?.validationErrors?.length || pack.internal?.removedTags?.length) ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-2.5 space-y-1">
              {pack.internal.validationErrors?.map((m, i) => (
                <p key={i} className="text-[10px] text-rose-700 dark:text-rose-300">{m}</p>
              ))}
              {pack.internal.removedTags?.length ? (
                <p className="text-[10px] text-amber-800 dark:text-amber-200">
                  Invalid tags removed: {pack.internal.removedTags.join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Score */}
          <div className="rounded-lg border border-border bg-background p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold">Current SEO score</span>
              <span className="text-[11px] font-bold">{pack.score}/100</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full ${scoreTone(pack.score)}`} style={{ width: `${pack.score}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{pack.internal?.summary}</p>
            {!pack.aiPowered && (
              <p className="text-[10px] text-amber-600">AI writer unavailable right now — rule-based optimisation was used.</p>
            )}
          </div>

          {/* What is set right now */}
          <details className="rounded-lg border border-border bg-background p-2.5" open>
            <summary className="text-[11px] font-semibold cursor-pointer">
              What is set on YouTube right now
            </summary>
            <div className="mt-2 space-y-1.5 text-[10px] text-muted-foreground">
              <p><span className="font-semibold text-foreground">Title ({cur.title.length}/{YT_TITLE_MAX}):</span> {cur.title || '—'}</p>
              <p><span className="font-semibold text-foreground">Description ({cur.description.length}/5000):</span> {cur.description ? `${cur.description.slice(0, 300)}${cur.description.length > 300 ? '…' : ''}` : '—'}</p>
              <p><span className="font-semibold text-foreground">Tags ({cur.tags.length}/{YT_TAG_MAX_COUNT} · {cur.tagChars}/{YT_TAG_MAX_TOTAL_CHARS} chars):</span> {cur.tags.join(', ') || '—'}</p>
              <p><span className="font-semibold text-foreground">Hashtags ({cur.hashtags.length}):</span> {cur.hashtags.join(' ') || '—'}</p>
              <p><span className="font-semibold text-foreground">Category:</span> {cur.categoryTitle || 'Not set'}</p>
              <p><span className="font-semibold text-foreground">Type:</span> {pack.kind === 'short' ? 'Short' : 'Long-form video'} · <span className="font-semibold text-foreground">Language:</span> {cur.defaultLanguage || 'Not set'}</p>
            </div>
          </details>

          {/* Category verdict */}
          <div className={`rounded-lg border p-2.5 text-[11px] ${
            pack.categoryMismatch || pack.channelCategoryMismatch
              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200'
          }`}>
            <p className="font-semibold">
              {pack.categoryMismatch || pack.channelCategoryMismatch ? 'Category needs a change' : 'Category looks correct'}
            </p>
            <p className="mt-0.5 text-[10px]">
              Current: {cur.categoryTitle || 'Not set'} → Recommended: {s.categoryTitle}. {pack.internal?.categoryReason}
              {pack.channel.primaryCategoryTitle ? ` Your channel mostly publishes in "${pack.channel.primaryCategoryTitle}".` : ''}
            </p>
            {(pack.categoryMismatch || !cur.categoryId) && (
              <Button
                type="button" variant="outline" size="sm"
                className="mt-2 h-7 text-[10px]"
                onClick={() => { onApply({ categoryId: s.categoryId }); mark('category'); }}
              >
                {applied.category ? <Check className="h-3 w-3 mr-1" /> : null} Use {s.categoryTitle}
              </Button>
            )}
          </div>

          {/* Checks */}
          <div className="rounded-lg border border-border bg-background p-2.5 space-y-1.5">
            <p className="text-[11px] font-semibold">Checks ({pack.checks.filter((c) => c.level !== 'ok').length} to fix)</p>
            <ul className="space-y-1">
              {pack.checks.map((c, i) => (
                <li key={i} className="flex gap-1.5 text-[10px] text-muted-foreground">
                  {LEVEL_ICON[c.level]}<span>{c.message}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Suggested title */}
          <div className="rounded-lg border border-border bg-background p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold">Suggested title ({s.title.length}/{YT_TITLE_MAX})</p>
              <span className={`text-[10px] ${s.title.length <= YT_TITLE_IDEAL ? 'text-emerald-600' : 'text-amber-600'}`}>
                {s.title.length <= YT_TITLE_IDEAL ? 'search-safe length' : `over ${YT_TITLE_IDEAL} chars`}
              </span>
            </div>
            <p className="text-[11px] font-medium text-foreground">{s.title}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { onApply({ title: s.title }); mark('title'); }}>
                {applied.title ? <Check className="h-3 w-3 mr-1" /> : null} Use title
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { navigator.clipboard.writeText(s.title); toast.success('Title copied'); }}>
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
            </div>
            {s.titleAlternatives.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-[10px] font-semibold text-muted-foreground">Alternatives</p>
                {s.titleAlternatives.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { onApply({ title: t }); mark('title'); }}
                    className="block w-full text-left text-[10px] rounded-md border border-border px-2 py-1 hover:bg-muted"
                  >
                    {t} <span className="text-muted-foreground">({t.length})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Suggested description */}
          <div className="rounded-lg border border-border bg-background p-2.5 space-y-2">
            <p className="text-[11px] font-semibold">Suggested description ({s.description.length}/5000)</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground">{s.description}</pre>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { onApply({ description: s.description }); mark('description'); }}>
                {applied.description ? <Check className="h-3 w-3 mr-1" /> : null} Use description
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { navigator.clipboard.writeText(s.description); toast.success('Description copied'); }}>
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
            </div>
          </div>

          {/* Hashtags */}
          <div className="rounded-lg border border-border bg-background p-2.5 space-y-1.5">
            <p className="text-[11px] font-semibold">Hashtags ({s.hashtags.length} · only first 3 show on YouTube)</p>
            <p className="text-[10px] text-muted-foreground break-words">{s.hashtags.join(' ') || '—'}</p>
          </div>

          {/* Tags */}
          <div className="rounded-lg border border-border bg-background p-2.5 space-y-2">
            <p className="text-[11px] font-semibold">
              Suggested tags ({s.tags.length}/{YT_TAG_MAX_COUNT} · {s.tagChars}/{YT_TAG_MAX_TOTAL_CHARS} chars)
            </p>
            <div className="flex flex-wrap gap-1">
              {s.tags.map((t) => (
                <span key={t} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px]">{t}</span>
              ))}
            </div>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { onApply({ tags: s.tags }); mark('tags'); }}>
              {applied.tags ? <Check className="h-3 w-3 mr-1" /> : null} Use tags
            </Button>
          </div>

          <Button type="button" onClick={applyAll} className="w-full h-9 bg-foreground text-background hover:bg-foreground/90 text-[11px]">
            Apply everything to the form
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Nothing is sent to YouTube until you press save. Deleting videos is never done by AI.
          </p>
        </div>
      )}
    </section>
  );
}
