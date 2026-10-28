import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfPagePreviewProps { url: string; filename: string; compact?: boolean }

export function PdfPagePreview({ url, filename, compact = false }: PdfPagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    const task = getDocument(url);
    setLoading(true);
    setFailed(false);
    void task.promise.then(async pdf => {
      const page = await pdf.getPage(1);
      if (!active || !canvasRef.current) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (compact ? 192 : 720) / baseViewport.width });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
      renderTask = page.render({ canvasContext: context, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      await renderTask.promise;
      if (active) setLoading(false);
    }).catch(() => { if (active) { setLoading(false); setFailed(true); } });
    return () => { active = false; renderTask?.cancel(); void task.destroy(); };
  }, [compact, url]);

  return <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-muted">
    <canvas ref={canvasRef} aria-label={`First page of ${filename}`} className={`block max-h-full max-w-full bg-card object-contain ${loading || failed ? 'invisible' : ''}`} />
    {loading && <Loader2 className="absolute h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading PDF preview" />}
    {failed && <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-muted-foreground"><FileText className={compact ? 'h-7 w-7' : 'h-10 w-10'} /><span className="max-w-full truncate text-xs">{filename}</span></div>}
  </div>;
}