import { useState } from 'react';
import { Loader2, Check, Copy, ExternalLink, Send } from 'lucide-react';

/**
 * AI-authored action buttons.
 *
 * The assistant can add a fenced block at the end of a message:
 *
 * ```ai-buttons
 * [{"label":"Update","color":"red","action":"send","value":"update kar do","icon":"🚀"}]
 * ```
 *
 * Supported actions: "send" (send text back to chat), "copy" (copy value),
 * "link" (open url). Colour + label + icon are fully chosen by the AI.
 */
export interface ChatActionButton {
  label: string;
  action: 'send' | 'copy' | 'link';
  value?: string;
  color?: string;
  icon?: string;
}

// Tolerant: closing fence optional (stream cut-off), language tag may sit on
// its own line, and the block may be empty. Nothing of it must ever reach the
// markdown renderer as a visible code block.
const BLOCK_RE = /```[ \t]*\n?[ \t]*ai[-_]?buttons\b[ \t]*([\s\S]*?)(?:```|$)/i;


const COLORS: Record<string, string> = {
  red: 'bg-red-600 hover:bg-red-700 text-white',
  green: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  blue: 'bg-blue-600 hover:bg-blue-700 text-white',
  purple: 'bg-purple-600 hover:bg-purple-700 text-white',
  orange: 'bg-orange-500 hover:bg-orange-600 text-white',
  yellow: 'bg-yellow-400 hover:bg-yellow-500 text-black',
  gray: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
  black: 'bg-gray-900 hover:bg-black text-white',
  primary: 'bg-primary hover:bg-primary/90 text-primary-foreground',
};

export function extractChatButtons(content: string): ChatActionButton[] | null {
  const m = content?.match(BLOCK_RE);
  if (!m) return null;
  const body = (m[1] || '').trim();
  if (!body) return null;
  // The AI sometimes adds a stray line before/after the JSON — take the array only.
  const start = body.indexOf('[');
  const end = body.lastIndexOf(']');
  const json = start !== -1 && end > start ? body.slice(start, end + 1) : body;
  try {
    const parsed = JSON.parse(json);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const buttons = arr
      .map((b: any) => ({
        label: String(b?.label ?? '').trim(),
        action: (['send', 'copy', 'link'].includes(b?.action) ? b.action : 'send') as ChatActionButton['action'],
        value: b?.value != null ? String(b.value) : undefined,
        color: b?.color ? String(b.color).toLowerCase() : 'primary',
        icon: b?.icon ? String(b.icon) : undefined,
      }))
      .filter((b) => b.label)
      .slice(0, 12);
    return buttons.length ? buttons : null;
  } catch {
    return null;
  }
}

export function stripChatButtonsBlock(content: string): string {
  return (content || '')
    // remove the block even when the JSON was broken / empty
    .replace(new RegExp(BLOCK_RE.source, 'gi'), '')
    // leftover bare mention of the marker (fence already eaten by markdown,
    // or the AI wrote just the word / an inline `ai-buttons`)
    .replace(/^[ \t]*`{0,3}[ \t]*ai[-_]?buttons[ \t]*`{0,3}[ \t]*:?[ \t]*$/gim, '')
    .replace(/`[ \t]*ai[-_]?buttons[ \t]*`/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


export default function ChatActionButtons({
  buttons,
  onSend,
}: {
  buttons: ChatActionButton[];
  onSend?: (text: string) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const run = (btn: ChatActionButton, i: number) => {
    if (btn.action === 'copy') {
      navigator.clipboard?.writeText(btn.value || btn.label);
      setDone(i);
      setTimeout(() => setDone(null), 1600);
      return;
    }
    if (btn.action === 'link') {
      if (btn.value) window.open(btn.value, '_blank', 'noopener,noreferrer');
      return;
    }
    setBusy(i);
    onSend?.(btn.value || btn.label);
    setTimeout(() => setBusy(null), 800);
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {buttons.map((btn, i) => (
        <button
          key={`${btn.label}-${i}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            run(btn, i);
          }}
          disabled={busy === i}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-60 ${
            COLORS[btn.color || 'primary'] || COLORS.primary
          }`}
        >
          {busy === i ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : done === i ? (
            <Check className="w-3.5 h-3.5" />
          ) : btn.icon ? (
            <span className="text-[13px] leading-none">{btn.icon}</span>
          ) : btn.action === 'copy' ? (
            <Copy className="w-3.5 h-3.5" />
          ) : btn.action === 'link' ? (
            <ExternalLink className="w-3.5 h-3.5" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          {done === i && btn.action === 'copy' ? 'Copied' : btn.label}
        </button>
      ))}
    </div>
  );
}
