import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const AI_CONNECT_PLATFORMS: { key: string; label: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'gmail', label: 'Gmail' },
  { key: 'outlook', label: 'Outlook' },
  { key: 'email', label: 'Domain email' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'x', label: 'X (Twitter)' },
  { key: 'github', label: 'GitHub' },
  { key: 'gitlab', label: 'GitLab' },
];

/** WhatsApp-style switcher bar to jump between AI Connect platform settings. */
export default function PlatformSwitcher({ current, accountLabel }: { current: string; accountLabel?: string | null }) {
  const navigate = useNavigate();
  const currentLabel = AI_CONNECT_PLATFORMS.find((p) => p.key === current)?.label || current;

  return (
    <div className="flex w-full items-center border-b border-border bg-card px-3 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full min-w-0 justify-between gap-2">
            <span className="truncate">{accountLabel ? `${currentLabel} · ${accountLabel}` : currentLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" sideOffset={6} collisionPadding={8} className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-sm">
          <DropdownMenuLabel>Your AI Connect accounts</DropdownMenuLabel>
          {AI_CONNECT_PLATFORMS.map((p) => (
            <DropdownMenuItem key={p.key} onSelect={() => navigate(`/ai-assistant/connect/${p.key}/settings`)} className="flex items-center gap-2">
              <Check className={`h-4 w-4 ${p.key === current ? 'opacity-100' : 'opacity-0'}`} />
              <span className="truncate text-sm">{p.label}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/ai-assistant/connect')}>
            <Plus className="mr-2 h-4 w-4" /> Connect another account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
