import { Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  starred?: boolean;
}

interface StarredMessagesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  onMessageClick: (messageId: string) => void;
}

export default function StarredMessages({ 
  open, 
  onOpenChange, 
  messages,
  onMessageClick 
}: StarredMessagesProps) {
  const starredMessages = messages.filter(msg => msg.starred);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            Starred Messages ({starredMessages.length})
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[500px]">
          {starredMessages.length > 0 ? (
            <div className="space-y-3">
              {starredMessages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => {
                    onMessageClick(message.id);
                    onOpenChange(false);
                  }}
                  className="w-full text-left p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-primary">
                      {message.role === 'user' ? 'You' : 'AI Assistant'}
                    </span>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs text-muted-foreground">
                        {message.timestamp}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No starred messages yet</p>
              <p className="text-xs mt-1">Long press a message to star it</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
