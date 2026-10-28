import { useState } from 'react';
import { 
  Copy, 
  ThumbsUp, 
  ThumbsDown, 
  Volume2, 
  Share2, 
  MoreHorizontal, 
  Loader2,
  Flag,
  RefreshCw,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import TranslateIcon from '@/components/icons/TranslateIcon';

interface AssistantMessageActionsProps {
  messageId: string;
  content: string;
  feedback?: 'like' | 'dislike' | null;
  isPlaying?: boolean;
  isLoadingVoice?: boolean;
  voiceRemaining?: number;
  onCopy: () => void;
  onShare: () => void;
  onTranslate?: () => void;
  onSpeak: () => void;
  onFeedback: (type: 'like' | 'dislike') => void;
  onRegenerate?: () => void;
  onReport?: () => void;
  className?: string;
}

export function AssistantMessageActions({
  messageId,
  content,
  feedback,
  isPlaying = false,
  isLoadingVoice = false,
  voiceRemaining,
  onCopy,
  onShare,
  onTranslate,
  onSpeak,
  onFeedback,
  onRegenerate,
  onReport,
  className
}: AssistantMessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasContent = content && content.trim().length > 0;

  return (
    <div 
      className={cn(
        "flex items-center gap-0.5 mt-1 -ml-1",
        className
      )}
    >
      {/* Copy */}
      <ActionButton
        onClick={handleCopy}
        active={copied}
        title={copied ? "Copied!" : "Copy message"}
        aria-label="Copy message"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </ActionButton>

      {/* Thumbs Up */}
      <ActionButton
        onClick={() => onFeedback('like')}
        active={feedback === 'like'}
        title="Helpful"
        aria-label="Mark as helpful"
      >
        <ThumbsUp className={cn("w-3.5 h-3.5", feedback === 'like' && "fill-current")} />
      </ActionButton>

      {/* Thumbs Down */}
      <ActionButton
        onClick={() => onFeedback('dislike')}
        active={feedback === 'dislike'}
        title="Not helpful"
        aria-label="Mark as not helpful"
      >
        <ThumbsDown className={cn("w-3.5 h-3.5", feedback === 'dislike' && "fill-current")} />
      </ActionButton>

      {/* Speaker / TTS */}
      <ActionButton
        onClick={onSpeak}
        disabled={isLoadingVoice || !hasContent}
        title={voiceRemaining !== undefined && voiceRemaining <= 0 
          ? "Voice playback limit reached" 
          : isPlaying 
            ? "Stop speaking" 
            : "Read aloud"}
        aria-label={isPlaying ? "Stop speaking" : "Read aloud"}
      >
        {isLoadingVoice ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        ) : isPlaying ? (
          <Volume2 className="w-3.5 h-3.5 text-primary animate-voice-pulse" />
        ) : (
          <Volume2 className="w-3.5 h-3.5" />
        )}
      </ActionButton>

      {/* Share */}
      <ActionButton
        onClick={onShare}
        disabled={!hasContent}
        title="Share message"
        aria-label="Share message"
      >
        <Share2 className="w-3.5 h-3.5" />
      </ActionButton>

      {/* Translate */}
      {onTranslate && (
        <ActionButton
          onClick={onTranslate}
          disabled={!hasContent}
          title="Translate message"
          aria-label="Translate message"
        >
          <TranslateIcon size={14} />
        </ActionButton>
      )}

      {/* More Options */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-gray-500 hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="More options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 bg-white dark:bg-gray-900 z-50">
          {onRegenerate && (
            <DropdownMenuItem onClick={onRegenerate}>
              <RefreshCw className="mr-2 h-4 w-4" />
              <span>Regenerate</span>
            </DropdownMenuItem>
          )}
          {onReport && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onReport} className="text-destructive focus:text-destructive">
                <Flag className="mr-2 h-4 w-4" />
                <span>Report</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface ActionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  'aria-label'?: string;
}

function ActionButton({ children, onClick, disabled, active, title, 'aria-label': ariaLabel }: ActionButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        "h-7 w-7 rounded-full transition-colors",
        active 
          ? "text-primary bg-primary/10 hover:bg-primary/15 hover:text-primary" 
          : "text-gray-500 hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
      )}
    >
      {children}
    </Button>
  );
}
