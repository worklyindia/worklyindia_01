import { confirmDialog } from '@/lib/confirmDialog';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  disconnectSocialAccount, setDefaultSocialAccount, type SocialConnectionInfo, type SocialPlatform,
} from '@/hooks/useSocialConnect';

interface Props {
  platform: SocialPlatform;
  label: string;
  accounts: SocialConnectionInfo[];
  current: SocialConnectionInfo | null;
  onSelect: (accountId: string) => void;
  reload: () => Promise<void> | void;
  /** Platform supports one account only: no default/remove actions. */
  single?: boolean;
  addPath?: string;
  /** Adds an account without leaving the current page (popup or dialog). */
  onAdd?: () => void;
  /** Overrides for platforms not stored in social connections (Telegram, Facebook, Instagram). */
  onMakeDefault?: (accountId: string) => Promise<unknown>;
  onRemove?: (accountId: string) => Promise<unknown>;
  /** Switching only: hides add/remove actions from the menu. */
  switchOnly?: boolean;
}

const nameOf = (a: SocialConnectionInfo) => a.accountName || a.channelName || a.accountHandle || a.accountEmail || a.accountId || 'Account';
const subOf = (a: SocialConnectionInfo) => (a.accountHandle ? `@${a.accountHandle.replace(/^@/, '')}` : a.accountEmail || '');

/** WhatsApp-style switcher for several connected accounts of one platform. */
export default function SocialAccountSwitcher({ platform, label, accounts: rawAccounts, current: currentProp, onSelect, reload, single = false, addPath, onAdd, onMakeDefault, onRemove, switchOnly = false }: Props) {
  // A lone account is always the default.
  const accounts = rawAccounts.length === 1 ? [{ ...rawAccounts[0], isDefault: true }] : rawAccounts;
  const current = currentProp ? (accounts.find(a => a.accountId === currentProp.accountId) ?? currentProp) : (single ? accounts[0] ?? null : null);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="flex w-full items-center border-b border-border bg-card px-3 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full min-w-0 justify-between gap-2" disabled={busy}>
            <span className="truncate">
              {current ? `${nameOf(current)}${subOf(current) ? ` · ${subOf(current)}` : ''}` : `Select ${label} account`}
            </span>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" sideOffset={6} collisionPadding={8} className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-sm">
          <DropdownMenuLabel>Your {label} accounts</DropdownMenuLabel>
          {accounts.map((a) => (
            <DropdownMenuItem key={a.accountId ?? nameOf(a)} onSelect={() => a.accountId && onSelect(a.accountId)} className="flex items-center gap-2">
              <Check className={`h-4 w-4 ${a.accountId === current?.accountId ? 'opacity-100' : 'opacity-0'}`} />
              {a.accountPicture ? <img src={a.accountPicture} alt="" className="h-6 w-6 rounded-full object-cover" /> : null}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{nameOf(a)}</div>
                {subOf(a) && <div className="truncate text-xs text-muted-foreground">{subOf(a)}</div>}
              </div>
              {a.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
            </DropdownMenuItem>
          ))}
          {(!switchOnly || (!single && current?.accountId && !current.isDefault)) && <DropdownMenuSeparator />}
          {!single && current?.accountId && !current.isDefault && (
            <DropdownMenuItem onSelect={() => {
              const currentId = current.accountId;
              if (currentId) void run(() => (onMakeDefault ? onMakeDefault(currentId) : setDefaultSocialAccount(platform, currentId)), 'Default account updated');
            }}>
              <Star className="mr-2 h-4 w-4" /> Make this the default
            </DropdownMenuItem>
          )}
          {!switchOnly && (
            <DropdownMenuItem onSelect={() => onAdd ? onAdd() : navigate(addPath || `/ai-assistant/connect?add=${platform}&return=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>
              <Plus className="mr-2 h-4 w-4" /> Add another {label} account
            </DropdownMenuItem>
          )}
          {!switchOnly && current && accounts.length > 1 && (!single || onRemove) && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={async () => {
                if (!await confirmDialog(`Remove ${nameOf(current)} from AI Connect?`)) return;
                const id = current.accountId;
                void run(() => (onRemove && id ? onRemove(id) : disconnectSocialAccount(platform, id)), 'Account removed');
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remove this account
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
