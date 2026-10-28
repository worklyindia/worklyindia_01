import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, CheckCircle, Loader2, X, ExternalLink, BadgeCheck, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ConfirmDisconnectDialog from '@/components/social/ConfirmDisconnectDialog';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginButtonProps {
  botUsername: string;
  onSuccess?: (user: TelegramUser) => void;
  onError?: (error: string) => void;
  userType: 'profile' | 'company';
  userId: string;
  companyId?: string;
  currentTelegramUsername?: string | null;
  currentTelegramId?: number | null;
  currentTelegramChatId?: number | null;
  onDisconnect?: () => void;
  onChatIdReceived?: () => void;
}

const TelegramLoginButton: React.FC<TelegramLoginButtonProps> = ({
  botUsername,
  onSuccess,
  onError,
  userType,
  userId,
  companyId,
  currentTelegramUsername,
  currentTelegramId,
  currentTelegramChatId,
  onDisconnect,
  onChatIdReceived
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(!!currentTelegramId);
  const [chatId, setChatId] = useState<number | null>(currentTelegramChatId || null);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(currentTelegramUsername || null);
  const [telegramId, setTelegramId] = useState<number | null>(currentTelegramId || null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsConnected(!!currentTelegramId);
    setTelegramId(currentTelegramId || null);
  }, [currentTelegramId]);

  useEffect(() => {
    setChatId(currentTelegramChatId || null);
  }, [currentTelegramChatId]);

  useEffect(() => {
    setTelegramUsername(currentTelegramUsername || null);
  }, [currentTelegramUsername]);

  // Real-time subscription for Telegram field updates
  useEffect(() => {
    const table = userType === 'profile' ? 'profiles' : 'companies';
    const filterField = userType === 'profile' ? 'user_id' : 'id';
    const filterValue = userType === 'profile' ? userId : companyId;

    if (!filterValue) return;

    const channel = supabase
      .channel(`telegram-${userType}-${filterValue}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: table,
          filter: `${filterField}=eq.${filterValue}`
        },
        (payload) => {
          const newData = payload.new as any;
          console.log('📱 Telegram realtime update:', newData);
          
          // Update local state with new Telegram data
          if (newData.telegram_id !== undefined) {
            setTelegramId(newData.telegram_id);
            setIsConnected(!!newData.telegram_id);
          }
          if (newData.telegram_username !== undefined) {
            setTelegramUsername(newData.telegram_username);
          }
          if (newData.telegram_chat_id !== undefined) {
            setChatId(newData.telegram_chat_id);
            if (newData.telegram_chat_id) {
              onChatIdReceived?.();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userType, userId, companyId, onChatIdReceived]);

  // Define the callback globally
  useEffect(() => {
    (window as any).onTelegramAuth = async (user: TelegramUser) => {
      setIsLoading(true);
      try {
        // Verify and save Telegram data via edge function
        const { data, error } = await supabase.functions.invoke('email-api/telegram', {
          body: {
            action: 'login_verify',
            telegramUser: user,
            userType,
            userId,
            companyId
          }
        });

        if (error) throw error;

        if (data?.success) {
          setIsConnected(true);
          toast({
            title: "Telegram Connected! ✅",
            description: `Connected with @${user.username || user.first_name}`,
          });
          onSuccess?.(user);
        } else {
          throw new Error(data?.error || 'Verification failed');
        }
      } catch (err: any) {
        console.error('Telegram auth error:', err);
        toast({
          title: "Connection Failed",
          description: err.message || "Could not connect to Telegram",
          variant: "destructive"
        });
        onError?.(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [userType, userId, companyId, onSuccess, onError, toast]);

  // Load Telegram Widget script
  useEffect(() => {
    if (!botUsername || isConnected) return;

    setWidgetLoaded(false);
    setShowFallback(false);

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    script.onload = () => {
      setWidgetLoaded(true);
    };

    if (widgetRef.current) {
      widgetRef.current.innerHTML = '';
      widgetRef.current.appendChild(script);
    }

    // Fallback timeout - show fallback button if widget doesn't load in 3 seconds
    const fallbackTimer = setTimeout(() => {
      if (!widgetLoaded) {
        setShowFallback(true);
      }
    }, 3000);

    return () => {
      clearTimeout(fallbackTimer);
      if (widgetRef.current) {
        widgetRef.current.innerHTML = '';
      }
    };
  }, [botUsername, isConnected]);

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      const table = userType === 'profile' ? 'profiles' : 'companies';
      const idField = userType === 'profile' ? 'user_id' : 'id';
      const idValue = userType === 'profile' ? userId : companyId;

      const { error } = await supabase
        .from(table)
        .update({
          telegram_id: null,
          telegram_username: null,
          telegram_connected_at: null,
          telegram_notifications_enabled: false,
          telegram_chat_id: null
        })
        .eq(idField, idValue);

      // State will be updated via realtime subscription
      setIsConnected(false);
      setChatId(null);
      setTelegramId(null);
      setTelegramUsername(null);
      toast({
        title: "Telegram Disconnected",
        description: "Your Telegram account has been disconnected",
      });
      onDisconnect?.();
    } catch (err: any) {
      console.error('Disconnect error:', err);
      toast({
        title: "Error",
        description: "Could not disconnect Telegram",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartChat = () => {
    if (botUsername && telegramId) {
      window.open(`https://t.me/${botUsername}?start=${telegramId}`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg">
        <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Processing...</span>
      </div>
    );
  }

  if (isConnected) {
    const isVerified = !!chatId;
    
    return (
      <div className="p-4 bg-[hsl(200,80%,95%)] dark:bg-[hsl(200,50%,15%)] rounded-lg border border-[hsl(200,80%,70%)] dark:border-[hsl(200,50%,30%)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[hsl(200,80%,50%)] flex items-center justify-center flex-shrink-0">
            <Send className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">Telegram Connected</span>
              {isVerified ? (
                <BadgeCheck className="w-5 h-5 text-[hsl(142,76%,36%)]" />
              ) : (
                <CheckCircle className="w-4 h-4 text-[hsl(142,76%,36%)]" />
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              @{telegramUsername || 'connected'}
            </span>
          </div>
        </div>
        
        {/* User ID & Chat ID Display */}
        <div className="mt-4 space-y-2 bg-background/50 rounded-md p-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">User ID:</span>
            <span className="font-mono text-foreground">{telegramId}</span>
          </div>
          {chatId ? (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Chat ID:</span>
              <span className="font-mono text-foreground">{chatId}</span>
            </div>
          ) : null}
        </div>

        {/* Verification Status */}
        {isVerified ? (
          <div className="mt-3 flex items-center justify-center gap-2 p-2 bg-[hsl(142,76%,95%)] dark:bg-[hsl(142,50%,15%)] rounded-md border border-[hsl(142,76%,70%)] dark:border-[hsl(142,50%,30%)]">
            <BadgeCheck className="w-5 h-5 text-[hsl(142,76%,36%)]" />
            <span className="text-sm font-medium text-[hsl(142,76%,30%)] dark:text-[hsl(142,76%,70%)]">
              Chat Verified ✅
            </span>
          </div>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={handleStartChat}
            className="mt-3 w-full bg-[hsl(200,80%,50%)] hover:bg-[hsl(200,80%,45%)] text-white"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Start Chat to Verify
            <ExternalLink className="w-3 h-3 ml-2" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          className="mt-3 w-full text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <X className="w-4 h-4 mr-1" />
          Disconnect
        </Button>

        <ConfirmDisconnectDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          platform="Telegram"
          account={telegramUsername ? `@${telegramUsername}` : null}
          onConfirm={handleDisconnect}
        />
      </div>
    );
  }

  const handleFallbackConnect = () => {
    if (botUsername) {
      window.open(`https://t.me/${botUsername}?start=${userId}`, '_blank');
      toast({
        title: "Telegram App Opened",
        description: "Click START in Telegram to connect your account",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="w-8 h-8 rounded-full bg-[hsl(200,80%,50%)] flex items-center justify-center">
          <Send className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm text-foreground">Connect Telegram</p>
          <p className="text-xs text-muted-foreground">
            Connect Telegram for fast notifications
          </p>
        </div>
      </div>
      
      {/* Telegram Widget */}
      <div ref={widgetRef} className="flex justify-center min-h-[44px]" />
      
      {/* Fallback Button - shows if widget doesn't load */}
      {showFallback && botUsername && (
        <Button
          onClick={handleFallbackConnect}
          className="w-full bg-[hsl(200,80%,50%)] hover:bg-[hsl(200,80%,45%)] text-white"
        >
          <Send className="w-4 h-4 mr-2" />
          Connect via Telegram App
          <ExternalLink className="w-3 h-3 ml-2" />
        </Button>
      )}
      
      {!botUsername && (
        <p className="text-xs text-center text-muted-foreground">
          Telegram bot is not configured
        </p>
      )}
    </div>
  );
};

export default TelegramLoginButton;
