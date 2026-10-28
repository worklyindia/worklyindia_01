import { useState } from "react";
import { Braces } from "lucide-react";
import LottieProfileIcon from "@/components/LottieProfileIcon";
import type { GenerationIntent } from "@/utils/contentIntentDetector";
import { isAIStatusDebugEnabled } from "@/lib/aiStatusDebug";

export type AITaskPhase =
  | "started"
  | "analyzing"
  | "checking"
  | "verifying"
  | "finalizing"
  | "completed"
  | "failed";

interface AIGenerationIndicatorProps {
  type?: GenerationIntent;
  assistantName?: string;
  /** Human-readable live status, always in the user's own language. */
  statusText?: string;
  phase?: AITaskPhase;
  progress?: number;
  /**
   * Completed steps of this run, oldest first. Lets the chip show more than one
   * parallel/sequential task (e.g. "YouTube channel dekh rahi hoon" ✓ then
   * "Video SEO update kar rahi hoon").
   */
  steps?: string[];
  /**
   * Localized generic line ("Working on your request...") used while a task is
   * running but no specific status has arrived yet.
   */
  fallbackText?: string;
  /** Raw run details — shown ONLY in debug/admin mode, never to normal users. */
  debugPayload?: Record<string, unknown>;
}

/**
 * "AI is working" indicator.
 * - text/file: brand icon + live status chip (spinner + human-readable step)
 * - image: ChatGPT-style "Creating image" card with an animated dot canvas
 *
 * The status chip is visible ONLY while a task is actually running. Once the
 * run reports `completed` (or the stream starts writing the answer) the whole
 * indicator is unmounted by the parent, so only the final answer remains.
 */
export function AIGenerationIndicator({
  type = "text",
  statusText,
  phase,
  progress,
  steps = [],
  fallbackText,
  debugPayload,
}: AIGenerationIndicatorProps) {
  const [showDebug, setShowDebug] = useState(false);
  const debugEnabled = isAIStatusDebugEnabled();
  // The chip stays visible for the whole running task. If no status text has
  // arrived yet we still show a neutral working label (in the user's own
  // language) instead of a bare icon.
  const liveText =
    statusText || (phase === "failed" ? "" : fallbackText || "Working on your request...");
  const isRunning = phase !== "completed" && !!liveText;
  const failed = phase === "failed";


  if (type === "image") {
    return (
      <div className="flex justify-start animate-in fade-in duration-200 relative z-10">
        <div className="w-[82%] max-w-[300px] rounded-3xl bg-muted/60 p-4">
          <p className="mb-3 text-[15px] text-muted-foreground animate-pulse">
            {statusText || "Creating image"}
          </p>
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
            <div className="grid h-full w-full grid-cols-12 place-items-center gap-[2px] p-3">
              {Array.from({ length: 144 }).map((_, i) => {
                const row = Math.floor(i / 12);
                const col = i % 12;
                const dist = Math.hypot(row - 5.5, col - 5.5);
                return (
                  <span
                    key={i}
                    className="rounded-full bg-foreground/25"
                    style={{
                      width: `${Math.max(1.5, 5 - dist * 0.5)}px`,
                      height: `${Math.max(1.5, 5 - dist * 0.5)}px`,
                      animation: "pulse 1.6s ease-in-out infinite",
                      animationDelay: `${dist * 0.09}s`,
                    }}
                  />
                );
              })}
            </div>

            {/* JSON status icon — centered inside the image box while generating.
                Debug/admin only, normal users never see it. */}
            {debugEnabled && (
              <div className="absolute inset-0 flex items-center justify-center p-3">
                {showDebug ? (
                  <pre
                    onClick={() => setShowDebug(false)}
                    className="max-h-full w-full cursor-pointer overflow-auto rounded-xl bg-background/90 p-2 text-[10px] text-muted-foreground"
                  >
                    {JSON.stringify(
                      { phase, progress, status: statusText, steps, ...(debugPayload || {}) },
                      null,
                      2,
                    )}
                  </pre>
                ) : (
                  <button
                    type="button"
                    aria-label="Show task status details"
                    onClick={() => setShowDebug(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
                  >
                    <Braces className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="flex w-full justify-start animate-in fade-in duration-200 relative z-10 mt-4">
      <div className="flex w-full min-w-0 items-center gap-2">
        {/* AI icon */}
        <div className="h-8 w-8 shrink-0 flex items-center justify-center animate-pulse">
          <LottieProfileIcon size={28} />
        </div>

        <div className="min-w-0 flex-1 max-w-[calc(100%-2.75rem)] sm:max-w-[420px]">
          {isRunning && (
            /* No bubble — single line status that reads like an AI message. */
            <div className="flex h-8 min-h-[20px] items-center gap-1.5">
              {/* JSON/status icon — debug/admin only. Normal users never see it. */}
              {debugEnabled && (
                <button
                  type="button"
                  aria-label="Show task status details"
                  onClick={() => setShowDebug((v) => !v)}
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center self-center rounded text-muted-foreground/70 hover:text-foreground"
                >
                  <Braces className="h-3 w-3" />
                </button>
              )}

              <StatusText
                text={liveText}
                failed={failed}
              />
            </div>
          )}


          {isRunning && debugEnabled && showDebug && (
            <pre className="mt-1 max-w-full overflow-auto rounded-lg bg-muted p-2 text-[10px] text-muted-foreground">
              {JSON.stringify(
                { phase, progress, status: statusText, steps, ...(debugPayload || {}) },
                null,
                2,
              )}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

/** Remove all emoji characters from status text so the chip never shows them. */
function stripEmojis(text: string): string {
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\uFE0E\u200D]+/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function StatusText({ text, failed }: { text: string; failed: boolean }) {
  const cleanText = stripEmojis(text);
  const textColor = failed ? "text-destructive" : "text-[#0A84FF]";
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span
        className={`min-w-0 truncate text-[14px] font-semibold leading-5 tracking-[0.2px] ai-status-text ${textColor}`}
      >
        {cleanText}
      </span>
      <span className="inline-flex shrink-0 items-center gap-0.5 self-center" aria-hidden="true">
        <span className="typing-dot h-1 w-1 rounded-full bg-current opacity-60" />
        <span className="typing-dot h-1 w-1 rounded-full bg-current opacity-60" />
        <span className="typing-dot h-1 w-1 rounded-full bg-current opacity-60" />
      </span>
    </span>
  );
}

