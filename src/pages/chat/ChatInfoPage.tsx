import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, MessageCircle, Image, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { chatStorage } from '@/lib/chatStorage';
import VerificationBadge from '@/components/VerificationBadge';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';
import LottieProfileIcon from '@/components/LottieProfileIcon';

export default function ChatInfoPage() {
  const navigate = useNavigate();
  const { data: chatSettings, isLoading } = useAIChatSettings();
  const [messageCount, setMessageCount] = useState(0);
  const [mediaCount, setMediaCount] = useState(0);

  useEffect(() => {
    const messages = chatStorage.loadMessages();
    setMessageCount(messages.length);
    setMediaCount(messages.filter(m => m.imageUrls && m.imageUrls.length > 0).length);
  }, []);

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
          <h1 className="font-semibold text-white text-lg">Chat Info</h1>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Profile Section */}
          <div className="flex flex-col items-center text-center">
            {isLoading ? (
              <div className="w-32 h-32 rounded-full bg-muted animate-pulse mb-4" />
            ) : (
              <div className="relative mb-4">
                <div className="w-32 h-32 rounded-full border-4 border-primary/20 bg-white flex items-center justify-center overflow-hidden">
                  <LottieProfileIcon size={112} />
                </div>
                {chatSettings.verification_enabled && (
                  <div className="absolute bottom-0 right-0">
                    <VerificationBadge color={chatSettings.verification_color} size={28} />
                  </div>
                )}
              </div>
            )}
            <h2 className="text-2xl font-semibold mb-2">
              {isLoading ? 'Loading...' : chatSettings.name}
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="h-4 w-4" />
              <span>{isLoading ? 'Loading...' : chatSettings.tagline}</span>
            </div>
          </div>

          {/* Stats Section */}
          <div className="space-y-1 bg-muted/50 rounded-xl p-4">
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Total Messages</span>
              </div>
              <span className="font-semibold text-lg">{messageCount}</span>
            </div>
            
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex items-center gap-3">
                <Image className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Media Shared</span>
              </div>
              <span className="font-semibold text-lg">{mediaCount}</span>
            </div>
            
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Chat Created</span>
              </div>
              <span className="font-semibold text-sm">{new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* About Section */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-lg">About</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your AI-powered career assistant for remote job opportunities in India.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Get instant help with job search, application tips, career advice, interview preparation, and platform support - all in one place.
            </p>
          </div>

          {/* Features Section */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-lg">Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Real-time job recommendations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Resume and cover letter assistance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Interview preparation tips</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Career guidance and advice</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Platform support and navigation help</span>
              </li>
            </ul>
          </div>

          {/* Subscription Management */}
          <Button
            onClick={() => navigate('/ai-assistant/subscription')}
            className="w-full"
            size="lg"
          >
            Manage Subscription
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}
