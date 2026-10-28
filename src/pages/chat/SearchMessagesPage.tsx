import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { chatStorage } from '@/lib/chatStorage';
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function SearchMessagesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const storedMessages = chatStorage.loadMessages();
    setMessages(storedMessages);
  }, []);

  const filteredMessages = messages.filter(msg =>
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMessageClick = (messageId: string) => {
    navigate(`/ai-assistant?scrollTo=${messageId}`);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#075E54] shadow-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/ai-assistant')}
            className="shrink-0 text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="font-semibold text-white text-lg">Search Messages</h1>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-4 bg-background border-b">
        <div className="relative flex items-center gap-2">
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
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {searchQuery && (
            <div className="mb-4 text-sm text-muted-foreground">
              {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''} found
            </div>
          )}
          
          {searchQuery ? (
            filteredMessages.length > 0 ? (
              <div className="space-y-2">
                {filteredMessages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => handleMessageClick(message.id)}
                    className="w-full text-left p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-primary">
                        {message.role === 'user' ? 'You' : 'AI Assistant'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {message.timestamp}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-3">
                      {message.content}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No messages found
              </div>
            )
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <span className="mx-auto mb-3 opacity-20 inline-flex"><LottieSearchIcon size={48} /></span>
              <p>Type to search messages</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
