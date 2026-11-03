import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, CheckCheck, Copy, ExternalLink, Phone, Reply, Star } from "lucide-react";
import { WhatsAppAudioPlayer } from "./WhatsAppAudioPlayer";
import { WhatsAppDocumentPreview } from "./WhatsAppDocumentPreview";
import { MessageStatusIcon, MessageStatus } from "./MessageStatusIcon";
import { MessageReactions, ReactionPicker } from "./MessageReactions";
import { MediaPreview } from "./MediaPreview";
import { WhatsAppText } from './WhatsAppText';
import { Button } from '@/components/ui/button';
import { whatsappWebHref } from '@/lib/whatsappLinks';
import { formatChatTime as formatTime12Hour } from '@/lib/chatTimestamp';

interface MessageReaction {
  emoji: string;
  userId: string;
  userName?: string;
}

interface WhatsAppMessageBubbleProps {
  id: string;
  content?: string | null;
  messageType: string;
  status: string;
  createdAt: string;
  isOutgoing: boolean;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | null;
  fileName?: string;
  reactions?: MessageReaction[];
  isSelected?: boolean;
  isSelectionMode?: boolean;
  isStarred?: boolean;
  replyTo?: {
    content: string;
    senderName: string;
  } | null;
  onSelect?: () => void;
  onLongPress?: () => void;
  onClick?: () => void;
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  currentUserId?: string;
  metadata?: {
    is_template?: boolean;
    template_name?: string;
    template_components?: any[];
    variables?: Record<string, string>;
  } | null;
}

// Helper function to check if content is a valid caption (not template placeholder)
const isValidCaption = (text: string | null | undefined): boolean => {
  if (!text || text.trim() === '') return false;
  
  const lowerText = text.toLowerCase().trim();
  
  // Patterns that indicate this is NOT a real user caption
  const invalidPatterns = [
    '[template:',
    '[template: ',
    'template:',
    'media_message',
    '[media_message]',
    '[message]',
    'template: media_message',
  ];
  
  // If text matches any invalid pattern, it's not a valid caption
  if (invalidPatterns.some(pattern => lowerText.includes(pattern))) {
    return false;
  }
  
  // Extra check: if the entire text is just a template placeholder pattern
  if (lowerText.startsWith('[') && lowerText.endsWith(']')) {
    return false;
  }
  
  return true;
};

export function WhatsAppMessageBubble({
  id,
  content,
  messageType,
  status,
  createdAt,
  isOutgoing,
  mediaUrl,
  mediaType,
  fileName,
  reactions = [],
  isSelected = false,
  isSelectionMode = false,
  isStarred = false,
  replyTo,
  onSelect,
  onLongPress,
  onClick,
  onReact,
  onReply,
  currentUserId,
  metadata
}: WhatsAppMessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressing = useRef(false);
  const wasTouchMoved = useRef(false);
  const touchStartPos = useRef<{x: number, y: number} | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const lastTouchAt = useRef(0);
  // Any scroll (including momentum) cancels a pending long press
  useEffect(() => {
    const onScroll = () => {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      wasTouchMoved.current = true;
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);

  // Start long press detection
  const startLongPress = () => {
    cancelLongPressTimerOnly();
    isLongPressing.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPressing.current = true;
      if (onLongPress) {
        // Vibrate if supported (mobile)
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        onLongPress();
      }
    }, 500);
  };

  function cancelLongPressTimerOnly() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }

  // Cancel long press timer
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    lastTouchAt.current = Date.now();
    // Multi-finger gestures (e.g. 3-finger screenshot) must never select
    if (e.touches.length > 1) { cancelLongPress(); wasTouchMoved.current = true; return; }
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    wasTouchMoved.current = false;
    isLongPressing.current = false; // Reset before starting new long press detection
    startLongPress();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    cancelLongPress();
    isLongPressing.current = false;
    touchStartPos.current = null;
    // Selection is handled by onClick for reliability
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) { cancelLongPress(); wasTouchMoved.current = true; return; }
    if (touchStartPos.current) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
      // Only mark as moved if finger traveled more than 10px (actual scroll)
      if (deltaX > 10 || deltaY > 10) {
        wasTouchMoved.current = true;
        cancelLongPress();
      }
    }
  };

  // Mouse events for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Ignore emulated mouse events that follow touches
    if (Date.now() - lastTouchAt.current < 1000) return;
    wasTouchMoved.current = false;
    startLongPress();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelLongPress();
    isLongPressing.current = false;
    // Selection is handled by onClick for reliability
  };

  const handleMouseLeave = () => {
    cancelLongPress();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // In selection mode, use onClick for reliable selection (same pattern as conversation)
    if (isSelectionMode && !wasTouchMoved.current && onSelect) {
      e.preventDefault();
      onSelect();
      return;
    }
    // Call onClick for double-click detection (star functionality)
    if (onClick && !wasTouchMoved.current) {
      onClick();
    }
  };

  // Check if this is a template message
  const isTemplateMessage = messageType === 'template' || metadata?.is_template;

  const renderContent = () => {
    // Helper to check if caption should be shown for media
    const shouldShowCaption = isValidCaption(content) && 
      !content?.toLowerCase().includes('template') &&
      !content?.toLowerCase().includes('[message');
    
    // Audio message
    if (mediaType === 'audio' && mediaUrl) {
      return (
        <div>
          <WhatsAppAudioPlayer url={mediaUrl} isOutgoing={isOutgoing} />
          {shouldShowCaption && (
            <p className="text-sm px-1 mt-2 whitespace-pre-wrap leading-relaxed">
              {content}
            </p>
          )}
        </div>
      );
    }

    // Document message
    if (mediaType === 'document' && mediaUrl) {
      return (
        <div>
          <WhatsAppDocumentPreview 
            url={mediaUrl} 
            fileName={fileName} 
            isOutgoing={isOutgoing}
          />
          {shouldShowCaption && (
            <p className="text-sm px-1 mt-2 whitespace-pre-wrap leading-relaxed">
              {content}
            </p>
          )}
        </div>
      );
    }

    // Image/Video message with optional caption
    if ((mediaType === 'image' || mediaType === 'video') && mediaUrl) {
      return (
        <div className="relative overflow-hidden rounded-xl">
          <MediaPreview url={mediaUrl} type={mediaType} fileName={fileName} />
          {shouldShowCaption ? (
            <p className="text-sm px-2 pt-2 whitespace-pre-wrap leading-relaxed">
              {content}
            </p>
          ) : (
            <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-foreground/50 px-2 py-0.5 text-background">
              {isStarred && <Star className="h-3 w-3 fill-current" />}
              <span className="text-[10px]">{formatTime12Hour(createdAt)}</span>
              {isOutgoing && <MessageStatusIcon status={status as MessageStatus} />}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // Render template message exactly like a real WhatsApp template bubble
  const renderTemplateContent = () => {
    const components = metadata?.template_components || [];
    const find = (t: string) => components.find((c: any) => String(c.type).toUpperCase() === t);
    const headerComponent = find('HEADER');
    const bodyComponent = find('BODY');
    const footerComponent = find('FOOTER');
    const buttons: any[] = find('BUTTONS')?.buttons || [];
    const headerFormat = String(headerComponent?.format || '').toUpperCase();
    const headerMedia = (metadata as any)?.header_media_url || headerComponent?.example?.header_handle?.[0];
    const visibleButtons = buttons.length > 3 ? buttons.slice(0, 2) : buttons;

    const getButtonIcon = (buttonType: string) => {
      switch (buttonType?.toUpperCase()) {
        case 'URL': return <ExternalLink className="h-4 w-4" />;
        case 'PHONE_NUMBER': return <Phone className="h-4 w-4" />;
        case 'COPY_CODE': case 'OTP': return <Copy className="h-4 w-4" />;
        default: return <Reply className="h-4 w-4" />;
      }
    };

    const onButton = (button: any) => {
      const type = String(button.type).toUpperCase();
      const href = whatsappWebHref(button.url);
      if (type === 'URL' && href) window.open(href, '_blank', 'noopener,noreferrer');
      else if (type === 'PHONE_NUMBER' && button.phone_number) window.open(`tel:${button.phone_number}`, '_self');
      else if (type === 'COPY_CODE' || type === 'OTP') navigator.clipboard.writeText(String(button.example?.[0] || content || ''));
    };

    return (
      <div className="w-[280px] max-w-full overflow-hidden">
        <div className={headerFormat && headerFormat !== 'TEXT' ? 'p-1' : ''}>
          {headerFormat === 'IMAGE' && (
            headerMedia ? (
              <img loading="lazy" decoding="async" src={headerMedia} alt="Template header"
                className="block w-full h-auto rounded-md"
              />
            ) : <div className="w-full aspect-[1.91/1] rounded-md bg-muted" />
          )}
          {headerFormat === 'VIDEO' && (
            headerMedia ? <video src={headerMedia} controls className="w-full max-h-64 rounded-md bg-muted" />
              : <div className="h-32 w-full rounded-md bg-muted" />
          )}
          {headerFormat === 'DOCUMENT' && (
            <a href={headerMedia || '#'} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 rounded-md bg-muted px-3 py-3 text-sm text-foreground">
              📄 <span className="truncate">Document</span>
            </a>
          )}
        </div>
        <div className="px-2.5 pb-1.5">
          {headerFormat === 'TEXT' && headerComponent?.text && (
             <p className="font-semibold text-sm mb-1 text-foreground"><WhatsAppText text={headerComponent.text} /></p>
          )}
          <div className="text-[15px] whitespace-pre-wrap leading-snug text-foreground break-words [&_a]:text-whatsapp-green [&_a]:underline">
            <WhatsAppText text={content || bodyComponent?.text} />
          </div>
          {footerComponent?.text && (
            <p className="text-[13px] mt-1 text-muted-foreground"><WhatsAppText text={footerComponent.text} /></p>
          )}
          <div className="flex items-center justify-end gap-1 -mt-1">
            {isStarred && <Star className="h-3 w-3 fill-current text-muted-foreground" />}
            <span className="text-[10px] text-muted-foreground">{formatTime12Hour(createdAt)}</span>
            {isOutgoing && <MessageStatusIcon status={status as MessageStatus} />}
          </div>
        </div>
        {visibleButtons.map((button: any, idx: number) => (
          <Button key={idx} type="button" variant="ghost"
            onClick={(e) => { e.stopPropagation(); onButton(button); }}
            className="flex h-auto w-full items-center justify-center gap-2 whitespace-normal rounded-none border-t border-border/60 px-3 py-2.5 text-[15px] font-medium text-whatsapp-green">
            {getButtonIcon(button.type)}<span>{button.text}</span>
          </Button>
        ))}
        {buttons.length > 3 && (
          <div className="flex w-full items-center justify-center gap-2 border-t border-border/60 px-3 py-2.5 text-[15px] font-medium text-whatsapp-green">
            <Reply className="h-4 w-4" /><span>See all options</span>
          </div>
        )}
      </div>
    );
  };

  // Emoji validation - only allow actual emojis, not text like "reaction"
  const isValidEmoji = (str: string) => {
    if (!str || str.trim() === '') return false;
    // Blacklist common invalid values
    const invalidValues = ['reaction', 'remove', 'null', 'undefined', ''];
    if (invalidValues.includes(str.toLowerCase().trim())) return false;
    // Must be short (emojis are typically 1-4 characters when accounting for modifiers)
    if (str.trim().length > 10) return false;
    // Check if string contains only emoji characters (Unicode emoji ranges)
    // Using a simpler check - must not contain regular letters a-z
    if (/^[a-zA-Z]+$/.test(str.trim())) return false;
    return true;
  };

  // Filter out invalid reactions (non-emoji strings like "reaction", empty values)
  const validReactions = reactions.filter(r => 
    r.emoji && 
    isValidEmoji(r.emoji) && 
    r.userId && 
    r.userId.trim() !== ''
  );
  
  return (
    <>
      <div
        className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200 group ${validReactions.length > 0 ? 'pb-4' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchCancel={() => { cancelLongPress(); touchStartPos.current = null; }}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ 
          WebkitUserSelect: 'none', 
          userSelect: 'none',
          WebkitTouchCallout: 'none'
        } as React.CSSProperties}
      >
        {/* Selection Checkbox */}
        {isSelectionMode && (
          <div className={`flex items-center mr-2 ${isOutgoing ? 'order-2 ml-2 mr-0' : ''}`}>
            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              isSelected 
                ? 'bg-foreground border-foreground' 
                : 'border-muted-foreground bg-transparent'
            }`}>
              {isSelected && <Check className="h-3 w-3 text-background" />}
            </div>
          </div>
        )}

        <div
          className={`relative max-w-[85%] md:max-w-[65%] rounded-lg transition-all ${
            mediaUrl && !isTemplateMessage ? `${isOutgoing ? 'bg-whatsapp-green-light' : 'bg-card'} text-foreground p-1 rounded-xl shadow-sm` : isTemplateMessage 
              ? isOutgoing 
                ? 'bg-whatsapp-green-light text-foreground rounded-tr-none' 
                : 'bg-card text-foreground rounded-tl-none'
              : isOutgoing
                ? 'bg-whatsapp-green-light text-foreground rounded-tr-none'
                : 'bg-card text-foreground rounded-tl-none'
          }`}
        >
          {/* Reply Preview */}
          {replyTo && (
            <div className={`mx-1 mt-1 px-2 py-1 rounded border-l-4 ${
              isOutgoing 
                ? 'bg-[#025144] border-[#00A884]' 
                : 'bg-gray-100 border-[#00A884]'
            }`}>
              <p className={`text-xs font-medium ${isOutgoing ? 'text-[#00A884]' : 'text-[#00A884]'}`}>
                {replyTo.senderName}
              </p>
              <p className={`text-xs truncate ${isOutgoing ? 'text-white/70' : 'text-gray-500'}`}>
                {replyTo.content}
              </p>
            </div>
          )}

          {/* Message Content */}
          <div className={`overflow-hidden rounded-lg ${isTemplateMessage ? '' : mediaUrl && (mediaType === 'image' || mediaType === 'video') ? '' : 'px-3 py-2'}`}>
            {renderContent()}
            
            {/* Template Message with special styling */}
            {isTemplateMessage ? (
              renderTemplateContent()
            ) : (
              // Only show text content if NOT a media message AND is valid caption
              !mediaUrl && isValidCaption(content) && (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {content}
                </p>
              )
            )}

            {/* Time, Star and Status - only show for non-template messages (template has its own) */}
            {!isTemplateMessage && !(mediaUrl && (mediaType === 'image' || mediaType === 'video') && !isValidCaption(content)) && (
              <div className={`flex items-center gap-1 mt-1 ${mediaUrl ? 'px-2 pb-1' : ''} ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                {isStarred && (
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                )}
                <span className="text-[10px] text-muted-foreground">
                  {formatTime12Hour(createdAt)}
                </span>
                {isOutgoing && <MessageStatusIcon status={status as MessageStatus} />}
              </div>
            )}
          </div>
          
          {/* Reactions Display - WhatsApp Style Badge at Bottom Right - lower z-index so input covers it */}
          {validReactions.length > 0 && (
            <div className={`absolute -bottom-3 z-[5] ${isOutgoing ? 'right-2' : 'left-2'}`}>
              <div className="flex items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-0.5 text-card-foreground shadow-md">
                {/* Show unique emojis */}
                {[...new Set(validReactions.map(r => r.emoji))].slice(0, 3).map((emoji, idx) => (
                  <span key={idx} className="text-sm leading-none">{emoji}</span>
                ))}
                {validReactions.length > 1 && (
                  <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">{validReactions.length}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reaction Picker Modal */}
      {showReactionPicker && (
        <ReactionPicker
          onSelect={(emoji) => {
            onReact?.(emoji);
            setShowReactionPicker(false);
          }}
          onClose={() => setShowReactionPicker(false)}
        />
      )}
    </>
  );
}
