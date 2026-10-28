import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { chatStorage } from '@/lib/chatStorage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  starred?: boolean;
}

export default function StarredMessagesPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const storedMessages = chatStorage.loadMessages();
    setMessages(storedMessages);
  }, []);

  const starredMessages = messages.filter(msg => msg.starred);

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
          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
          <h1 className="font-semibold text-white text-lg">
            Starred Messages ({starredMessages.length})
          </h1>
        </div>
      </div>

      {/* Starred Messages List */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {starredMessages.length > 0 ? (
            <div className="space-y-3">
              {starredMessages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => handleMessageClick(message.id)}
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
                  <p className="text-sm whitespace-pre-wrap line-clamp-4">
                    {message.content}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Star className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg mb-1">No starred messages yet</p>
              <p className="text-sm">Double-click a message to star it</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
