import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Send, CheckCircle, X, BadgeCheck, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { triggerTelegramEvent } from '@/hooks/useTelegramTrigger';
import ConfirmDisconnectDialog from '@/components/social/ConfirmDisconnectDialog';

interface TelegramConnectCodeProps {
  botUsername: string;
  userType: 'profile' | 'company';
  userId: string;
  companyId?: string;
  currentConnectCode?: string | null;
  currentTelegramUsername?: string | null;
  currentTelegramId?: number | null;
  currentTelegramChatId?: number | null;
  onDisconnect?: () => void;
  onCodeRefreshed?: (newCode: string) => void;
  is2FAEnabled?: boolean;
}

const TelegramConnectCode: React.FC<TelegramConnectCodeProps> = ({
  botUsername,
  userType,
  userId,
  companyId,
  currentConnectCode,
  currentTelegramUsername,
  currentTelegramId,
  currentTelegramChatId,
  onDisconnect,
  onCodeRefreshed,
  is2FAEnabled = false
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [connectCode, setConnectCode] = useState<string | null>(currentConnectCode || null);
  const [isConnected, setIsConnected] = useState(!!currentTelegramId);
  const [chatId, setChatId] = useState<number | null>(currentTelegramChatId || null);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(currentTelegramUsername || null);
  const [telegramId, setTelegramId] = useState<number | null>(currentTelegramId || null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Deterministic lifetime connect code — same ID always yields the same code
  const generateCode = (prefix: string, seed: string) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    // Two independent hashes over the seed for a well-spread 6-char code
    let h1 = 2166136261;
    let h2 = 5381;
    for (let i = 0; i < seed.length; i++) {
      h1 = ((h1 ^ seed.charCodeAt(i)) * 16777619) >>> 0;
      h2 = (((h2 << 5) + h2) + seed.charCodeAt(i)) >>> 0;
    }
    let code = prefix + '-';
    for (let i = 0; i < 6; i++) {
      const mixed = (h1 ^ (h2 >>> (i % 8))) >>> 0;
      code += chars.charAt((mixed + i * 7919) % chars.length);
      h1 = (h1 * 16777619 + 1) >>> 0;
    }
    return code;
  };

  // Auto-generate code on page load if not connected and no code exists
  useEffect(() => {
    const autoGenerateCode = async () => {
      // Skip if already connected, already has code, or currently generating
      if (isConnected || connectCode || isGenerating) return;
      
      const table = userType === 'profile' ? 'profiles' : 'companies';
      const idField = userType === 'profile' ? 'user_id' : 'id';
      const idValue = userType === 'profile' ? userId : companyId;
      const prefix = userType === 'profile' ? 'P' : 'E';

      if (!idValue) return;

      setIsGenerating(true);
      try {
        const newCode = generateCode(prefix, String(idValue));
        
        const { error } = await supabase
          .from(table)
          .update({ telegram_connect_code: newCode })
          .eq(idField, idValue);

        if (!error) {
          setConnectCode(newCode);
          console.log('📱 Auto-generated connect code:', newCode);
        }
      } catch (err) {
        console.error('Auto-generate code error:', err);
      } finally {
        setIsGenerating(false);
      }
    };

    autoGenerateCode();
  }, [userType, userId, companyId, isConnected, connectCode, isGenerating]);

  useEffect(() => {
    setConnectCode(currentConnectCode || null);
  }, [currentConnectCode]);

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
      .channel(`telegram-code-${userType}-${filterValue}`)
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
          const oldData = payload.old as any;
          console.log('📱 Telegram realtime update:', newData);
          
          // Check if user just connected (telegram_id changed from null to a value)
          if (newData.telegram_id && !oldData?.telegram_id) {
            // Send welcome/connected notification
            const eventType = userType === 'profile' ? 'user_telegram_connected' : 'employer_telegram_connected';
            const name = userType === 'profile' 
              ? (newData.full_name || 'User')
              : (newData.company_name || 'Company');
            
            triggerTelegramEvent(eventType, userId, userType === 'profile' ? 'user' : 'employer', name, {
              telegram_username: newData.telegram_username
            });
          }
          
          if (newData.telegram_id !== undefined) {
            setTelegramId(newData.telegram_id);
            setIsConnected(!!newData.telegram_id);
          }
          if (newData.telegram_username !== undefined) {
            setTelegramUsername(newData.telegram_username);
          }
          if (newData.telegram_chat_id !== undefined) {
            setChatId(newData.telegram_chat_id);
          }
          if (newData.telegram_connect_code !== undefined) {
            setConnectCode(newData.telegram_connect_code);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userType, userId, companyId]);

  const handleCopyCode = async () => {
    if (!connectCode) return;
    
    try {
      await navigator.clipboard.writeText(connectCode);
      setCopied(true);
      toast({
        title: "Code Copied! 📋",
        description: "Now paste it in the Telegram bot",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Please copy the code manually",
        variant: "destructive"
      });
    }
  };


  const handleDisconnect = async () => {
    // Check if 2FA is enabled - prevent disconnect
    if (is2FAEnabled) {
      toast({
        title: "Cannot Disconnect Telegram",
        description: "Two-Factor Authentication is enabled. Please disable 2FA in your Account Security settings first, then try again.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

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

      if (error) throw error;

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

  const handleOpenBot = () => {
    if (botUsername) {
      window.open(`https://t.me/${botUsername}`, '_blank');
    }
  };

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
        
        {isVerified && (
          <div className="mt-3 flex items-center justify-center gap-2 p-2 bg-[hsl(142,76%,95%)] dark:bg-[hsl(142,50%,15%)] rounded-md border border-[hsl(142,76%,70%)] dark:border-[hsl(142,50%,30%)]">
            <BadgeCheck className="w-5 h-5 text-[hsl(142,76%,36%)]" />
            <span className="text-sm font-medium text-[hsl(142,76%,30%)] dark:text-[hsl(142,76%,70%)]">
              Verified ✅
            </span>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={isLoading}
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="w-8 h-8 rounded-full bg-[hsl(200,80%,50%)] flex items-center justify-center">
          <Send className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm text-foreground">Connect Telegram</p>
          <p className="text-xs text-muted-foreground">
            Get instant notifications on Telegram
          </p>
        </div>
      </div>

      {/* Connect Code Display */}
      {connectCode && (
        <div className="p-4 bg-muted/30 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground mb-2 text-center">Your Connect Code</p>
          <button
            type="button"
            onClick={handleCopyCode}
            aria-label="Copy connect code"
            className={`block w-full rounded-md border bg-background px-3 py-3 text-center text-xl font-bold tracking-wider text-foreground transition-colors ${
              copied ? 'border-[hsl(142,76%,50%)] bg-[hsl(142,76%,95%)] dark:bg-[hsl(142,50%,15%)]' : 'hover:bg-muted/50'
            }`}
          >
            <span className="block w-full truncate font-mono">{connectCode}</span>
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {copied ? 'Copied!' : 'Tap the code to copy'}
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">How to Connect:</p>
        <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
          <li>Copy your Connect Code above</li>
          <li>Open our Telegram bot</li>
          <li>Send <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">/start</code></li>
          <li>Paste your Connect Code when asked</li>
        </ol>
      </div>

      {/* Open Bot Button */}
      {botUsername && (
        <Button
          onClick={handleOpenBot}
          className="w-full bg-[hsl(200,80%,50%)] hover:bg-[hsl(200,80%,45%)] text-white"
        >
          <Send className="w-4 h-4 mr-2" />
          Open Telegram Bot
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

export default TelegramConnectCode;