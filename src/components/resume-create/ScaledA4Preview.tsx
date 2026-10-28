import React from 'react';

type ScaledA4PreviewProps = {
  children: React.ReactNode;
  fit?: 'contain' | 'cover';
  pageWidth?: number;
  pageHeight?: number;
  /** Optional override for card aspect ratio. Defaults to page aspect. */
  aspectRatio?: number;
};

/**
 * Renders an A4-sized node inside a responsive thumbnail frame.
 * Uses a padding-bottom hack for reliable aspect ratio on all mobile browsers
 * (avoids the CSS `aspect-ratio` bug inside buttons / flex parents where
 * clientHeight can measure 0 on first paint).
 */
export const ScaledA4Preview: React.FC<ScaledA4PreviewProps> = ({
  children,
  fit = 'cover',
  pageWidth = 794,
  pageHeight = 1123,
  aspectRatio,
}) => {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = React.useState({ scale: 0, x: 0, y: 0 });

  const ratio = aspectRatio ?? pageHeight / pageWidth;

  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w > 0 && h > 0) {
        const nextScale =
          fit === 'cover'
            ? Math.max(w / pageWidth, h / pageHeight)
            : Math.min(w / pageWidth, h / pageHeight);
        setLayout({
          scale: nextScale,
          x: (w - pageWidth * nextScale) / 2,
          y: (h - pageHeight * nextScale) / 2,
        });
      } else {
        // Fallback: assume container is width-only, derive height from ratio
        const fw = el.clientWidth || el.parentElement?.clientWidth || 280;
        const fh = fw * ratio;
        const nextScale =
          fit === 'cover'
            ? Math.max(fw / pageWidth, fh / pageHeight)
            : Math.min(fw / pageWidth, fh / pageHeight);
        setLayout({
          scale: nextScale,
          x: (fw - pageWidth * nextScale) / 2,
          y: (fh - pageHeight * nextScale) / 2,
        });
      }
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    // Recompute after fonts finish loading (font metrics change layout)
    const fontsReady = (document as any).fonts?.ready;
    if (fontsReady && typeof fontsReady.then === 'function') {
      fontsReady.then(compute).catch(() => {});
    }
    const raf = requestAnimationFrame(compute);
    const t = setTimeout(compute, 120);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [fit, pageHeight, pageWidth, ratio]);

  return (
    <div
      data-a4-preview
      className="relative w-full overflow-hidden rounded-lg bg-white border"
      style={{ paddingBottom: `${ratio * 100}%` }}
    >
      <div
        ref={wrapRef}
        className="absolute inset-0"
        style={{ contain: 'layout paint' }}
      >
        <div
          data-a4-page
          style={{
            width: pageWidth,
            minWidth: pageWidth,
            maxWidth: 'none',
            height: pageHeight,
            minHeight: pageHeight,
            maxHeight: 'none',
            transform: `translate(${layout.x}px, ${layout.y}px) scale(${layout.scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
            willChange: 'transform',
            visibility: layout.scale === 0 ? 'hidden' : 'visible',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
