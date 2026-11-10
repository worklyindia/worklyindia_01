import { Button } from "@/components/ui/button";
import { 
  Trash2, 
  Reply, 
  Forward, 
  Copy, 
  X,
  Smile,
  Heart,
  Languages
} from "lucide-react";

interface MessageSelectionToolbarProps {
  selectedCount: number;
  onDelete?: () => void;
  onReply: () => void;
  onForward?: () => void;
  onCopy: () => void;
  onStar?: () => void;
  onReact?: () => void;
  onTranslate?: () => void;
  onCancel: () => void;
  canReply?: boolean; // Only when single message selected
  canCopy?: boolean; // Only for text messages
  canTranslate?: boolean; // Only when single text message selected
  /** "heart" shows a one-tap ❤️ toggle instead of the emoji picker icon. */
  reactIcon?: "smile" | "heart";
  reactActive?: boolean;
}

export function MessageSelectionToolbar({
  selectedCount,
  onDelete,
  onReply,
  onForward,
  onCopy,
  onStar,
  onReact,
  onTranslate,
  onCancel,
  canReply = true,
  canCopy = true,
  canTranslate = true,
  reactIcon = "smile",
  reactActive = false
}: MessageSelectionToolbarProps) {
  return (
    <div className="shrink-0 min-h-14 bg-whatsapp-bg text-foreground px-2 py-2 flex items-center gap-1 animate-in slide-in-from-top duration-200 border-b border-border overflow-x-auto">
      {/* Cancel Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="text-foreground hover:bg-muted h-10 w-10"
        aria-label="Cancel message selection"
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Selected Count */}
      <span className="text-foreground font-medium flex-shrink-0">
        {selectedCount}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action Buttons */}
      <div className="flex items-center gap-1">

        {/* Translate - Only for single text message selection */}
        {canTranslate && selectedCount === 1 && onTranslate && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onTranslate}
            className="text-foreground hover:bg-muted h-10 w-10"
            title="Translate"
            aria-label="Translate selected message"
          >
            <Languages className="h-5 w-5" />
          </Button>
        )}

        {/* React - Only for single selection */}
        {onReact && selectedCount === 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onReact}
            className="text-foreground hover:bg-muted h-10 w-10"
            title={reactIcon === "heart" ? (reactActive ? "Remove ❤️" : "React ❤️") : "React"}
            aria-label={reactIcon === "heart" ? (reactActive ? "Remove heart reaction" : "React with heart") : "React to selected message"}
            aria-pressed={reactIcon === "heart" ? reactActive : undefined}
          >
            {reactIcon === "heart"
              ? <Heart className="h-5 w-5" fill={reactActive ? "currentColor" : "none"} />
              : <Smile className="h-5 w-5" />}
          </Button>
        )}

        {/* Reply - Only for single selection */}
        {canReply && selectedCount === 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onReply}
            className="text-foreground hover:bg-muted h-10 w-10"
            title="Reply"
            aria-label="Reply to selected message"
          >
            <Reply className="h-5 w-5" />
          </Button>
        )}

        {/* Copy - Only for text messages */}
        {canCopy && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopy}
            className="text-foreground hover:bg-muted h-10 w-10"
            title="Copy"
            aria-label="Copy selected messages"
          >
            <Copy className="h-5 w-5" />
          </Button>
        )}

        {/* Forward */}
        {onForward && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onForward}
          className="text-foreground hover:bg-muted h-10 w-10"
          title="Forward"
          aria-label="Forward selected messages"
        >
          <Forward className="h-5 w-5" />
        </Button>
        )}

        {/* Delete */}
        {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-foreground hover:bg-muted h-10 w-10"
          title="Delete"
          aria-label="Delete selected messages"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
        )}
      </div>
    </div>
  );
}
