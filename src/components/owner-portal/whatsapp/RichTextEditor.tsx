import { useState, useRef, useMemo, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, Strikethrough, Code, Plus, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

const COMMON_EMOJIS = ["😊", "👍", "🎉", "❤️", "🔥", "✅", "⭐", "💯", "🙏", "👋", "📦", "🚚", "💰", "📞", "📧", "🔔"];

export const RichTextEditor = memo(function RichTextEditor({ value, onChange, placeholder, maxLength = 1024 }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Calculate variable count from current value using useMemo
  const variableInfo = useMemo(() => {
    const matches = value.match(/\{\{(\d+)\}\}/g);
    const count = matches ? matches.length : 0;
    const maxVar = matches ? Math.max(...matches.map(m => parseInt(m.replace(/\D/g, '')))) : 0;
    return { count, maxVar };
  }, [value]);

  const insertAtCursor = useCallback((before: string, after: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    onChange(newText);
    
    // Reset cursor position
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }, [value, onChange]);

  const wrapSelection = useCallback((wrapper: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    if (selectedText) {
      const newText = value.substring(0, start) + wrapper + selectedText + wrapper + value.substring(end);
      onChange(newText);
    } else {
      insertAtCursor(wrapper, wrapper);
    }
  }, [value, onChange, insertAtCursor]);

  const addVariable = useCallback(() => {
    const newVarNum = variableInfo.maxVar + 1;
    insertAtCursor(`{{${newVarNum}}}`);
  }, [variableInfo.maxVar, insertAtCursor]);

  const addEmoji = useCallback((emoji: string) => {
    insertAtCursor(emoji);
    setEmojiOpen(false);
  }, [insertAtCursor]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap bg-muted/50 rounded-lg p-1">
        {/* Emoji Picker */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" type="button">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-8 gap-1">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="text-lg hover:bg-muted p-1 rounded"
                  onClick={() => addEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Formatting buttons */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 font-bold"
          onClick={() => wrapSelection("*")}
          title="Bold (*text*)"
          type="button"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 italic"
          onClick={() => wrapSelection("_")}
          title="Italic (_text_)"
          type="button"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 line-through"
          onClick={() => wrapSelection("~")}
          title="Strikethrough (~text~)"
          type="button"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => wrapSelection("```")}
          title="Monospace (```text```)"
          type="button"
        >
          <Code className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Add Variable */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs gap-1"
          onClick={addVariable}
          type="button"
        >
          <Plus className="h-3 w-3" />
          Variable
        </Button>

        {/* Character count */}
        <div className="ml-auto text-xs text-muted-foreground px-2">
          {value.length}/{maxLength}
        </div>
      </div>

      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={5}
        className="resize-none font-mono text-sm"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
      />

      {/* Variable count */}
      {variableInfo.count > 0 && (
        <p className="text-xs text-muted-foreground">
          Variables used: {variableInfo.count}
        </p>
      )}
    </div>
  );
});