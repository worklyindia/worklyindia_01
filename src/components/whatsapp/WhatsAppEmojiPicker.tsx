import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface WhatsAppEmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

const emojiCategories = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
  'Gestures': ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤝', '👏', '🙌', '👐', '🤲', '🤚', '✋', '🖐️', '👋', '🤙', '💪', '🙏', '✌️', '🤟', '🤘', '👌', '🤏', '👈', '👉', '👆', '👇', '☝️', '🖕', '💅', '🤳'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
  'Objects': ['💼', '📱', '💻', '🖥️', '📷', '📹', '🎥', '📞', '☎️', '📧', '✉️', '📝', '📄', '📃', '📑', '📊', '📈', '📉', '🗂️', '📁', '📂', '🗃️', '🗄️', '📌', '📍', '✂️', '🖊️', '✏️', '📐', '📏'],
  'Symbols': ['✅', '❌', '⭐', '🌟', '💫', '✨', '🔥', '💯', '⚡', '💥', '🎯', '🏆', '🎉', '🎊', '🎁', '💰', '💵', '💸', '📢', '🔔', '🔕', '⏰', '⏳', '💡', '🔒', '🔓'],
};

export function WhatsAppEmojiPicker({ onEmojiSelect, disabled }: WhatsAppEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Smileys');

  const handleSelect = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          disabled={disabled}
          className="text-whatsapp-icon hover:bg-whatsapp-hover h-10 w-10 flex-shrink-0"
        >
          <Smile className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 bg-whatsapp-header border-whatsapp-border"
        side="top"
        align="start"
      >
        {/* Category Tabs */}
        <div className="flex border-b border-whatsapp-border overflow-x-auto">
          {Object.keys(emojiCategories).map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-3 py-2 text-xs whitespace-nowrap transition-colors ${
                activeCategory === category 
                  ? 'text-whatsapp-green border-b-2 border-whatsapp-green bg-whatsapp-hover' 
                  : 'text-whatsapp-secondary hover:bg-whatsapp-hover'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        
        {/* Emoji Grid */}
        <ScrollArea className="h-48">
          <div className="grid grid-cols-8 gap-1 p-2">
            {emojiCategories[activeCategory as keyof typeof emojiCategories].map((emoji, index) => (
              <button
                key={index}
                onClick={() => handleSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center text-xl hover:bg-whatsapp-hover rounded transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
