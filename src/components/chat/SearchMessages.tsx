import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface SearchMessagesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  onMessageClick: (messageId: string) => void;
}

export default function SearchMessages({ 
  open, 
  onOpenChange, 
  messages,
  onMessageClick 
}: SearchMessagesProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMessages = messages.filter(msg =>
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Search Messages</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in conversation..."
              className="pl-10"
              autoFocus
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {searchQuery && (
            <div className="mb-2 text-sm text-muted-foreground">
              {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''} found
            </div>
          )}
          
          {searchQuery ? (
            filteredMessages.length > 0 ? (
              <div className="space-y-2">
                {filteredMessages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => {
                      onMessageClick(message.id);
                      onOpenChange(false);
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-primary">
                        {message.role === 'user' ? 'You' : 'AI Assistant'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {message.timestamp}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2">
                      {message.content}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No messages found
              </div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Type to search messages
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
