import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eraser, PenTool, Undo2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (dataUrl: string) => void;
}

type Point = { x: number; y: number; t: number };
type Stroke = Point[];

const INK = '#1E40AF';
const BG = '#ffffff';
const CANVAS_H = 260;

const SignaturePadDialog: React.FC<Props> = ({ open, onOpenChange, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke>([]);
  const drawingRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);
  const [hasStroke, setHasStroke] = useState(false);

  const getCtx = () => {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext('2d');
  };

  const resetCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, rect.width, rect.height);
    // ink defaults
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const redrawAll = useCallback(() => {
    resetCanvas();
    const ctx = getCtx();
    if (!ctx) return;
    for (const s of strokesRef.current) drawStroke(ctx, s);
  }, [resetCanvas]);

  useEffect(() => {
    if (!open) return;
    strokesRef.current = [];
    currentStrokeRef.current = [];
    drawingRef.current = false;
    activePointerRef.current = null;
    setHasStroke(false);
    // wait one tick so DOM has laid out
    requestAnimationFrame(() => resetCanvas());
  }, [open, resetCanvas]);

  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

  // Width based on pointer velocity — slower = thicker
  const widthFromVelocity = (v: number) => {
    const min = 0.9;
    const max = 3.4;
    const w = max - v * 0.35;
    return Math.max(min, Math.min(max, w));
  };

  const drawSegment = (ctx: CanvasRenderingContext2D, a: Point, b: Point, prevWidth: number) => {
    const dt = Math.max(1, b.t - a.t);
    const dist = distance(a, b);
    const v = dist / dt; // px/ms
    const targetW = widthFromVelocity(v);
    // smooth width transition
    const w = prevWidth * 0.6 + targetW * 0.4;
    // draw as a filled trapezoid via multiple short lines with rounded caps
    ctx.beginPath();
    ctx.lineWidth = w;
    ctx.moveTo(a.x, a.y);
    // quadratic smoothing to mid-point
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    ctx.quadraticCurveTo(a.x, a.y, mx, my);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    return w;
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.length < 2) {
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    let w = 2;
    for (let i = 1; i < stroke.length; i++) {
      w = drawSegment(ctx, stroke[i - 1], stroke[i], w);
    }
  };

  const pos = (e: React.PointerEvent): Point => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() };
  };

  const start = (e: React.PointerEvent) => {
    // palm rejection — ignore secondary touches
    if (activePointerRef.current !== null) return;
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    const c = canvasRef.current!;
    activePointerRef.current = e.pointerId;
    c.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = [pos(e)];
  };

  const move = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    if (e.pointerId !== activePointerRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const p = pos(e);
    const stroke = currentStrokeRef.current;
    const last = stroke[stroke.length - 1];
    if (last && distance(last, p) < 1.2) return; // dedupe
    stroke.push(p);
    // incrementally draw the new segment only
    if (stroke.length >= 2) {
      const w = stroke.length > 2 ? 2 : 2;
      drawSegment(ctx, stroke[stroke.length - 2], p, w);
    }
    setHasStroke(true);
  };

  const end = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointerRef.current) return;
    if (!drawingRef.current) return;
    drawingRef.current = false;
    activePointerRef.current = null;
    if (currentStrokeRef.current.length) {
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = [];
      // full redraw with smoothing for the finished stroke
      redrawAll();
    }
  };

  const undo = () => {
    strokesRef.current.pop();
    setHasStroke(strokesRef.current.length > 0);
    redrawAll();
  };

  const clear = () => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setHasStroke(false);
    resetCanvas();
  };

  const save = () => {
    const c = canvasRef.current;
    if (!c) return;
    // Re-render without guide lines for export
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const rect = c.getBoundingClientRect();
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of strokesRef.current) drawStroke(ctx, s);
    const dataUrl = c.toDataURL('image/png');
    onSave(dataUrl);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="w-5 h-5" /> Draw Your Signature
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border-2 border-dashed border-border bg-white overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: CANVAS_H, display: 'block', touchAction: 'none', cursor: 'crosshair' }}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onPointerLeave={end}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">Sign in the box — pen thickness follows your speed.</p>
        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={undo} disabled={!hasStroke} className="flex-1">
            <Undo2 className="w-4 h-4 mr-1" /> Undo
          </Button>
          <Button type="button" variant="outline" onClick={clear} disabled={!hasStroke} className="flex-1">
            <Eraser className="w-4 h-4 mr-1" /> Clear
          </Button>
          <Button type="button" onClick={save} disabled={!hasStroke} className="flex-1">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SignaturePadDialog;
