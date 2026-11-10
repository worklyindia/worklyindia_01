import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Bold, Braces, Code2, EyeOff, Italic, Link, Quote, Redo2, RemoveFormatting, Smile, Strikethrough, Underline, Undo2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { decorateTelegramEntities, escapeTemplateHtml, renderTelegramTemplateHtml } from '@/lib/templateFormatting';
import { cn } from '@/lib/utils';

export interface TelegramBodyEditorRef {
  insertVariable: (token: string) => void;
}

interface TelegramBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

const EMOJIS = ['😊', '👍', '🎉', '❤️', '🔥', '✅', '⭐', '💯', '🙏', '👋', '💼', '📅', '📍', '💰', '📞', '📧', '🔔', '🚀', '🏆', '⚠️', '❌', '✨', '🎯', '🤝'];

const selectionInside = (root: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return false;
  return root.contains(selection.getRangeAt(0).commonAncestorContainer);
};

const editableHtmlToTelegram = (html: string) => html
  .replace(/<span\s+data-telegram-entity="true">([\s\S]*?)<\/span>/gi, '$1')
  .replace(/<div><br\s*\/?><\/div>/gi, '\n')
  .replace(/<\/(?:div|p)>/gi, '\n')
  .replace(/<(?:div|p)(?:\s[^>]*)?>/gi, '')
  .replace(/\n+$/g, '');

/**
 * Telegram understands tags, not CSS. Browsers sometimes style typed words with
 * CSS instead, so turn that styling back into the tags Telegram supports before
 * the message is stored — otherwise the bold/italic the writer just applied
 * would be silently dropped.
 */
const telegramHtmlFromEditor = (editor: HTMLElement) => {
  const clone = editor.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>('[style]').forEach((node) => {
    if (node.dataset.telegramEntity === 'true') return;
    const { fontWeight, fontStyle } = node.style;
    const decoration = `${node.style.textDecoration} ${node.style.textDecorationLine}`;
    const tags: string[] = [];
    if (fontWeight === 'bold' || fontWeight === 'bolder' || Number(fontWeight) >= 600) tags.push('b');
    if (fontStyle === 'italic' || fontStyle === 'oblique') tags.push('i');
    if (/underline/.test(decoration)) tags.push('u');
    if (/line-through/.test(decoration)) tags.push('s');
    node.removeAttribute('style');
    if (!tags.length) return;
    const outer = document.createElement(tags[0]);
    let innermost: HTMLElement = outer;
    tags.slice(1).forEach((tag) => {
      const child = document.createElement(tag);
      innermost.appendChild(child);
      innermost = child;
    });
    while (node.firstChild) innermost.appendChild(node.firstChild);
    node.replaceWith(outer);
  });
  return clone.innerHTML;
};



const selectionTextOffset = (root: HTMLElement): number | null => {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selectionInside(root)) return null;
  const range = selection.getRangeAt(0).cloneRange();
  const beforeCaret = range.cloneRange();
  beforeCaret.selectNodeContents(root);
  beforeCaret.setEnd(range.endContainer, range.endOffset);
  return beforeCaret.toString().length;
};

const restoreSelectionAtTextOffset = (root: HTMLElement, requestedOffset: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, requestedOffset);
  let node = walker.nextNode();

  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      savedRangeFromSelection(selection, root);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }

  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  savedRangeFromSelection(selection, root);
};

const savedRangeFromSelection = (selection: Selection | null, root: HTMLElement) => {
  if (!selection?.rangeCount || !selectionInside(root)) return null;
  return selection.getRangeAt(0).cloneRange();
};

export const TelegramBodyEditor = forwardRef<TelegramBodyEditorRef, TelegramBodyEditorProps>(function TelegramBodyEditor(
  { value, onChange, placeholder, maxLength = 900 },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const lastEmitted = useRef<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [characterCount, setCharacterCount] = useState(0);
  const [activeCommands, setActiveCommands] = useState<Set<string>>(new Set());


  const refreshActiveCommands = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    const insideNow = Boolean(selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer));
    if (!insideNow && document.activeElement !== editor) return;
    const commands = ['bold', 'italic', 'underline', 'strikeThrough'];
    setActiveCommands(new Set(commands.filter((command) => {
      try { return document.queryCommandState(command); } catch { return false; }
    })));
  }, []);

  const saveCurrentSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || !selectionInside(editor)) return;
    savedRange.current = selection.getRangeAt(0).cloneRange();
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', saveCurrentSelection);
    document.addEventListener('selectionchange', refreshActiveCommands);
    return () => {
      document.removeEventListener('selectionchange', saveCurrentSelection);
      document.removeEventListener('selectionchange', refreshActiveCommands);
    };
  }, [refreshActiveCommands, saveCurrentSelection]);

  /** Put the cursor back where the writer left it, without disturbing a live selection. */
  const restoreSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection) return;
    if (selectionInside(editor)) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
      return;
    }
    const range = savedRange.current;
    if (!range || !editor.contains(range.commonAncestorContainer)) return;
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const rememberSelection = saveCurrentSelection;

  const emit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const textLength = editor.innerText.replace(/\n$/, '').length;
    setCharacterCount(textLength);
    const next = renderTelegramTemplateHtml(editableHtmlToTelegram(telegramHtmlFromEditor(editor)));
    lastEmitted.current = next;
    onChange(next);
  };

  // Only load content that did not come from this box, so typing and the
  // pending bold/italic state are never thrown away mid-edit.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === lastEmitted.current) return;
    const html = decorateTelegramEntities(renderTelegramTemplateHtml(value)).replace(/\n/g, '<br/>');
    if (editor.innerHTML !== html) editor.innerHTML = html;
    setCharacterCount(editor.innerText.replace(/\n$/, '').length);
  }, [value]);

  const command = (name: string, argument?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();
    // Telegram only supports tags, so ask the browser for tags, not CSS.
    try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* not supported */ }
    document.execCommand(name, false, argument);
    rememberSelection();
    refreshActiveCommands();
    emit();
  };



  /** Live length, so a stale render can never allow more than the limit. */
  const currentLength = () => (editorRef.current?.innerText || '').replace(/\n$/, '').length;

  const insertText = (text: string) => {
    const room = Math.max(0, maxLength - currentLength());
    if (room > 0) command('insertText', text.slice(0, room));
    setEmojiOpen(false);
  };

  useImperativeHandle(ref, () => ({ insertVariable: insertText }));

  /** Wrap the selected words in a Telegram tag (code, spoiler). */
  const wrapSelection = (tag: 'code' | 'tg-spoiler') => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();
    const selected = window.getSelection()?.toString() || '';
    if (!selected.trim()) return;
    command('insertHTML', `<${tag}>${escapeTemplateHtml(selected)}</${tag}>`);
  };

  const addLink = () => {
    const url = linkUrl.trim();
    if (!/^(https?:\/\/|tg:\/\/|mailto:|tel:)/i.test(url)) return;
    const selection = window.getSelection();
    restoreSelection();
    const selectedText = selection?.toString() || '';
    const label = linkText.trim() || selectedText || url;
    command('insertHTML', `<a href="${url.replace(/"/g, '&quot;')}">${escapeTemplateHtml(label)}</a>`);
    setLinkOpen(false);
    setLinkText('');
    setLinkUrl('');
  };

  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const length = editor.innerText.replace(/\n$/, '').length;
    if (length > maxLength) {
      document.execCommand('undo');
      return;
    }
    emit();
    // Do not replace the editable DOM while typing. Rebuilding innerHTML here
    // discards the browser's pending bold/italic/etc. state at a collapsed caret.
    rememberSelection();
  };

  /**
   * Re-colour usernames, commands and links once the writer really leaves the
   * message box. Tapping a toolbar button is not leaving, so the text keeps the
   * formatting that was just switched on.
   */
  const refreshEntityHighlights = (event?: React.FocusEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = event?.relatedTarget;
    if (next instanceof Node && editor.parentElement?.contains(next)) return;
    const cleanHtml = renderTelegramTemplateHtml(editableHtmlToTelegram(telegramHtmlFromEditor(editor)));
    editor.innerHTML = decorateTelegramEntities(cleanHtml).replace(/\n/g, '<br/>');

  };


  const tools = [
    { label: 'Bold', icon: Bold, commandName: 'bold', action: () => command('bold') },
    { label: 'Italic', icon: Italic, commandName: 'italic', action: () => command('italic') },
    { label: 'Underline', icon: Underline, commandName: 'underline', action: () => command('underline') },
    { label: 'Strikethrough', icon: Strikethrough, commandName: 'strikeThrough', action: () => command('strikeThrough') },
    { label: 'Inline code', icon: Code2, action: () => wrapSelection('code') },
    { label: 'Code block', icon: Braces, action: () => command('formatBlock', 'pre') },
    { label: 'Quote', icon: Quote, action: () => command('formatBlock', 'blockquote') },
    { label: 'Hidden (spoiler)', icon: EyeOff, action: () => wrapSelection('tg-spoiler') },
    { label: 'Remove link', icon: Unlink, action: () => command('unlink') },
    { label: 'Clear formatting', icon: RemoveFormatting, action: () => command('removeFormat') },
    { label: 'Undo', icon: Undo2, action: () => command('undo') },
    { label: 'Redo', icon: Redo2, action: () => command('redo') },
  ];

  return (
    <div className="overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
      <TooltipProvider delayDuration={250}>
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5">
          {tools.map(({ label, icon: Icon, action, commandName }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button type="button" variant={commandName && activeCommands.has(commandName) ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onMouseDown={(event) => event.preventDefault()} onTouchStart={(event) => event.preventDefault()} onPointerDown={(event) => { event.preventDefault(); action(); }} aria-label={label} aria-pressed={commandName ? activeCommands.has(commandName) : undefined}>
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}

          <Popover open={linkOpen} onOpenChange={(open) => { if (open) rememberSelection(); setLinkOpen(open); }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Add link"><Link className="h-4 w-4" /></Button></PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Add link</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-72 space-y-2 p-3">
              <Input value={linkText} onChange={(event) => setLinkText(event.target.value)} placeholder="Link text" />
              <Input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://..." onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addLink(); } }} />
              <Button type="button" size="sm" className="w-full" onClick={addLink}>Add link</Button>
            </PopoverContent>
          </Popover>

          <Popover open={emojiOpen} onOpenChange={(open) => { if (open) rememberSelection(); setEmojiOpen(open); }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Add emoji"><Smile className="h-4 w-4" /></Button></PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Add emoji</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((emoji) => <Button key={emoji} type="button" variant="ghost" size="icon" className="h-8 w-8 text-lg" onClick={() => insertText(emoji)}>{emoji}</Button>)}
              </div>
            </PopoverContent>
          </Popover>
          <span className={cn('ml-auto px-1 text-xs text-muted-foreground', characterCount >= maxLength && 'text-destructive')}>{characterCount}/{maxLength}</span>
        </div>
      </TooltipProvider>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Telegram message"
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onFocus={rememberSelection}
        onBlur={refreshEntityHighlights}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain');
          const selected = window.getSelection()?.toString().length ?? 0;
          const remaining = Math.max(0, maxLength - currentLength() + selected);
          if (remaining > 0) command('insertText', text.slice(0, remaining));
        }}
        className="min-h-44 whitespace-pre-wrap break-words px-3 py-3 text-sm leading-6 outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_[data-telegram-entity]]:font-medium [&_[data-telegram-entity]]:text-telegram-tick [&_a]:font-medium [&_a]:text-telegram-tick [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-telegram-tick [&_blockquote]:pl-2 [&_tg-spoiler]:rounded [&_tg-spoiler]:bg-muted-foreground/40 [&_tg-spoiler]:px-1"
      />
    </div>
  );
});