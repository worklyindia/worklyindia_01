import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Message ids whose reveal animation already finished in this session. Kept at
 * module level so re-renders / scrolling never replay an old animation.
 */
const revealedIds = new Set<string>();

interface RevealTextProps {
  /** Full text (may still be growing while the answer streams in). */
  text: string;
  /** Stable message id — the animation plays only once per message. */
  messageId: string;
  /** Renders the (possibly partial) text. */
  render: (partial: string) => ReactNode;
  /**
   * Only messages that actually arrived live in this session animate. Messages
   * restored from storage after a refresh / re-open render instantly.
   */
  animate?: boolean;
  /** Characters revealed per ~16ms frame. */
  speed?: number;
}

/**
 * ChatGPT-style progressive text reveal: the answer types itself out instead of
 * popping in at once. Plays exactly once per message, and never on reload.
 */
export function RevealText({ text, messageId, render, animate = false, speed = 3 }: RevealTextProps) {
  const shouldAnimate = animate && !revealedIds.has(messageId);
  const [count, setCount] = useState(shouldAnimate ? 0 : text.length);
  const countRef = useRef(shouldAnimate ? 0 : text.length);
  const rafRef = useRef<number | null>(null);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    if (!animate || revealedIds.has(messageId)) {
      countRef.current = text.length;
      setCount(text.length);
      return;
    }

    let last = performance.now();
    const step = (now: number) => {
      const frames = Math.max(1, Math.round((now - last) / 16));
      last = now;
      const full = textRef.current.length;
      // Never go backwards, never overshoot the text received so far.
      countRef.current = Math.min(full, countRef.current + speed * frames);
      setCount(countRef.current);
      if (countRef.current < full) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = requestAnimationFrame(() => {
          // Text may still be streaming — keep waiting for more characters.
          if (countRef.current < textRef.current.length) {
            last = performance.now();
            rafRef.current = requestAnimationFrame(step);
          } else {
            revealedIds.add(messageId);
            rafRef.current = null;
          }
        });
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // Intentionally not depending on `text`: the loop reads the latest text via
    // a ref so streaming updates never restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId, animate, speed]);

  const done = count >= text.length;
  const partial = done ? text : text.slice(0, count);
  const typing = shouldAnimate && !done;

  return (
    <span className="ai-reveal">
      {render(partial)}
      {typing && <span className="ai-reveal-caret" aria-hidden="true" />}
    </span>
  );
}
