import * as React from "react";
import { AvatarImage } from "@/components/ui/avatar";
import { storageImageUrl } from "@/utils/imageUrl";

/**
 * Build a list of fallback URLs from a source URL.
 * Order:
 *   1. Original URL as-is
 *   2. URL with `?t=` / `?tr=` cache-busting / CDN-transform query stripped
 *   3. URL with the whole query string stripped
 * Duplicates are removed.
 */
function buildFallbackSources(
  src: string | null | undefined,
  width?: number,
): string[] {
  if (!src) return [];
  const list: string[] = [];

  if (width) {
    const resized = storageImageUrl(src, width);
    if (resized) list.push(resized);
  }

  // Prefer the transformed Supabase image first to protect cached egress.
  // Keep the original as a fallback so private/unsupported images still render.
  list.push(src);


  try {
    const u = new URL(src, window.location.origin);
    // Remove transform / cache-bust params
    const cleaned = new URL(u.toString());
    let touched = false;
    for (const key of ["t", "tr", "v"]) {
      if (cleaned.searchParams.has(key)) {
        cleaned.searchParams.delete(key);
        touched = true;
      }
    }
    if (touched) list.push(cleaned.toString());

    if (u.search) {
      const bare = `${u.origin}${u.pathname}`;
      list.push(bare);
    }
  } catch {
    /* not a URL — ignore */
  }

  return Array.from(new Set(list.filter(Boolean)));
}

type SafeAvatarImageProps = Omit<
  React.ComponentPropsWithoutRef<typeof AvatarImage>,
  "src" | "onError"
> & {
  src?: string | null;
  /** Target display width in CSS px; serves a resized image from Supabase Storage. */
  width?: number;
};

/**
 * Drop-in replacement for shadcn <AvatarImage> that automatically retries
 * the URL with cache-bust / CDN-transform query params stripped, then with
 * no query at all. If every attempt fails the component renders nothing so
 * the surrounding <AvatarFallback> can take over.
 */
export const SafeAvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarImage>,
  SafeAvatarImageProps
>(({ src, width = 96, ...props }, ref) => {
  const sources = React.useMemo(() => buildFallbackSources(src, width), [src, width]);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    setAttempt(0);
  }, [src]);

  const current = sources[attempt];
  if (!current) return null;

  return (
    <AvatarImage
      ref={ref}
      {...props}
      src={current}
      referrerPolicy="no-referrer"
      onLoadingStatusChange={(status) => {
        if (status !== "error") return;

        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.warn(
            `[SafeAvatarImage] failed to load (attempt ${attempt + 1}/${sources.length}):`,
            current,
          );
        }

        setAttempt((a) => (a + 1 < sources.length ? a + 1 : a));
      }}
    />
  );

});
SafeAvatarImage.displayName = "SafeAvatarImage";

type SafeImgProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "onError"
> & {
  src?: string | null;
  /** Final fallback when every retry fails. Defaults to `/placeholder.svg`. */
  fallbackSrc?: string;
  /** Target display width in CSS px; serves a resized image from Supabase Storage. */
  resizeWidth?: number;
};

/**
 * Drop-in replacement for raw <img> with the same retry chain as
 * <SafeAvatarImage>. After every fallback is exhausted it renders
 * `fallbackSrc` (default `/placeholder.svg`). If `fallbackSrc` is an
 * empty string the <img> is hidden instead.
 */
export const SafeImg = React.forwardRef<HTMLImageElement, SafeImgProps>(
  ({ src, fallbackSrc = "/placeholder.svg", style, resizeWidth, ...props }, ref) => {
    const sources = React.useMemo(
      () => buildFallbackSources(src, resizeWidth),
      [src, resizeWidth],
    );
    const [attempt, setAttempt] = React.useState(0);
    const [exhausted, setExhausted] = React.useState(false);

    React.useEffect(() => {
      setAttempt(0);
      setExhausted(false);
    }, [src]);

    const current = exhausted ? fallbackSrc : sources[attempt];

    if (!current) {
      // No source and no fallback — render nothing visible.
      return (
        <img
          ref={ref}
          {...props}
          alt={props.alt ?? ""}
          style={{ ...style, display: "none" }}
        />
      );
    }

    return (
      <img
        ref={ref}
        {...props}
        src={current}
        alt={props.alt ?? ""}
        style={style}
        referrerPolicy={props.referrerPolicy ?? "no-referrer"}
        onError={() => {
          if (attempt + 1 < sources.length) {
            setAttempt((a) => a + 1);
          } else if (!exhausted) {
            setExhausted(true);
          }
        }}
      />
    );
  },
);
SafeImg.displayName = "SafeImg";