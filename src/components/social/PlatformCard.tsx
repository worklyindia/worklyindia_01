import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Link2, Loader2, Settings as SettingsIcon, Unlink } from 'lucide-react';
import ConfirmDisconnectDialog from '@/components/social/ConfirmDisconnectDialog';

export interface PlatformCardProps {
  name: string;
  /** Optional label for the connect button, defaults to `Connect {name}`. */
  connectLabel?: string;
  description: string;
  logo: React.ReactNode;
  connected: boolean;
  connectedLabel?: string;
  /** Optional secondary line under the title (e.g. the connected email). */
  subLabel?: string | null;
  onConnect: () => void;
  onDisconnect?: () => void;
  onSettings?: () => void;
  loading?: boolean;
  brandColor: string;
  /** Extra content rendered under the action row (warnings, dialogs, etc.). */
  children?: React.ReactNode;
}

/**
 * Single shared card layout for every AI Connect integration so all cards
 * (YouTube, LinkedIn, X, GitHub, GitLab, Telegram, Gmail, Domain Email)
 * have identical sizing, spacing and button styling.
 */
export default function PlatformCard({
  name,
  connectLabel,
  description,
  logo,
  connected,
  connectedLabel,
  subLabel,
  onConnect,
  onDisconnect,
  onSettings,
  loading,
  brandColor,
  children,
}: PlatformCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <Card className="overflow-hidden border-border/60 bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div
            className="shrink-0 rounded-xl p-2.5 sm:p-3"
            style={{ backgroundColor: `${brandColor}15` }}
          >
            {logo}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground text-sm sm:text-base">{name}</h3>
              {connected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <Check className="h-3 w-3" />
                  {connectedLabel || 'Connected'}
                </span>
              )}
            </div>
            {connected && subLabel && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{subLabel}</p>
            )}
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
              {description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {connected ? (
                <>
                  {onSettings && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs sm:text-sm"
                      onClick={onSettings}
                    >
                      <SettingsIcon className="h-3.5 w-3.5 mr-1.5" />
                      Settings
                    </Button>
                  )}
                  {onDisconnect && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs sm:text-sm text-destructive hover:text-destructive"
                      onClick={() => setConfirmOpen(true)}
                      disabled={loading}
                    >
                      <Unlink className="h-3.5 w-3.5 mr-1.5" />
                      Disconnect
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  size="sm"
                  className="h-8 text-xs sm:text-sm text-white"
                  style={{ backgroundColor: brandColor }}
                  onClick={onConnect}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {connectLabel || `Connect ${name}`}
                </Button>
              )}
            </div>
            {children}
          </div>
        </div>
      </CardContent>

      {onDisconnect && (
        <ConfirmDisconnectDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          platform={name}
          account={connectedLabel}
          onConfirm={onDisconnect}
        />
      )}
    </Card>
  );
}
