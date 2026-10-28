import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { BadgeCheck } from "lucide-react";

export interface TrustItem {
  name: string;
  imageUrl?: string | null;
  verified?: boolean;
}

interface TrustMarqueeProps {
  variant: "companies" | "seekers";
  title: string;
  items: TrustItem[];
  defaultImageUrl?: string | null;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const APPROX_TILE_PX = 160;
const PX_PER_SECOND = 60; // slow, easy to read

interface RowItem {
  id: number;
  item: TrustItem;
}

const getInitials = (name: string) => {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : "?";
};

const Tile = ({ item, isSeekers }: { item: TrustItem; isSeekers: boolean; defaultImageUrl?: string | null }) => {
  const initials = getInitials(item.name);
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!item.imageUrl && !imgFailed;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border shrink-0 whitespace-nowrap">
      <div
        className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden ${
          isSeekers
            ? "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-700"
            : "bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-700"
        }`}
      >
        {showImage ? (
          <img
            src={item.imageUrl as string}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="select-none">{initials}</span>
        )}
        {isSeekers && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card z-10" />
        )}
      </div>
      <span className="text-xs font-medium text-foreground max-w-[110px] truncate">
        {item.name}
      </span>
      {item.verified && !isSeekers && (
        <BadgeCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
      )}
    </div>
  );
};

const TrustMarquee = ({ variant, title, items, defaultImageUrl }: TrustMarqueeProps) => {
  const isSeekers = variant === "seekers";

  const poolRef = useRef<TrustItem[]>([]);
  const pointerRef = useRef(0);
  const nextIdRef = useRef(1);

  const takeNext = (): TrustItem | null => {
    const pool = poolRef.current;
    if (pool.length === 0) return null;
    if (pointerRef.current >= pool.length) {
      poolRef.current = shuffle(pool);
      pointerRef.current = 0;
    }
    return poolRef.current[pointerRef.current++];
  };

  // Initial number of tiles in the row — enough to fill > 2x viewport so the
  // leftmost tile is always off-screen by the time we pop it.
  const [initialCount] = useState(() => {
    if (typeof window === "undefined") return 16;
    return Math.max(12, Math.ceil((window.innerWidth * 2.5) / APPROX_TILE_PX));
  });

  const [row, setRow] = useState<RowItem[]>([]);

  // Build initial row whenever the source items change.
  useEffect(() => {
    if (!items || items.length === 0) {
      setRow([]);
      poolRef.current = [];
      pointerRef.current = 0;
      return;
    }
    poolRef.current = shuffle(items);
    pointerRef.current = 0;
    nextIdRef.current = 1;
    const initial: RowItem[] = [];
    for (let i = 0; i < initialCount; i++) {
      const next = takeNext();
      if (!next) break;
      initial.push({ id: nextIdRef.current++, item: next });
    }
    setRow(initial);
  }, [items, initialCount]);

  // rAF-driven marquee. We translate the whole row leftwards each frame. When
  // the leftmost tile's full width has scrolled off-screen, we atomically
  // pop it from the start, push a new tile onto the end, and add the popped
  // tile's width back to the translate — so the on-screen pixels stay
  // identical and no two tiles ever overlap.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const translateRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    if (reducedMotion) return;
    if (row.length === 0) return;

    let rafId = 0;
    let cancelled = false;

    const step = (ts: number) => {
      if (cancelled) return;
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min(64, ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      translateRef.current -= PX_PER_SECOND * dt;

      const scroller = scrollerRef.current;
      if (scroller) {
        // Check the first child width — if fully scrolled past, recycle.
        const first = scroller.firstElementChild as HTMLElement | null;
        if (first) {
          // include any horizontal gap by reading offsetLeft of the 2nd child.
          const second = first.nextElementSibling as HTMLElement | null;
          const firstWidth = second
            ? second.offsetLeft - first.offsetLeft
            : first.offsetWidth;
          if (firstWidth > 0 && -translateRef.current >= firstWidth) {
            const next = takeNext();
            if (next) {
              translateRef.current += firstWidth;
              flushSync(() => {
                setRow((prev) => {
                  const out = prev.slice(1);
                  out.push({ id: nextIdRef.current++, item: next });
                  return out;
                });
              });
            }
          }
        }

        scroller.style.transform = `translate3d(${translateRef.current}px, 0, 0)`;
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      lastTsRef.current = null;
    };
  }, [row.length === 0, reducedMotion]);

  if (!items || items.length === 0) return null;

  return (
    <div className="mt-4 mb-2">
      <div className="flex items-center justify-center gap-2 mb-2 px-2">
        <span className="h-px flex-1 bg-border" />
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-center">
          {title}
        </p>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div
        className="group relative overflow-hidden py-2.5 w-screen max-w-[100vw] left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]"
        aria-label={title}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent z-10" />

        <div
          ref={scrollerRef}
          className="flex w-max gap-3 will-change-transform"
          style={{ transform: "translate3d(0,0,0)" }}
        >
          {row.map((r) => (
            <Tile key={r.id} item={r.item} isSeekers={isSeekers} defaultImageUrl={defaultImageUrl} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrustMarquee;
