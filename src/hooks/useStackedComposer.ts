import { RefObject, useLayoutEffect, useRef, useState } from 'react';

/**
 * ChatGPT-style composer (same behaviour as the AI chat page): a single row while
 * the text fits next to the icons, and once it wraps the text moves to its own
 * full-width line above the icons. A hidden mirror textarea decides the
 * inline <-> stacked switch so the layout change never oscillates.
 */
export function useStackedComposer(
  value: string,
  opts: { lineHeight?: number; maxHeight?: number; inlineControlsWidth?: number; inputRef?: RefObject<HTMLTextAreaElement> } = {},
) {
  const { lineHeight = 20, maxHeight = 128, inlineControlsWidth = 96 } = opts;
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = opts.inputRef ?? ownRef;
  const mirrorRef = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (!value) {
      el.style.height = `${lineHeight}px`;
      el.style.overflowY = 'hidden';
      setExpanded(false);
      return;
    }
    el.style.height = 'auto';
    const actual = Math.max(el.scrollHeight, lineHeight);
    let fitsInline = actual <= lineHeight + 6;
    const mirror = mirrorRef.current;
    if (mirror && expanded) {
      mirror.value = value;
      mirror.style.width = `${Math.max(40, el.clientWidth - inlineControlsWidth)}px`;
      mirror.style.height = 'auto';
      fitsInline = mirror.scrollHeight <= lineHeight + 6;
    }
    setExpanded(!fitsInline);
    el.style.height = `${Math.min(actual, maxHeight)}px`;
    if (actual > maxHeight) {
      el.style.overflowY = 'auto';
      el.scrollTop = el.scrollHeight;
    } else {
      el.style.overflowY = 'hidden';
      el.scrollTop = 0;
    }
  }, [value, expanded, lineHeight, maxHeight, inlineControlsWidth, inputRef]);

  return { inputRef, mirrorRef, expanded };
}
