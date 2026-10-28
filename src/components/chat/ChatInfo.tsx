import { Bot, MessageCircle, Image, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VerificationBadge from '@/components/VerificationBadge';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';

interface ChatInfoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageCount: number;
  mediaCount: number;
  createdDate: string;
}

export default function ChatInfo({ 
  open, 
  onOpenChange, 
  messageCount,
  mediaCount,
  createdDate
}: ChatInfoProps) {
  const { data: chatSettings } = useAIChatSettings();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chat Info</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Profile Section */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-3">
              <img referrerPolicy="no-referrer" loading="lazy" decoding="async" 
                src={chatSettings.avatar_url} 
                alt={chatSettings.name} 
                className="w-24 h-24 rounded-full object-cover border-4 border-primary/20"
              />
              {chatSettings.verification_enabled && (
                <div className="absolute bottom-0 right-0">
                  <VerificationBadge color={chatSettings.verification_color} size={24} />
                </div>
              )}
            </div>
            <h3 className="text-xl font-semibold mb-1">{chatSettings.name}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Bot className="h-4 w-4" />
              <span>{chatSettings.tagline}</span>
            </div>
          </div>

          {/* Stats Section */}
          <div className="space-y-3 bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span>Messages</span>
              </div>
              <span className="font-semibold">{messageCount}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Image className="h-4 w-4 text-primary" />
                <span>Media</span>
              </div>
              <span className="font-semibold">{mediaCount}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Created</span>
              </div>
              <span className="font-semibold text-sm">{createdDate}</span>
            </div>
          </div>

          {/* About Section */}
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              Your AI-powered career assistant for remote job opportunities in India.
            </p>
            <p>
              Get help with job search, applications, career advice, and platform support.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
