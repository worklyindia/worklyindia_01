import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Box, FileImage, Heading, Highlighter, ImagePlus, Italic, Link,
  List, ListOrdered, Minus, MousePointerClick, Quote, Redo2, RemoveFormatting, Smile, Space, Strikethrough,
  Trash2, Underline, Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageCropDialog } from '@/components/brand/ImageCropDialog';
import {
  clampButtonFontSize, clampButtonPaddingX, clampButtonPaddingY,
  emailButtonHtml, emailImageHtml, emailSnippetHtml, sanitizeEmailDocumentHtml, toEmailDocumentHtml, type EmailSnippet,
} from '@/lib/emailBuilder';

export interface EmailBodyBuilderRef { insertVariable: (token: string) => void; }
interface Props {
  value: string;
  onChange: (html: string) => void;
  onUploadImage: (file: File) => Promise<string>;
  uploading?: boolean;
  onInsertButton?: () => void;
  /** Called when a picture is removed from the message, so the stored file is deleted too. */
  onDeleteImage?: (url: string) => void;
}

const SNIPPETS: { type: EmailSnippet; label: string; icon: typeof Box }[] = [
  { type: 'heading', label: 'Heading', icon: Heading },
  { type: 'list', label: 'List', icon: List },
  { type: 'box', label: 'Box', icon: Box },
  { type: 'divider', label: 'Line', icon: Minus },
  { type: 'spacer', label: 'Space', icon: Space },
];

const FONTS = ['Arial', 'Roboto', 'Georgia', 'Verdana', 'Tahoma', 'Courier New'];
const SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48];
const EMOJIS = ['😊', '👍', '🎉', '❤️', '🔥', '✅', '⭐', '💯', '🙏', '👋', '💼', '📅', '📍', '💰', '📞', '📧', '🔔', '🚀', '🏆', '⚠️', '❌', '✨', '🎯', '🤝'];

export const EmailBodyBuilder = forwardRef<EmailBodyBuilderRef, Props>(function EmailBodyBuilder(
  { value, onChange, onUploadImage, uploading, onInsertButton, onDeleteImage },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const lastEmitted = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gifRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [characterCount, setCharacterCount] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [imageSettingsOpen, setImageSettingsOpen] = useState(false);
  const [imageWidth, setImageWidth] = useState(100);
  const [imageAlignment, setImageAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [imageWrapText, setImageWrapText] = useState(false);
  const [buttonOpen, setButtonOpen] = useState(false);
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [buttonBackground, setButtonBackground] = useState('#2563eb');
  const [buttonColor, setButtonColor] = useState('#ffffff');
  const [buttonFontSize, setButtonFontSize] = useState(16);
  const [buttonPaddingX, setButtonPaddingX] = useState(22);
  const [buttonPaddingY, setButtonPaddingY] = useState(12);
  const [buttonRadius, setButtonRadius] = useState(8);
  const [buttonAlignment, setButtonAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [buttonWrapText, setButtonWrapText] = useState(false);
  const [editingButton, setEditingButton] = useState<HTMLAnchorElement | null>(null);
  const [activeCommands, setActiveCommands] = useState<Set<string>>(new Set());

  const refreshActiveCommands = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    const insideNow = Boolean(selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer));
    if (!insideNow && document.activeElement !== editor) return;
    const commands = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight'];
    setActiveCommands(new Set(commands.filter((command) => {
      try { return document.queryCommandState(command); } catch { return false; }
    })));
  }, []);

  const saveCurrentSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', saveCurrentSelection);
    document.addEventListener('selectionchange', refreshActiveCommands);
    return () => {
      document.removeEventListener('selectionchange', saveCurrentSelection);
      document.removeEventListener('selectionchange', refreshActiveCommands);
    };
  }, [refreshActiveCommands, saveCurrentSelection]);

  // Load incoming content only when it did not come from this editor, so the
  // cursor never jumps while typing.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === lastEmitted.current) return;
    editor.innerHTML = toEmailDocumentHtml(value);
    setCharacterCount((editor.innerText || '').replace(/\n+$/, '').length);
  }, [value]);

  const rememberSelection = saveCurrentSelection;

  const focusEditor = () => {
    const editor = editorRef.current;
    if (!editor) return null;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return editor;
    // A live selection inside the box always wins over the remembered one.
    if (selection.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
      return editor;
    }
    if (savedRange.current && editor.contains(savedRange.current.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
    return editor;
  };


  const emit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = sanitizeEmailDocumentHtml(editor.innerHTML);
    lastEmitted.current = html;
    setCharacterCount((editor.innerText || '').replace(/\n+$/, '').length);
    onChange(html);
  };

  const run = (command: string, argument?: string) => {
    if (!focusEditor()) return;
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, argument);
    rememberSelection();
    refreshActiveCommands();
    emit();
  };

  const insertAtCursor = (html: string) => {
    if (!focusEditor()) return;
    document.execCommand('insertHTML', false, html);
    rememberSelection();
    emit();
  };

  useImperativeHandle(ref, () => ({
    insertVariable(token) {
      if (!focusEditor()) return;
      document.execCommand('insertText', false, token);
      rememberSelection();
      emit();
    },
  }));

  const pickImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
  };

  // GIFs are inserted as they are — cropping or resizing would kill the animation.
  const pickGif = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || file.type !== 'image/gif') return;
    try {
      const url = await onUploadImage(file);
      if (url) insertAtCursor(emailImageHtml(url));
    } catch {
      /* the parent already shows the failure */
    }
  };

  const uploadCroppedImage = async (file: File) => {
    const url = await onUploadImage(file);
    if (!url) return false;
    insertAtCursor(emailImageHtml(url));
    setImageFile(null);
    return true;
  };

  const openImageSettings = (image: HTMLImageElement) => {
    const wrapper = image.parentElement;
    const parsedWidth = Number.parseInt(image.style.width, 10);
    const float = image.style.float;
    const wrapperAlignment = wrapper?.style.textAlign;
    const alignment = float === 'left' || float === 'right'
      ? float
      : wrapperAlignment === 'left' || wrapperAlignment === 'right'
        ? wrapperAlignment
        : 'center';
    setSelectedImage(image);
    setImageWidth(Number.isFinite(parsedWidth) ? Math.max(15, Math.min(100, parsedWidth)) : 100);
    setImageAlignment(alignment);
    setImageWrapText(float === 'left' || float === 'right');
    setImageSettingsOpen(true);
  };

  const applyImageSettings = () => {
    if (!selectedImage || !editorRef.current?.contains(selectedImage)) {
      setImageSettingsOpen(false);
      return;
    }
    const wrapper = selectedImage.parentElement;
    const wraps = imageWrapText && imageAlignment !== 'center';
    selectedImage.style.width = `${imageWidth}%`;
    selectedImage.style.maxWidth = '100%';
    selectedImage.style.borderRadius = '8px';
    selectedImage.style.float = wraps ? imageAlignment : 'none';
    selectedImage.style.display = wraps ? 'block' : 'inline-block';
    selectedImage.style.shapeOutside = wraps ? 'circle(50%)' : 'none';
    selectedImage.style.shapeMargin = wraps ? '4px' : '0';
    selectedImage.style.marginLeft = wraps && imageAlignment === 'right' ? '4px' : '0';
    selectedImage.style.marginRight = wraps && imageAlignment === 'left' ? '4px' : '0';
    selectedImage.style.marginBottom = wraps ? '-10px' : '0';
    if (wrapper) {
      wrapper.style.textAlign = imageAlignment;
      wrapper.style.margin = wraps ? '0' : '0 0 16px';
      wrapper.style.padding = '0';
      wrapper.style.lineHeight = wraps ? '0' : '';
    }
    emit();
    setImageSettingsOpen(false);
  };

  const deleteSelectedImage = () => {
    if (!selectedImage || !editorRef.current?.contains(selectedImage)) return;
    const removedUrl = selectedImage.getAttribute('src') || '';
    const wrapper = selectedImage.parentElement;
    const wrapperOnlyHasImage = wrapper && wrapper.childNodes.length === 1;
    if (wrapperOnlyHasImage) wrapper.remove();
    else selectedImage.remove();
    emit();
    if (removedUrl) onDeleteImage?.(removedUrl);
    setSelectedImage(null);
    setImageSettingsOpen(false);
  };

  const toHex = (color: string, fallback: string) => {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
    return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
  };

  const parsePx = (value: string, fallback: number) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const openButtonSettings = (anchor: HTMLAnchorElement) => {
    setEditingButton(anchor);
    setButtonText(anchor.textContent || '');
    setButtonUrl(anchor.getAttribute('href') || '');
    setButtonBackground(toHex(anchor.style.backgroundColor, '#2563eb'));
    setButtonColor(toHex(anchor.style.color, '#ffffff'));
    setButtonFontSize(clampButtonFontSize(parsePx(anchor.style.fontSize, 16)));
    setButtonPaddingY(clampButtonPaddingY(parsePx(anchor.style.paddingTop || anchor.style.padding, 12)));
    setButtonPaddingX(clampButtonPaddingX(parsePx(anchor.style.paddingLeft || (anchor.style.padding.split(' ')[1] ?? ''), 22)));
    setButtonRadius(parsePx(anchor.style.borderRadius, 8));
    const alignment = anchor.parentElement?.style.textAlign;
    setButtonAlignment(alignment === 'left' || alignment === 'right' ? alignment : 'center');
    setButtonWrapText(anchor.style.float === 'left' || anchor.style.float === 'right');
    setButtonOpen(true);
  };

  const buttonPadding = `${clampButtonPaddingY(buttonPaddingY)}px ${clampButtonPaddingX(buttonPaddingX)}px`;

  const saveButton = () => {
    if (editingButton && editorRef.current?.contains(editingButton)) {
      editingButton.setAttribute('href', buttonUrl.trim());
      editingButton.textContent = buttonText.trim();
      editingButton.style.display = 'inline-block';
      editingButton.style.padding = buttonPadding;
      editingButton.style.borderRadius = `${buttonRadius}px`;
      editingButton.style.backgroundColor = buttonBackground;
      editingButton.style.color = buttonColor;
      editingButton.style.textDecoration = 'none';
      editingButton.style.fontSize = `${clampButtonFontSize(buttonFontSize)}px`;
      editingButton.style.fontWeight = '700';
      editingButton.style.lineHeight = '1.2';
      const wraps = buttonWrapText && buttonAlignment !== 'center';
      editingButton.style.float = wraps ? buttonAlignment : 'none';
      editingButton.style.marginLeft = wraps && buttonAlignment === 'right' ? '4px' : '0';
      editingButton.style.marginRight = wraps && buttonAlignment === 'left' ? '4px' : '0';
      editingButton.style.marginBottom = wraps ? '2px' : '0';
      if (editingButton.parentElement) {
        editingButton.parentElement.style.textAlign = buttonAlignment;
        editingButton.parentElement.style.margin = '0';
        editingButton.parentElement.style.padding = '0';
        editingButton.parentElement.style.lineHeight = wraps ? '0' : '1.2';
      }
      emit();
      onInsertButton?.();
    } else {
      const html = emailButtonHtml({
        text: buttonText,
        url: buttonUrl,
        backgroundColor: buttonBackground,
        textColor: buttonColor,
        fontSize: buttonFontSize,
        paddingX: buttonPaddingX,
        paddingY: buttonPaddingY,
        radius: buttonRadius,
        alignment: buttonAlignment,
        wrapText: buttonWrapText,
      });
      if (!html) return;
      insertAtCursor(html);
      onInsertButton?.();
    }
    setEditingButton(null);
    setButtonOpen(false);
  };

  const removeButton = () => {
    if (editingButton && editorRef.current?.contains(editingButton)) {
      const wrapper = editingButton.parentElement;
      if (wrapper && wrapper.tagName === 'P' && wrapper.childNodes.length === 1) wrapper.remove();
      else editingButton.remove();
      emit();
    }
    setEditingButton(null);
    setButtonOpen(false);
  };

  const addLink = () => {
    const url = linkUrl.trim();
    if (!/^(https?:\/\/|mailto:|tel:|\/)/i.test(url)) return;
    const saved = savedRange.current;
    const hasSelectedText = Boolean(saved && !saved.collapsed && saved.toString().trim());
    if (hasSelectedText) {
      // Turn the words already selected into the link.
      run('createLink', url);
    } else {
      // Nothing selected: add the link as new words, so the button never looks broken.
      const label = linkText.trim() || url;
      insertAtCursor(`<a href="${url.replace(/"/g, '&quot;')}">${label.replace(/[<>&]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[character] as string))}</a>`);
    }
    setLinkOpen(false);
    setLinkUrl('');
    setLinkText('');
  };

  return (
    <TooltipProvider delayDuration={250}>
      <div className="overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
        {/* Row 1: text styling, always applied to what is selected */}
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5" onPointerDownCapture={rememberSelection}>
          <Select onOpenChange={(open) => { if (open) rememberSelection(); }} onValueChange={(font) => run('fontName', font)}>
            <SelectTrigger className="h-8 w-[104px] text-xs"><SelectValue placeholder="Font" /></SelectTrigger>
            <SelectContent>{FONTS.map((font) => <SelectItem key={font} value={font}>{font}</SelectItem>)}</SelectContent>
          </Select>
          <Select
            onOpenChange={(open) => { if (open) rememberSelection(); }}
            onValueChange={(size) => {
              const editor = focusEditor();
              const selection = window.getSelection();
              if (!editor || !selection?.rangeCount || selection.isCollapsed) return;
              const range = selection.getRangeAt(0);
              const span = document.createElement('span');
              span.style.fontSize = `${size}px`;
              span.appendChild(range.extractContents());
              range.insertNode(span);
              range.selectNodeContents(span);
              rememberSelection();
              emit();
            }}
          >
            <SelectTrigger className="h-8 w-[84px] text-xs"><SelectValue placeholder="Size" /></SelectTrigger>
            <SelectContent>{SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}px</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" size="icon" variant={activeCommands.has('bold') ? 'secondary' : 'ghost'} className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('bold'); }} aria-label="Bold" aria-pressed={activeCommands.has('bold')}><Bold className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant={activeCommands.has('italic') ? 'secondary' : 'ghost'} className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('italic'); }} aria-label="Italic" aria-pressed={activeCommands.has('italic')}><Italic className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant={activeCommands.has('underline') ? 'secondary' : 'ghost'} className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('underline'); }} aria-label="Underline" aria-pressed={activeCommands.has('underline')}><Underline className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant={activeCommands.has('strikeThrough') ? 'secondary' : 'ghost'} className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('strikeThrough'); }} aria-label="Strikethrough" aria-pressed={activeCommands.has('strikeThrough')}><Strikethrough className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('insertUnorderedList'); }} aria-label="Bullet list"><List className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('insertOrderedList'); }} aria-label="Numbered list"><ListOrdered className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('formatBlock', 'blockquote'); }} aria-label="Quote"><Quote className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('removeFormat'); }} aria-label="Clear formatting"><RemoveFormatting className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('undo'); }} aria-label="Undo"><Undo2 className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('redo'); }} aria-label="Redo"><Redo2 className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('justifyLeft'); }} aria-label="Align left"><AlignLeft className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('justifyCenter'); }} aria-label="Align center"><AlignCenter className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onPointerDown={(e) => { e.preventDefault(); run('justifyRight'); }} aria-label="Align right"><AlignRight className="h-4 w-4" /></Button>
          <label className="ml-1 flex items-center" aria-label="Text colour">
            <input
              type="color"
              className="h-7 w-8 cursor-pointer rounded border bg-transparent p-0.5"
              onPointerDown={rememberSelection}
              onChange={(event) => run('foreColor', event.target.value)}
            />
          </label>
          <label className="flex items-center gap-0.5" aria-label="Highlight colour">
            <Highlighter className="h-4 w-4 text-muted-foreground" />
            <input
              type="color"
              defaultValue="#fef08a"
              className="h-7 w-8 cursor-pointer rounded border bg-transparent p-0.5"
              onPointerDown={rememberSelection}
              onChange={(event) => run('hiliteColor', event.target.value)}
            />
          </label>
          <Popover open={linkOpen} onOpenChange={(open) => { if (open) { rememberSelection(); setLinkUrl(''); setLinkText(window.getSelection()?.toString().trim() || ''); } setLinkOpen(open); }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Add link"><Link className="h-4 w-4" /></Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Add link</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-72 space-y-2 p-3">
              <Input value={linkText} onChange={(event) => setLinkText(event.target.value)} placeholder="Link text (optional)" />
              <Input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://... or /page" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addLink(); } }} />
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => { run('unlink'); setLinkOpen(false); }}>Remove</Button>
                <Button type="button" size="sm" onClick={addLink}>Add link</Button>
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={emojiOpen} onOpenChange={(open) => { if (open) rememberSelection(); setEmojiOpen(open); }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Add emoji"><Smile className="h-4 w-4" /></Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Add emoji</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-64 p-2">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((emoji) => (
                  <Button
                    key={emoji}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-lg"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (!focusEditor()) return;
                      document.execCommand('insertText', false, emoji);
                      rememberSelection();
                      emit();
                      setEmojiOpen(false);
                    }}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Row 2: ready-made pieces, inserted exactly where the cursor is */}
        <div className="flex items-center gap-1 overflow-x-auto border-b bg-muted/20 p-1.5" aria-label="Insert at cursor">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-2 text-xs"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setEditingButton(null);
              setButtonWrapText(false);
              // Start with empty boxes so nothing has to be cleared first.
              setButtonText('');
              setButtonUrl('');
              setButtonOpen(true);
            }}
          >
            <MousePointerClick className="h-4 w-4" />Button
          </Button>
          {SNIPPETS.map(({ type, label, icon: Icon }) => (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5 px-2 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => insertAtCursor(emailSnippetHtml(type))}>
                  <Icon className="h-4 w-4" />{label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Insert {label.toLowerCase()} here</TooltipContent>
            </Tooltip>
          ))}
          <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5 px-2 text-xs" disabled={uploading} onMouseDown={(e) => e.preventDefault()} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />{uploading ? 'Uploading…' : 'Image'}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5 px-2 text-xs" disabled={uploading} onMouseDown={(e) => e.preventDefault()} onClick={() => gifRef.current?.click()}>
                <FileImage className="h-4 w-4" />GIF
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add a moving GIF here</TooltipContent>
          </Tooltip>
           <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickImage} />
           <input ref={gifRef} type="file" accept="image/gif" className="hidden" onChange={(event) => void pickGif(event)} />
          <span className="ml-auto shrink-0 px-1 text-xs text-muted-foreground">{characterCount} characters</span>
        </div>

        {/*
          One single message box — exactly what the email will look like.
          Font stack, text size, line height and side padding match the sent
          email shell, so line breaks here match the real inbox.
        */}
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Email message"
          suppressContentEditableWarning
          spellCheck
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
             padding: '30px 12px 26px',
            fontSize: '15px',
            lineHeight: 1.7,
          }}
          className="email-theme-content min-h-64 max-h-[60vh] overflow-y-auto break-words bg-preview-email-paper text-preview-email-paper-fg caret-preview-email-paper-heading outline-none [color-scheme:light] dark:[color-scheme:dark] [&_a]:text-preview-email-paper-link [&_a]:underline [&_h2]:mb-3 [&_h2]:font-bold [&_h2]:text-preview-email-paper-heading [&_li]:ml-4 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5"
          onInput={emit}
          onBlur={emit}
          onKeyUp={rememberSelection}
          onMouseUp={rememberSelection}
          onSelect={rememberSelection}
          onClick={(event) => {
            const target = event.target;
            if (target instanceof HTMLImageElement) { openImageSettings(target); return; }
            const anchor = target instanceof HTMLElement ? target.closest('a') : null;
            if (anchor && editorRef.current?.contains(anchor) && anchor.style.display === 'inline-block') openButtonSettings(anchor);
          }}
          onPaste={(event) => {
            event.preventDefault();
            document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
          }}
        />
      </div>

      <ImageCropDialog
        open={Boolean(imageFile)}
        onOpenChange={(open) => { if (!open) setImageFile(null); }}
        imageFile={imageFile}
        onCropComplete={uploadCroppedImage}
        title="Crop message image"
        allowOriginal
        hideHeader
      />

      <Dialog open={imageSettingsOpen} onOpenChange={setImageSettingsOpen}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-sm rounded-md p-4">
          <DialogHeader><DialogTitle>Edit image</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Image size: {imageWidth}%</Label>
              <Slider value={[imageWidth]} min={15} max={100} step={5} onValueChange={(values) => setImageWidth(values[0])} />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['left', 'center', 'right'] as const).map((alignment) => (
                  <Button
                    key={alignment}
                    type="button"
                    size="sm"
                    variant={imageAlignment === alignment ? 'default' : 'outline'}
                    onClick={() => {
                      setImageAlignment(alignment);
                      if (alignment === 'center') setImageWrapText(false);
                    }}
                    className="capitalize"
                  >
                    {alignment === 'left' ? <AlignLeft className="mr-1.5 h-4 w-4" /> : alignment === 'right' ? <AlignRight className="mr-1.5 h-4 w-4" /> : <AlignCenter className="mr-1.5 h-4 w-4" />}
                    {alignment}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Text position</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant={!imageWrapText ? 'default' : 'outline'} onClick={() => setImageWrapText(false)}>Text below</Button>
                <Button type="button" size="sm" variant={imageWrapText ? 'default' : 'outline'} disabled={imageAlignment === 'center'} onClick={() => setImageWrapText(true)}>Text beside</Button>
              </div>
              {imageAlignment === 'center' && <p className="text-xs text-muted-foreground">Choose left or right for text beside the image.</p>}
            </div>
          </div>
          <DialogFooter className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button type="button" variant="destructive" onClick={deleteSelectedImage}><Trash2 className="mr-1.5 h-4 w-4" />Delete</Button>
            <Button type="button" onClick={applyImageSettings}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={buttonOpen} onOpenChange={(open) => { setButtonOpen(open); if (!open) setEditingButton(null); }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-md overflow-y-auto rounded-md p-4">
          <DialogHeader><DialogTitle>{editingButton ? 'Update button' : 'Add button'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="email-button-text">Button name</Label><Input id="email-button-text" value={buttonText} maxLength={40} onChange={(event) => setButtonText(event.target.value)} placeholder="Complete my profile" /></div>
            <div className="space-y-1.5"><Label htmlFor="email-button-link">Button link</Label><Input id="email-button-link" value={buttonUrl} onChange={(event) => setButtonUrl(event.target.value)} placeholder="https://worklyindia.com/profile" /></div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5"><span className="text-sm font-medium">Button colour</span><span className="flex h-10 items-center gap-2 rounded-md border px-2"><input type="color" className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0" value={buttonBackground} onChange={(event) => setButtonBackground(event.target.value)} /><span className="text-xs text-muted-foreground">Background</span></span></label>
              <label className="space-y-1.5"><span className="text-sm font-medium">Text colour</span><span className="flex h-10 items-center gap-2 rounded-md border px-2"><input type="color" className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0" value={buttonColor} onChange={(event) => setButtonColor(event.target.value)} /><span className="text-xs text-muted-foreground">Text</span></span></label>
            </div>
            <div className="space-y-2"><Label>Text size: {buttonFontSize}px</Label><Slider value={[buttonFontSize]} min={10} max={34} step={1} onValueChange={(value) => setButtonFontSize(value[0])} /></div>
            <div className="space-y-2"><Label>Button width: {buttonPaddingX}px</Label><Slider value={[buttonPaddingX]} min={4} max={60} step={1} onValueChange={(value) => setButtonPaddingX(value[0])} /></div>
            <div className="space-y-2"><Label>Button height: {buttonPaddingY}px</Label><Slider value={[buttonPaddingY]} min={2} max={34} step={1} onValueChange={(value) => setButtonPaddingY(value[0])} /></div>
            <div className="space-y-2"><Label>Round corners: {buttonRadius}px</Label><Slider value={[buttonRadius]} min={0} max={30} step={2} onValueChange={(value) => setButtonRadius(value[0])} /></div>
            <div className="space-y-1.5"><Label>Position</Label><div className="grid grid-cols-3 gap-2">{(['left', 'center', 'right'] as const).map((alignment) => <Button key={alignment} type="button" size="sm" variant={buttonAlignment === alignment ? 'default' : 'outline'} onClick={() => { setButtonAlignment(alignment); if (alignment === 'center') setButtonWrapText(false); }} className="capitalize">{alignment}</Button>)}</div></div>
            <div className="space-y-1.5">
              <Label>Text position</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant={!buttonWrapText ? 'default' : 'outline'} onClick={() => setButtonWrapText(false)}>Text below</Button>
                <Button type="button" size="sm" variant={buttonWrapText ? 'default' : 'outline'} disabled={buttonAlignment === 'center'} onClick={() => setButtonWrapText(true)}>Text beside</Button>
              </div>
              {buttonAlignment === 'center' && <p className="text-xs text-muted-foreground">Choose left or right for text beside the button.</p>}
            </div>
            <div className="rounded-md border bg-muted/20 p-4" style={{ textAlign: buttonAlignment }}>
              <span style={{ display: 'inline-block', padding: buttonPadding, borderRadius: buttonRadius, backgroundColor: buttonBackground, color: buttonColor, fontSize: buttonFontSize, fontWeight: 700 }}>{buttonText || 'Button preview'}</span>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            {editingButton ? (
              <Button type="button" variant="destructive" onClick={removeButton}><Trash2 className="mr-1.5 h-4 w-4" />Remove</Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setButtonOpen(false)}>Cancel</Button>
            )}
            <Button type="button" onClick={saveButton} disabled={!buttonText.trim() || !/^(https?:\/\/|mailto:|tel:|\/)/i.test(buttonUrl.trim())}>{editingButton ? 'Update button' : 'Add button'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
});
