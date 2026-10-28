import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Smile } from "lucide-react";

interface Reaction {
  emoji: string;
  userId: string;
  userName?: string;
}

interface MessageReactionsProps {
  reactions?: Reaction[];
  onAddReaction: (emoji: string) => void;
  onRemoveReaction?: (emoji: string) => void;
  currentUserId?: string;
  compact?: boolean;
}

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🙏'];

export function MessageReactions({
  reactions = [],
  onAddReaction,
  onRemoveReaction,
  currentUserId,
  compact = false
}: MessageReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = [];
    }
    acc[r.emoji].push(r);
    return acc;
  }, {} as Record<string, Reaction[]>);

  const handleReactionClick = (emoji: string) => {
    const hasMyReaction = reactions.some(
      r => r.emoji === emoji && r.userId === currentUserId
    );
    
    if (hasMyReaction && onRemoveReaction) {
      onRemoveReaction(emoji);
    } else {
      onAddReaction(emoji);
    }
    setIsOpen(false);
  };

  // Get user names for tooltip
  const getUserNames = (reactionList: Reaction[]) => {
    return reactionList
      .map(r => r.userName || 'Unknown')
      .join(', ');
  };

  if (reactions.length === 0 && compact) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {/* Existing Reactions Display with Tooltips */}
      <TooltipProvider>
        {Object.entries(groupedReactions).map(([emoji, reactionList]) => {
          const hasMyReaction = reactionList.some(r => r.userId === currentUserId);
          return (
            <Tooltip key={emoji}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleReactionClick(emoji)}
                  className={`inline-flex items-center gap-px px-1 py-px rounded-full text-xs shadow-sm transition-all ${
                    hasMyReaction
                      ? 'bg-[#00A884]/30 border border-[#00A884]/60'
                      : 'bg-white/90 hover:bg-white border border-gray-200/60'
                  }`}
                >
                  <span className="text-xs leading-none">{emoji}</span>
                  {reactionList.length > 1 && (
                    <span className="text-gray-600 text-[10px] font-medium">{reactionList.length}</span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs bg-gray-900 text-white">
                {getUserNames(reactionList)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>

      {/* Add Reaction Button */}
      {!compact && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
            >
              <Smile className="h-3 w-3 text-gray-500" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            side="top" 
            align="start" 
            className="w-auto p-1.5 bg-white shadow-lg rounded-full border-0"
          >
            <div className="flex gap-0.5">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReactionClick(emoji)}
                  className="h-7 w-7 flex items-center justify-center text-base hover:bg-gray-100 rounded-full transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// Full emoji categories for reaction picker
const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
  'Gestures': ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤝', '👏', '🙌', '👐', '🤲', '🤚', '✋', '🖐️', '👋', '🤙', '💪', '🙏', '✌️', '🤟', '🤘', '👌', '🤏', '👈', '👉', '👆', '👇', '☝️', '🖕', '💅', '🤳'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
  'Objects': ['💼', '📱', '💻', '🖥️', '📷', '📹', '🎥', '📞', '☎️', '📧', '✉️', '📝', '📄', '📃', '📑', '📊', '📈', '📉', '🗂️', '📁', '📂', '🗃️', '🗄️', '📌', '📍', '✂️', '🖊️', '✏️', '📐', '📏'],
  'Symbols': ['✅', '❌', '⭐', '🌟', '💫', '✨', '🔥', '💯', '⚡', '💥', '🎯', '🏆', '🎉', '🎊', '🎁', '💰', '💵', '💸', '📢', '🔔', '🔕', '⏰', '⏳', '💡', '🔒', '🔓'],
};

// Floating reaction picker for long press - FULL VERSION with all emojis
export function ReactionPicker({
  onSelect,
  onClose,
  onRemove,
  currentReaction
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  onRemove?: () => void;
  currentReaction?: string;
}) {
  const [activeCategory, setActiveCategory] = useState('Smileys');

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in duration-200 pb-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-sm animate-in slide-in-from-bottom duration-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Quick Reactions Row */}
        <div className="flex justify-around p-3 border-b border-gray-100">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              className={`h-10 w-10 flex items-center justify-center text-2xl rounded-full transition-all hover:scale-125 active:scale-110 ${
                currentReaction === emoji ? 'bg-[#00A884]/20 ring-2 ring-[#00A884]' : 'hover:bg-gray-100'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto px-2">
          {Object.keys(EMOJI_CATEGORIES).map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-3 py-2 text-xs whitespace-nowrap transition-colors ${
                activeCategory === category 
                  ? 'text-[#00A884] border-b-2 border-[#00A884] font-medium' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        
        {/* Emoji Grid */}
        <div className="h-48 overflow-y-auto p-2">
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, index) => (
              <button
                key={index}
                onClick={() => {
                  onSelect(emoji);
                  onClose();
                }}
                className={`w-9 h-9 flex items-center justify-center text-xl rounded transition-all hover:bg-gray-100 hover:scale-110 ${
                  currentReaction === emoji ? 'bg-[#00A884]/20' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Remove Reaction Button - Only show if user has reacted */}
        {currentReaction && onRemove && (
          <div className="border-t border-gray-100 p-3">
            <button
              onClick={() => {
                onRemove();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <span className="text-lg">✕</span>
              <span className="text-sm font-medium">Remove Reaction</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}