import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Film, Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ImageCropDialog } from '@/components/brand/ImageCropDialog';
import YouTubeSeoAssistant, { type SeoApplyPayload } from '@/components/youtube/YouTubeSeoAssistant';
import {
  fetchUploadCategories, startResumableUpload, uploadVideoFile, uploadThumbnailForVideo,
  YT_LANGUAGES, YT_TAG_MAX_COUNT, YT_TAG_MAX_TOTAL_CHARS,
  type YouTubeCategory, type YouTubeUploadMeta,
} from '@/hooks/useYouTubeGrowth';


const PRIVACY: Array<YouTubeUploadMeta['privacyStatus']> = ['public', 'unlisted', 'private'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-2.5">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      {children}
    </section>
  );
}

export default function YouTubeUpload() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<YouTubeCategory[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [kind, setKind] = useState<'video' | 'short'>('video');
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [thumb, setThumb] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [schedule, setSchedule] = useState('');

  const [meta, setMeta] = useState<YouTubeUploadMeta>({
    title: '',
    description: '',
    tags: [],
    categoryId: '22',
    defaultLanguage: 'hi',
    privacyStatus: 'public',
    madeForKids: false,
    embeddable: true,
    publicStatsViewable: true,
    license: 'youtube',
  });

  useEffect(() => {
    fetchUploadCategories()
      .then((r) => { setCategories(r.categories); setCanEdit(r.canEdit); })
      .catch((e) => toast.error(e?.message || 'Could not load categories'));
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const patch = <K extends keyof YouTubeUploadMeta>(key: K, value: YouTubeUploadMeta[K]) =>
    setMeta((m) => ({ ...m, [key]: value }));

  const tagChars = meta.tags.join(',').length;
  const tagsFull = meta.tags.length >= YT_TAG_MAX_COUNT || tagChars >= YT_TAG_MAX_TOTAL_CHARS;

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').slice(0, 60);
    if (!t) return;
    if (meta.tags.includes(t)) { setTagInput(''); return; }
    if (meta.tags.length >= YT_TAG_MAX_COUNT) { toast.error(`Maximum ${YT_TAG_MAX_COUNT} tags allowed`); return; }
    if (tagChars + t.length + 1 > YT_TAG_MAX_TOTAL_CHARS) { toast.error(`Tags can total only ${YT_TAG_MAX_TOTAL_CHARS} characters`); return; }
    patch('tags', [...meta.tags, t]);
    setTagInput('');
  };

  const applySeo = (p: Partial<SeoApplyPayload>) =>
    setMeta((m) => ({
      ...m,
      ...(p.title !== undefined ? { title: p.title.slice(0, 100) } : {}),
      ...(p.description !== undefined ? { description: p.description.slice(0, 5000) } : {}),
      ...(p.tags !== undefined ? { tags: p.tags } : {}),
      ...(p.categoryId !== undefined ? { categoryId: p.categoryId } : {}),
    }));


  const onFilePick = (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) { toast.error('Please choose a video file'); return; }
    if (preview) URL.revokeObjectURL(preview);
    const url = URL.createObjectURL(f);
    setFile(f);
    setPreview(url);
    if (!meta.title) patch('title', f.name.replace(/\.[^.]+$/, '').slice(0, 100));
    // Detect Short from duration + orientation
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const portrait = el.videoHeight >= el.videoWidth;
      setKind(el.duration <= 180 && portrait ? 'short' : 'video');
    };
    el.src = url;
  };

  const thumbAspect = kind === 'short' ? 9 / 16 : 16 / 9;
  const thumbOutput = kind === 'short' ? { width: 1080, height: 1920 } : { width: 1280, height: 720 };

  const onThumbPick = (f?: File | null) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error('Thumbnail must be under 2MB'); return; }
    setCropFile(f);
    setCropOpen(true);
  };

  const onCropDone = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setThumb({ base64: result.split(',')[1] || '', mime: f.type || 'image/png', preview: result });
    };
    reader.readAsDataURL(f);
  };

  const canSubmit = useMemo(() => !!file && !!meta.title.trim() && !uploading && canEdit, [file, meta.title, uploading, canEdit]);

  const submit = async () => {
    if (!file) { toast.error('Choose a video file first'); return; }
    if (!meta.title.trim()) { toast.error('Title is required'); return; }
    setUploading(true);
    setProgress(0);
    try {
      const payload: YouTubeUploadMeta = {
        ...meta,
        description: kind === 'short' && !/#shorts/i.test(meta.description)
          ? `${meta.description}\n\n#Shorts`.trim()
          : meta.description,
        ...(schedule ? { publishAt: new Date(schedule).toISOString() } : {}),
      };
      const uploadUrl = await startResumableUpload(file, payload);
      const { id } = await uploadVideoFile(uploadUrl, file, setProgress);
      if (thumb && id) {
        try { await uploadThumbnailForVideo(id, thumb.base64, thumb.mime); }
        catch { toast.warning('Video uploaded, but thumbnail failed'); }
      }
      toast.success('Uploaded to YouTube 🎉');
      if (id) navigate(`/ai-assistant/youtube/video/${id}`);
      else navigate('/ai-assistant');
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Helmet>
        <title>Upload video to YouTube | Studio</title>
        <meta name="description" content="Upload videos and Shorts to your YouTube channel with title, description, tags, thumbnail and visibility settings." />
      </Helmet>

      <header className="sticky top-0 z-30 bg-[#0f0f0f] text-white px-2 py-2.5 flex items-center gap-2 shadow-md">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10 h-9 w-9" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold truncate">Upload to YouTube</h1>
          <p className="text-[11px] text-white/70 truncate">{file ? file.name : 'Video or Short'}</p>
        </div>
      </header>

      <main className="px-3 py-3 space-y-3 max-w-3xl mx-auto">
        {!canEdit && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-700">
            Upload permission missing. Disconnect and reconnect your YouTube channel in settings to grant upload access.
          </p>
        )}

        <Section title="Video file">
          {preview ? (
            <div className="space-y-2">
              <div className={`mx-auto overflow-hidden rounded-xl bg-black ${kind === 'short' ? 'w-52 aspect-[9/16]' : 'w-full max-w-sm aspect-video'}`}>
                <video src={preview} controls playsInline className="h-full w-full object-contain" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['video', 'short'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                      kind === k ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {k === 'video' ? 'Video (16:9)' : 'Short (9:16)'}
                  </button>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full h-9 text-[11px]" onClick={() => videoRef.current?.click()}>
                Change file
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => videoRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-border py-10 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/40"
            >
              <Film className="h-7 w-7" />
              <span className="text-xs font-semibold">Choose a video or Short</span>
              <span className="text-[10px]">MP4/MOV · Shorts must be under 3 min & vertical</span>
            </button>
          )}
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => { onFilePick(e.target.files?.[0]); e.target.value = ''; }}
          />
        </Section>

        <Section title="Thumbnail (optional)">
          <div className="space-y-2">
            {thumb && (
              <div className={`mx-auto overflow-hidden rounded-xl bg-muted ${kind === 'short' ? 'w-44 aspect-[9/16]' : 'w-full max-w-sm aspect-video'}`}>
                <img src={thumb.preview} alt="Thumbnail preview" className="h-full w-full object-cover" />
              </div>
            )}
            <p className="text-center text-[10px] text-muted-foreground">
              {kind === 'short' ? 'Shorts: 1080×1920 (9:16)' : 'Video: 1280×720 (16:9)'} · JPG/PNG, under 2MB
            </p>
            <Button type="button" variant="outline" size="sm" className="w-full h-9 text-[11px]" onClick={() => thumbRef.current?.click()}>
              <ImageIcon className="h-3.5 w-3.5 mr-1" /> {thumb ? 'Change thumbnail' : 'Add thumbnail'}
            </Button>
            <input
              ref={thumbRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => { onThumbPick(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
        </Section>

        <YouTubeSeoAssistant
          draft={{
            title: meta.title,
            description: meta.description,
            tags: meta.tags,
            categoryId: meta.categoryId,
            defaultLanguage: meta.defaultLanguage,
            isShort: kind === 'short',
          }}
          onApply={applySeo}
        />

        <Section title="Basics">

          <div className="space-y-1.5">
            <Label htmlFor="up-title" className="text-[11px]">Title ({meta.title.length}/100)</Label>
            <Input id="up-title" value={meta.title} maxLength={100} onChange={(e) => patch('title', e.target.value)} className="text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="up-desc" className="text-[11px]">Description ({meta.description.length}/5000)</Label>
            <Textarea id="up-desc" value={meta.description} maxLength={5000} rows={7} onChange={(e) => patch('description', e.target.value)} className="text-xs resize-y" placeholder="Add a description, hashtags (#Shorts), links…" />
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
            <Label htmlFor="up-cat" className="text-[11px]">Category</Label>
            <select id="up-cat" value={meta.categoryId} onChange={(e) => patch('categoryId', e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="up-lang" className="text-[11px]">Video language</Label>
            <select id="up-lang" value={meta.defaultLanguage} onChange={(e) => patch('defaultLanguage', e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs">
              {YT_LANGUAGES.map((l) => <option key={l.code || 'none'} value={l.code}>{l.label}</option>)}
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

          <div className="space-y-1.5">
            <Label htmlFor="up-schedule" className="text-[11px]">Schedule publish (optional)</Label>
            <Input id="up-schedule" type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} className="text-xs" />
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
            <Label htmlFor="up-license" className="text-[11px]">License</Label>
            <select id="up-license" value={meta.license} onChange={(e) => patch('license', e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs">
              <option value="youtube">Standard YouTube License</option>
              <option value="creativeCommon">Creative Commons – Attribution</option>
            </select>
          </div>
        </Section>

        {uploading && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-center text-[11px] text-muted-foreground">Uploading… {progress}%</p>
          </div>
        )}

        <Button onClick={submit} disabled={!canSubmit} className="w-full bg-red-600 hover:bg-red-700 text-white">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
          Upload to YouTube
        </Button>
      </main>

      <ImageCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        imageFile={cropFile}
        onCropComplete={onCropDone}
        aspectRatio={thumbAspect}
        outputSize={thumbOutput}
        title={kind === 'short' ? 'Crop Shorts thumbnail (9:16)' : 'Crop thumbnail (16:9)'}
      />
    </div>
  );
}
