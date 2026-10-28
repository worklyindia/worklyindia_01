import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Image as ImageIcon, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ImageCropDialog } from '@/components/brand/ImageCropDialog';
import YouTubeSeoAssistant, { type SeoApplyPayload } from '@/components/youtube/YouTubeSeoAssistant';
import {
  fetchVideoMeta, updateVideoMeta, YT_LANGUAGES, YT_TAG_MAX_COUNT, YT_TAG_MAX_TOTAL_CHARS,
  type YouTubeCategory, type YouTubeVideoMeta,
} from '@/hooks/useYouTubeGrowth';


const PRIVACY: Array<YouTubeVideoMeta['privacyStatus']> = ['public', 'unlisted', 'private'];

function isoToSeconds(iso: string) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-2.5">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      {children}
    </section>
  );
}

export default function YouTubeVideoEdit() {
  const { videoId = '' } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [categories, setCategories] = useState<YouTubeCategory[]>([]);
  const [meta, setMeta] = useState<YouTubeVideoMeta | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [thumb, setThumb] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchVideoMeta(videoId)
      .then((res) => {
        if (!alive) return;
        setMeta(res.video);
        setCategories(res.categories);
        setCanEdit(res.canEdit);
      })
      .catch((e) => alive && setError(e?.message || 'Could not load video details'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [videoId]);

  const isShort = useMemo(() => {
    const secs = isoToSeconds(meta?.duration || '');
    return secs > 0 && secs <= 180;
  }, [meta?.duration]);

  const thumbAspect = isShort ? 9 / 16 : 16 / 9;
  const thumbOutput = isShort ? { width: 1080, height: 1920 } : { width: 1280, height: 720 };

  const patch = <K extends keyof YouTubeVideoMeta>(key: K, value: YouTubeVideoMeta[K]) =>
    setMeta((m) => (m ? { ...m, [key]: value } : m));

  const tagChars = (meta?.tags || []).join(',').length;
  const tagsFull = !!meta && (meta.tags.length >= YT_TAG_MAX_COUNT || tagChars >= YT_TAG_MAX_TOTAL_CHARS);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').slice(0, 60);
    if (!t || !meta) return;
    if (meta.tags.includes(t)) { setTagInput(''); return; }
    if (meta.tags.length >= YT_TAG_MAX_COUNT) {
      toast.error(`Maximum ${YT_TAG_MAX_COUNT} tags allowed`);
      return;
    }
    if (tagChars + t.length + 1 > YT_TAG_MAX_TOTAL_CHARS) {
      toast.error(`Tags can total only ${YT_TAG_MAX_TOTAL_CHARS} characters`);
      return;
    }
    patch('tags', [...meta.tags, t]);
    setTagInput('');
  };
  const applySeo = (p: Partial<SeoApplyPayload>) =>
    setMeta((m) => {
      if (!m) return m;
      const next = { ...m };
      if (p.title !== undefined) next.title = p.title.slice(0, 100);
      if (p.description !== undefined) next.description = p.description.slice(0, 5000);
      if (p.tags !== undefined) next.tags = p.tags;
      if (p.categoryId !== undefined) next.categoryId = p.categoryId;
      return next;
    });


  const onThumbPick = (file?: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Thumbnail must be under 2MB'); return; }
    setCropFile(file);
    setCropOpen(true);
  };

  const onCropDone = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setThumb({ base64: result.split(',')[1] || '', mime: file.type || 'image/png', preview: result });
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!meta) return;
    if (!meta.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      await updateVideoMeta(videoId, {
        ...meta,
        ...(thumb ? { thumbnailBase64: thumb.base64, thumbnailMime: thumb.mime } : {}),
      });
      toast.success('Video updated on YouTube');
      navigate(`/ai-assistant/youtube/video/${videoId}`);
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Helmet>
        <title>{meta?.title ? `Edit: ${meta.title.slice(0, 40)}` : 'Edit video'} | YouTube Studio</title>
        <meta name="description" content="Edit your YouTube video title, description, tags, category, visibility and thumbnail." />
      </Helmet>

      <header className="sticky top-0 z-30 bg-[#0f0f0f] text-white px-2 py-2.5 flex items-center gap-2 shadow-md">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10 h-9 w-9" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold truncate">Edit video</h1>
          <p className="text-[11px] text-white/70 truncate">{meta?.title || videoId}</p>
        </div>
      </header>

      <main className="px-3 py-3 space-y-3 max-w-3xl mx-auto">
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-red-600" /></div>
        ) : error ? (
          <p className="text-[11px] text-rose-600">{error}</p>
        ) : meta ? (
          <>
            {!canEdit && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-700">
                Edit permission missing. Disconnect and reconnect your YouTube channel in settings to grant edit access.
              </p>
            )}

            <YouTubeSeoAssistant videoId={videoId} onApply={applySeo} />



            <Section title="Thumbnail">
              <div className="space-y-2">
                <div
                  className={`mx-auto overflow-hidden rounded-xl bg-muted ${isShort ? 'w-44 aspect-[9/16]' : 'w-full max-w-sm aspect-video'}`}
                >
                  <img
                    src={thumb?.preview || meta.thumbnail}
                    alt={meta.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="text-center text-[10px] text-muted-foreground">
                  {isShort ? 'Shorts: 1080×1920 (9:16)' : 'Video: 1280×720 (16:9)'} · JPG/PNG, under 2MB
                </p>
                <Button type="button" variant="outline" size="sm" className="w-full h-9 text-[11px]" onClick={() => fileRef.current?.click()}>
                  <ImageIcon className="h-3.5 w-3.5 mr-1" /> Change thumbnail
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => { onThumbPick(e.target.files?.[0]); e.target.value = ''; }}
                />
              </div>
            </Section>

            <Section title="Basics">
              <div className="space-y-1.5">
                <Label htmlFor="yt-title" className="text-[11px]">Title ({meta.title.length}/100)</Label>
                <Input
                  id="yt-title"
                  value={meta.title}
                  maxLength={100}
                  onChange={(e) => patch('title', e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="yt-desc" className="text-[11px]">Description ({meta.description.length}/5000)</Label>
                <Textarea
                  id="yt-desc"
                  value={meta.description}
                  maxLength={5000}
                  rows={8}
                  onChange={(e) => patch('description', e.target.value)}
                  className="text-xs resize-y"
                  placeholder="Add a description, hashtags (#Shorts), links…"
                />
              </div>
            </Section>

            <Section title={`Tags (${meta.tags.length}/${YT_TAG_MAX_COUNT} · ${tagChars}/${YT_TAG_MAX_TOTAL_CHARS} chars)`}>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  disabled={tagsFull}
                  maxLength={60}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                  placeholder={tagsFull ? 'Tag limit reached' : 'Type a tag and press Enter'}
                  className="text-xs"
                />
                <Button type="button" variant="outline" size="sm" className="h-9 text-[11px]" disabled={tagsFull} onClick={addTag}>Add</Button>
              </div>
              {tagsFull && (
                <p className="text-[10px] text-amber-600">YouTube limit reached — remove a tag to add another.</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {meta.tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium">
                    {t}
                    <button type="button" aria-label={`Remove ${t}`} onClick={() => patch('tags', meta.tags.filter((x) => x !== t))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </Section>

            <Section title="Category & language">
              <div className="space-y-1.5">
                <Label htmlFor="yt-cat" className="text-[11px]">Category</Label>
                <select
                  id="yt-cat"
                  value={meta.categoryId}
                  onChange={(e) => patch('categoryId', e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  {!categories.some((c) => c.id === meta.categoryId) && meta.categoryId && (
                    <option value={meta.categoryId}>Current ({meta.categoryId})</option>
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="yt-lang" className="text-[11px]">Video language</Label>
                <select
                  id="yt-lang"
                  value={meta.defaultLanguage || ''}
                  onChange={(e) => patch('defaultLanguage', e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {YT_LANGUAGES.map((l) => <option key={l.code || 'none'} value={l.code}>{l.label}</option>)}
                  {meta.defaultLanguage && !YT_LANGUAGES.some((l) => l.code === meta.defaultLanguage) && (
                    <option value={meta.defaultLanguage}>{meta.defaultLanguage}</option>
                  )}
                </select>
              </div>
            </Section>

            <Section title="Visibility & settings">
              <div className="grid grid-cols-3 gap-2">
                {PRIVACY.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => patch('privacyStatus', p)}
                    className={`rounded-lg border px-2 py-2 text-[11px] font-semibold capitalize transition-colors ${
                      meta.privacyStatus === p ? 'bg-red-600 text-white border-red-600' : 'bg-card text-muted-foreground border-border'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {[
                { key: 'madeForKids' as const, label: 'Made for kids' },
                { key: 'embeddable' as const, label: 'Allow embedding' },
                { key: 'publicStatsViewable' as const, label: 'Show view count publicly' },
              ].map((row) => (
                <div key={row.key} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                  <span className="text-[11px] font-medium text-foreground">{row.label}</span>
                  <Switch checked={!!meta[row.key]} onCheckedChange={(v) => patch(row.key, v)} />
                </div>
              ))}

              <div className="space-y-1.5">
                <Label htmlFor="yt-license" className="text-[11px]">License</Label>
                <select
                  id="yt-license"
                  value={meta.license}
                  onChange={(e) => patch('license', e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="youtube">Standard YouTube License</option>
                  <option value="creativeCommon">Creative Commons – Attribution</option>
                </select>
              </div>
            </Section>

            <Button onClick={save} disabled={saving || !canEdit} className="w-full bg-red-600 hover:bg-red-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save changes to YouTube
            </Button>
          </>
        ) : null}
      </main>

      <ImageCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        imageFile={cropFile}
        onCropComplete={onCropDone}
        aspectRatio={thumbAspect}
        outputSize={thumbOutput}
        title={isShort ? 'Crop Shorts thumbnail (9:16)' : 'Crop thumbnail (16:9)'}
      />
    </div>
  );
}
