import { useMemo, useState } from 'react';
import { Send, X, Pencil } from 'lucide-react';

export interface ChatOption {
  letter: string;
  label: string;
  raw: string;
}

export interface ChatQuestionGroup {
  question: string;
  questionRaw: string;
  options: ChatOption[];
  rawBlock: string;
}

interface ChatOptionChipsProps {
  content: string;
  onSelect: (text: string) => void;
  disabled?: boolean;
}

const OPTION_RE = /^([A-Fa-f])[\)\.\:]\s+(.{1,120})$/;
const QUESTION_RE = /^(?:\*\*)?(?:Q\s*\d+|Question\s*\d+|\d+)[\)\.\:][\s\S]*$/i;

export function extractQuestionGroups(content: string): ChatQuestionGroup[] {
  if (!content) return [];
  const lines = content.split('\n');
  const groups: ChatQuestionGroup[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const isQuestion = QUESTION_RE.test(trimmed);

    if (isQuestion) {
      const opts: ChatOption[] = [];
      const blockLines: string[] = [line];
      let j = i + 1;
      while (j < lines.length) {
        const t = lines[j].trim();
        if (!t) {
          blockLines.push(lines[j]);
          j++;
          continue;
        }
        const m = t.match(OPTION_RE);
        if (m) {
          opts.push({
            letter: m[1].toUpperCase(),
            label: m[2].replace(/[*_`]/g, '').trim(),
            raw: lines[j],
          });
          blockLines.push(lines[j]);
          j++;
        } else {
          break;
        }
      }
      if (opts.length >= 2) {
        groups.push({
          question: trimmed.replace(/[*_`]/g, '').trim(),
          questionRaw: line,
          options: opts,
          rawBlock: blockLines.join('\n'),
        });
        i = j;
        continue;
      }
    }
    i++;
  }

  if (groups.length === 0) {
    const opts: ChatOption[] = [];
    let foundBlock = false;
    const blockLines: string[] = [];
    for (let k = lines.length - 1; k >= 0; k--) {
      const t = lines[k].trim();
      const m = t.match(OPTION_RE);
      if (m) {
        foundBlock = true;
        opts.unshift({
          letter: m[1].toUpperCase(),
          label: m[2].replace(/[*_`]/g, '').trim(),
          raw: lines[k],
        });
        blockLines.unshift(lines[k]);
      } else if (foundBlock) {
        break;
      }
    }
    if (opts.length >= 2) {
      groups.push({
        question: '',
        questionRaw: '',
        options: opts,
        rawBlock: blockLines.join('\n'),
      });
    }
  }

  return groups;
}

export function extractOptions(content: string): ChatOption[] {
  const groups = extractQuestionGroups(content);
  if (groups.length === 1) return groups[0].options;
  return groups.flatMap((g) => g.options);
}

export function stripOptionsFromContent(content: string, _options: ChatOption[]): string {
  const groups = extractQuestionGroups(content);
  if (groups.length === 0) return content;
  let stripped = content;
  for (const g of groups) {
    if (g.rawBlock) stripped = stripped.replace(g.rawBlock, '');
    else for (const o of g.options) stripped = stripped.replace(o.raw, '');
  }
  return stripped.replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function ChatOptionChips({ content, onSelect, disabled }: ChatOptionChipsProps) {
  const groups = useMemo(() => extractQuestionGroups(content), [content]);
  const [selections, setSelections] = useState<Record<number, ChatOption>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<number, string>>({});
  const [showCustom, setShowCustom] = useState<Record<number, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  if (groups.length === 0) return null;

  const isSingle = groups.length === 1;

  const hasAnswer = (idx: number) =>
    !!selections[idx] || !!(customAnswers[idx] && customAnswers[idx].trim());

  const allSelected = groups.every((_, idx) => hasAnswer(idx));
  const anySelected = groups.some((_, idx) => hasAnswer(idx));
  const answeredCount = groups.filter((_, i) => hasAnswer(i)).length;

  const handleChipTap = (groupIdx: number, opt: ChatOption) => {
    if (submitted || disabled) return;
    // Tapping a chip clears any custom answer for that group
    setCustomAnswers((prev) => {
      const n = { ...prev };
      delete n[groupIdx];
      return n;
    });
    setShowCustom((prev) => ({ ...prev, [groupIdx]: false }));
    setSelections((prev) => {
      // Toggle off if same chip tapped again
      if (prev[groupIdx]?.letter === opt.letter) {
        const n = { ...prev };
        delete n[groupIdx];
        return n;
      }
      return { ...prev, [groupIdx]: opt };
    });
  };

  const handleSend = () => {
    if (submitted || disabled || !anySelected) return;
    setSubmitted(true);
    if (isSingle) {
      const custom = customAnswers[0]?.trim();
      if (custom) return onSelect(custom);
      const sel = selections[0];
      if (sel) return onSelect(sel.label);
      return;
    }
    const lines = groups.map((g, idx) => {
      const qLabel = g.question || `Q${idx + 1}`;
      const custom = customAnswers[idx]?.trim();
      if (custom) return `${qLabel} → ${custom}`;
      const sel = selections[idx];
      if (!sel) return `${qLabel} → (skipped)`;
      return `${qLabel} → ${sel.letter}) ${sel.label}`;
    });
    onSelect(lines.join('\n'));
  };

  const toggleCustom = (idx: number) => {
    if (submitted || disabled) return;
    setShowCustom((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const clearGroup = (idx: number) => {
    if (submitted || disabled) return;
    setSelections((prev) => {
      const n = { ...prev };
      delete n[idx];
      return n;
    });
    setCustomAnswers((prev) => {
      const n = { ...prev };
      delete n[idx];
      return n;
    });
    setShowCustom((prev) => ({ ...prev, [idx]: false }));
  };

  return (
    <div className="mt-2 space-y-3">
      {groups.map((group, gIdx) => {
        const selected = selections[gIdx];
        const customVal = customAnswers[gIdx] || '';
        const customOpen = !!showCustom[gIdx];
        const groupHasAnswer = hasAnswer(gIdx);
        return (
          <div key={gIdx} className="space-y-1.5">
            {!isSingle && group.question && (
              <div className="text-xs font-semibold text-gray-700 leading-snug">
                {group.question}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {group.options.map((opt) => {
                const isSelected =
                  selected?.letter === opt.letter && !customVal.trim();
                return (
                  <button
                    key={opt.letter}
                    type="button"
                    disabled={disabled || submitted}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChipTap(gIdx, opt);
                    }}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all active:scale-95 disabled:cursor-not-allowed',
                      isSelected
                        ? 'bg-[#25D366] border-[#25D366] text-white shadow-sm'
                        : 'bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/40 text-[#075E54]',
                      submitted && !isSelected ? 'opacity-40' : '',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
                        isSelected ? 'bg-white text-[#075E54]' : 'bg-[#25D366] text-white',
                      ].join(' ')}
                    >
                      {opt.letter}
                    </span>
                    <span className="max-w-[200px] truncate">{opt.label}</span>
                  </button>
                );
              })}
              {/* "Apna jawab" chip — opens free-text input */}
              <button
                type="button"
                disabled={disabled || submitted}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCustom(gIdx);
                }}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm font-medium transition-all active:scale-95 disabled:cursor-not-allowed',
                  customOpen || customVal.trim()
                    ? 'bg-[#075E54] border-[#075E54] text-white'
                    : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-600',
                ].join(' ')}
              >
                <Pencil className="w-3 h-3" />
                <span>Apna jawab</span>
              </button>
              {groupHasAnswer && !submitted && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearGroup(gIdx);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white hover:bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500 transition-all active:scale-95"
                  title="Selection hatao"
                >
                  <X className="w-3 h-3" />
                  Hatao
                </button>
              )}
            </div>
            {customOpen && !submitted && (
              <input
                type="text"
                autoFocus
                value={customVal}
                disabled={disabled || submitted}
                onChange={(e) => {
                  const v = e.target.value;
                  setCustomAnswers((prev) => ({ ...prev, [gIdx]: v }));
                  if (v.trim()) {
                    setSelections((prev) => {
                      const n = { ...prev };
                      delete n[gIdx];
                      return n;
                    });
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="Yahan apna jawab likho..."
                className="w-full rounded-lg border border-[#25D366]/40 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
              />
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-1">
        <div className="text-[11px] text-gray-500">
          {submitted
            ? 'Sent ✓'
            : isSingle
            ? anySelected
              ? 'Ready — Send dabao'
              : 'Ek option chuno ya apna jawab likho'
            : allSelected
            ? 'Sab ready — Send dabao'
            : `${answeredCount}/${groups.length} select kiye`}
        </div>
        <button
          type="button"
          disabled={disabled || submitted || !anySelected}
          onClick={handleSend}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] hover:bg-[#1da851] active:scale-95 px-4 py-1.5 text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
      </div>
    </div>
  );
}
