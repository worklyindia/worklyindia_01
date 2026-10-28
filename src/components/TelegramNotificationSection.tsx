import React, { useEffect, useState } from 'react';
import { useTelegramBot } from '@/hooks/useTelegramBot';
import { supabase } from '@/integrations/supabase/client';

import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Send, 
  CheckCircle, 
  X, 
  ExternalLink, 
  MessageCircle,
  BadgeCheck,
  Loader2
} from 'lucide-react';
import { useTelegramStatus } from '@/hooks/useTelegramStatus';
import TelegramConnectCode from './TelegramConnectCode';
import { useNavigate } from 'react-router-dom';
import { BRAND_CONFIG } from '@/config/brandConfig';
import ConfirmDisconnectDialog from '@/components/social/ConfirmDisconnectDialog';

interface TelegramNotificationSectionProps {
  userType: 'profile' | 'company';
  userId: string | null;
  companyId?: string | null;
  botUsername?: string;
  showInCard?: boolean;
}

// Separate Telegram Notifications Toggle for Notification Preferences section
export const TelegramNotificationsToggle: React.FC<{
  userType: 'profile' | 'company';
  userId: string | null;
  companyId?: string | null;
}> = ({ userType, userId, companyId }) => {
  const { isConnected, isChatVerified, notificationsEnabled, toggleNotifications, isLoading } = useTelegramStatus({
    userType,
    userId,
    companyId,
  });

  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    setIsToggling(true);
    await toggleNotifications(enabled);
    setIsToggling(false);
  };

  if (!isConnected || isLoading) return null;

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <Send className="h-4 w-4 text-[hsl(200,80%,50%)]" />
        <div>
          <Label htmlFor="telegram-notifications" className="text-sm font-medium cursor-pointer">
            Telegram Notifications
          </Label>
          <p className="text-xs text-muted-foreground">
            {isChatVerified 
              ? "Receive notifications via Telegram" 
              : "Verify chat to enable notifications"}
          </p>
        </div>
      </div>
      <Switch
        id="telegram-notifications"
        checked={notificationsEnabled}
        onCheckedChange={handleToggle}
        disabled={isToggling || !isChatVerified}
      />
    </div>
  );
};

// Main Telegram Section - matches TelegramLoginButton connected design
export const TelegramNotificationSection: React.FC<TelegramNotificationSectionProps> = ({
  userType,
  userId,
  companyId,
  botUsername: botUsernameProp,
  showInCard = true,
}) => {
  const { botUsername: audienceBotUsername } = useTelegramBot(
    userType === 'company' ? 'employer' : 'job_seeker',
  );
  const botUsername = botUsernameProp || audienceBotUsername || BRAND_CONFIG.telegramBotUsername;

  const {
    isConnected,
    isChatVerified,
    telegramId,
    telegramUsername,
    telegramChatId,
    isLoading,
    disconnectTelegram,
    refetch,
  } = useTelegramStatus({ userType, userId, companyId });

  const [confirmOpen, setConfirmOpen] = useState(false);

  // Owner Portal me save kiya hua Telegram channel + user ka join status.
  const [channelUsername, setChannelUsername] = useState<string | null>(null);
  const [channelJoined, setChannelJoined] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      setChannelUsername(null);
      return;
    }
    let cancelled = false;
    setChannelLoading(true);
    supabase.functions
      .invoke('email-api/telegram', {
        body: {
          action: 'channel_membership',
          audience: userType === 'company' ? 'employer' : 'job_seeker',
          telegram_user_id: telegramId,
        },
      })
      .then(({ data }) => {
        if (cancelled) return;
        setChannelUsername(data?.channel ?? null);
        setChannelJoined(!!data?.joined);
      })
      .catch(() => {
        if (!cancelled) setChannelUsername(null);
      })
      .finally(() => {
        if (!cancelled) setChannelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isConnected, telegramId, userType]);

  // Channel naam bina @ ke (owner page par save kiya hua channel).
  const channelName = (channelUsername || '').replace(/^@/, '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  const handleStartChat = () => {
    if (botUsername && telegramId) {
      window.open(`https://t.me/${botUsername}?start=${telegramId}`, '_blank');
    }
  };

  // Connected state - exact design like TelegramLoginButton
  const connectedContent = (
    <div className="p-4 bg-[hsl(200,80%,95%)] dark:bg-[hsl(200,50%,15%)] rounded-lg border border-[hsl(200,80%,70%)] dark:border-[hsl(200,50%,30%)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[hsl(200,80%,50%)] flex items-center justify-center flex-shrink-0">
          <Send className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Telegram Connected</span>
            {isChatVerified ? (
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
        {channelName && (
          <div className="flex justify-between items-center gap-2 text-sm">
            <span className="text-muted-foreground">Channel:</span>
            <span className="flex items-center gap-2 min-w-0">
              {channelLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              ) : channelJoined ? (
                <Badge variant="default" className="gap-1">
                  <BadgeCheck className="w-3 h-3" />
                  Joined
                </Badge>
              ) : (
                <a
                  href={`https://t.me/${channelName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-medium text-primary hover:underline"
                >
                  {channelName}
                </a>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Verification Status */}
      {isChatVerified ? (
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
        onConfirm={disconnectTelegram}
      />
    </div>
  );

  // Not connected state
  const notConnectedContent = (
    <TelegramConnectCode
      botUsername={botUsername}
      userType={userType}
      userId={userId || ''}
      companyId={companyId || undefined}
      currentTelegramId={telegramId}
      currentTelegramUsername={telegramUsername}
      currentTelegramChatId={telegramChatId}
      onDisconnect={refetch}
    />
  );

  const content = isConnected ? connectedContent : notConnectedContent;

  if (showInCard) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-[hsl(200,80%,50%)]" />
          Telegram Integration
        </h3>
        {content}
      </Card>
    );
  }

  return content;
};

// Compact status display for profile pages
export const TelegramStatusBadge: React.FC<{
  userType: 'profile' | 'company';
  userId: string | null;
  companyId?: string | null;
  settingsPath?: string;
}> = ({ userType, userId, companyId, settingsPath = '/settings' }) => {
  const navigate = useNavigate();
  const { isConnected, isChatVerified, telegramUsername, isLoading } = useTelegramStatus({
    userType,
    userId,
    companyId,
  });

  if (isLoading) return null;

  if (!isConnected) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(settingsPath)}
        className="text-xs"
      >
        <Send className="w-3 h-3 mr-1" />
        Connect Telegram
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={isChatVerified ? "default" : "secondary"} 
        className="flex items-center gap-1"
      >
        <Send className="w-3 h-3" />
        @{telegramUsername || 'connected'}
        {isChatVerified && <BadgeCheck className="w-3 h-3 ml-1" />}
      </Badge>
    </div>
  );
};

export default TelegramNotificationSection;
