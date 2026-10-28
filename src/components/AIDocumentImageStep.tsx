import React, { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import { Download, ImageIcon, RefreshCw, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Lottie for the "AI is designing your …" state (replaces the generic spinner)
import metaAiLottie from '@/assets/lottie/meta-ai.json';

type Props = {
  type: 'cover_letter' | 'resume';
  template: string;
  data: Record<string, unknown>;
  referenceImageUrl?: string;
  filename: string;
  downloadLabel: string;
  autoStart?: boolean;
};

// Do not duplicate uploaded bitmaps inside the JSON prompt. They are sent once
// through referenceImageUrl as a real multimodal image attachment.
const stripBinaryDraftData = (value: unknown, depth = 0): unknown => {
  if (depth > 12) return undefined;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^data:(image|application)\//i.test(text) || /^blob:/i.test(text)) return undefined;
    if (text.length > 20_000 && /^[A-Za-z0-9+/=\s]+$/.test(text)) return undefined;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripBinaryDraftData(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/^(photoUrl|digitalSignatureUrl|signatureImageUrl|imageData|base64)$/i.test(key))
        .map(([key, item]) => [key, stripBinaryDraftData(item, depth + 1)])
        .filter(([, item]) => item !== undefined),
    );
  }
  return value;
};

// Convert any local URL (blob:, /assets/..., vite-hashed) to a base64 data URL
// AND downscale large photos so the edge function payload stays under Supabase's
// request body limit.
const toDataUrl = async (
  url: string | undefined,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<string | undefined> => {
  if (!url) return undefined;
  const { maxDim = 900, quality = 0.85 } = opts;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') || blob.size < 200 * 1024) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read failed'));
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
    const imgUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('image load failed'));
        el.src = imgUrl;
      });
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', quality);
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  } catch {
    return undefined;
  }
};

// Load an image element from any URL or data URL.
const loadImageEl = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('load failed'));
  img.src = src;
});

// Composite the user's original uploaded photo (resume) or signature (cover
// letter) onto the AI-generated page. This guarantees the user's actual upload
// is used — regardless of what the model drew.
const compositeUploadedAsset = async (
  generatedDataUrl: string,
  type: 'resume' | 'cover_letter',
  uploadedUrl?: string,
): Promise<string> => {
  if (!uploadedUrl) return generatedDataUrl;
  try {
    const [page, asset] = await Promise.all([
      loadImageEl(generatedDataUrl),
      loadImageEl(uploadedUrl),
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = page.naturalWidth;
    canvas.height = page.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return generatedDataUrl;
    ctx.drawImage(page, 0, 0);

    const W = canvas.width;
    const H = canvas.height;
    if (type === 'resume') {
      // Photo circle: assume top-left area of the header banner (~7% inset,
      // diameter ~18% of page width). This matches every template shipped.
      const d = Math.round(W * 0.18);
      const cx = Math.round(W * 0.16);
      const cy = Math.round(H * 0.11);
      const ratio = asset.naturalWidth / asset.naturalHeight;
      let sw = asset.naturalWidth, sh = asset.naturalHeight, sx = 0, sy = 0;
      if (ratio > 1) { sw = sh; sx = (asset.naturalWidth - sw) / 2; }
      else if (ratio < 1) { sh = sw; sy = (asset.naturalHeight - sh) / 2; }
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - d / 2, cy - d / 2, d, d);
      ctx.drawImage(asset, sx, sy, sw, sh, cx - d / 2, cy - d / 2, d, d);
      ctx.restore();
    } else {
      // Signature: bottom-left area, above typed name (~10% left, ~78% down,
      // width ~30% of page, height auto).
      const targetW = Math.round(W * 0.3);
      const scale = targetW / asset.naturalWidth;
      const targetH = Math.round(asset.naturalHeight * scale);
      const x = Math.round(W * 0.1);
      const y = Math.round(H * 0.72);
      // Paint a white plate under the signature to cover any AI-drawn signature.
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 6, y - 6, targetW + 12, targetH + 12);
      ctx.drawImage(asset, x, y, targetW, targetH);
      ctx.restore();
    }
    return canvas.toDataURL('image/png');
  } catch {
    return generatedDataUrl;
  }
};

const AIDocumentImageStep: React.FC<Props> = ({
  type, template, data, referenceImageUrl, filename, downloadLabel, autoStart = true,
}) => {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [verification, setVerification] = useState<{ passed: boolean; issues: string[] } | null>(null);

  // Regenerate feedback sheet
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const lastFeedbackRef = useRef<string>('');

  const generate = async (userInstructions = '') => {
    setLoading(true);
    setError(null);
    setImageUrl(null);
    setVerification(null);
    try {
      const refDataUrl = await toDataUrl(referenceImageUrl, { maxDim: 1400, quality: 0.92 });

      const { data: res, error: fnErr } = await supabase.functions.invoke('ai-career-chat/generate-document-image', {
        body: {
          type,
          template,
          data: stripBinaryDraftData(data),
          referenceImageUrl: refDataUrl,
          userInstructions: userInstructions.trim() || undefined,
          highQuality: true,
        },
      });
      if (fnErr) {
        let detail = '';
        try {
          const ctx: any = (fnErr as any).context;
          if (ctx?.json) {
            const j = await ctx.json();
            detail = [j?.error, j?.detail].filter(Boolean).join(' — ');
          } else if (ctx?.text) {
            detail = await ctx.text();
          }
        } catch { /* ignore */ }
        const base = (fnErr as any)?.message || 'Request failed';
        throw new Error(detail ? `${detail}` : `${base}. Please check your internet and try again.`);
      }
      if (!res?.image) {
        const msg = [res?.error, res?.detail].filter(Boolean).join(' — ') || 'No image returned by AI';
        throw new Error(msg);
      }
      // Composite the user's actual uploaded photo/signature over the AI image
      // so it always matches — no invented faces or handwriting.
      const finalImage = await compositeUploadedAsset(res.image, type === 'cover_letter' ? 'cover_letter' : 'resume', refDataUrl);
      setImageUrl(finalImage);
      if (res.verification) setVerification(res.verification);
      setAttempts((n) => n + 1);
    } catch (e: any) {
      const msg = e?.message || 'Failed to generate';
      setError(msg);
      toast({ variant: 'destructive', title: 'AI generation failed', description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoStart) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `${filename}.png`;
    a.click();
    toast({ title: 'Image downloaded' });
  };

  const QUICK_FIXES: string[] = [
    'Keep original language, do not translate',
    'Remove any header or footer branding',
    'Use my uploaded photo exactly',
    'Use my uploaded signature exactly',
    'Keep the "+" prefix in phone number',
    'Do not add "Sincerely" or any closing not in my data',
  ];

  const appendChip = (text: string) => {
    setFeedback((prev) => (prev.trim() ? `${prev.trim()}\n• ${text}` : `• ${text}`));
  };

  const submitFeedback = () => {
    lastFeedbackRef.current = feedback;
    setFeedbackOpen(false);
    generate(feedback);
  };

  const lottieData = metaAiLottie;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">AI-generated preview</h3>
        </div>

        {loading && (
          <div className="aspect-[1/1.414] rounded-xl bg-muted flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="w-40 h-40">
              <Lottie animationData={lottieData} loop autoplay />
            </div>
            <div className="text-sm">AI is designing your {type === 'cover_letter' ? 'cover letter' : 'resume'}...</div>
            <div className="text-[11px] px-6 text-center">Using the "{template}" template with the details you provided.</div>
          </div>
        )}

        {!loading && error && (
          <div className="aspect-[1/1.414] rounded-xl bg-destructive/5 border border-destructive/20 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="text-sm font-medium text-destructive">Generation failed</div>
            <div className="text-xs text-muted-foreground">{error}</div>
            <Button size="sm" variant="outline" onClick={() => generate()} className="rounded-full">
              <RefreshCw className="w-4 h-4 mr-1" /> Retry
            </Button>
          </div>
        )}

        {!loading && !error && imageUrl && (
          <>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="block w-full rounded-xl overflow-hidden border bg-white hover:opacity-95 transition"
              aria-label="Open full-size image"
            >
              <img src={imageUrl} alt={`${type} preview`} className="w-full h-auto block" />
            </button>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">Tap the image to view full-size</p>
            {verification && (
              <div className={`mt-3 flex items-start gap-2 rounded-lg border p-2.5 text-xs ${verification.passed ? 'border-primary/25 bg-primary/5 text-primary' : 'border-warning/30 bg-warning/10 text-foreground'}`}>
                {verification.passed ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-warning" />}
                <span>{verification.passed ? 'Text and details verified' : `Please review: ${verification.issues.join('; ')}`}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => { setFeedback(lastFeedbackRef.current); setFeedbackOpen(true); }} disabled={loading} className="rounded-xl">
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Regenerate
        </Button>
        <Button onClick={download} disabled={!imageUrl || loading} className="rounded-xl" aria-label={downloadLabel}>
          <Download className="w-4 h-4" />
        </Button>
      </div>

      {open && imageUrl && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <img src={imageUrl} alt="Full preview" className="max-w-full max-h-full rounded-lg shadow-2xl" />
        </div>
      )}

      <Sheet open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> What should the AI fix?
            </SheetTitle>
            <SheetDescription>
              Describe the corrections in English. The AI will regenerate the image and apply only these fixes — nothing else.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. Remove the 'Workly India' header, keep my summary in Hindi, don't add 'Sincerely,' and keep the + in my phone number."
              className="min-h-[120px] rounded-xl"
            />
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Quick fixes</div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_FIXES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => appendChip(q)}
                    className="text-xs px-2.5 py-1 rounded-full border bg-background hover:bg-muted transition"
                  >
                    + {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SheetFooter className="mt-5 flex-row gap-2">
            <Button variant="outline" onClick={() => setFeedbackOpen(false)} className="flex-1 rounded-xl">
              Cancel
            </Button>
            <Button onClick={submitFeedback} className="flex-1 rounded-xl">
              <RefreshCw className="w-4 h-4 mr-1" /> Regenerate with fixes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AIDocumentImageStep;
