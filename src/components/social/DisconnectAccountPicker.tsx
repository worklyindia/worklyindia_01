import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface PickerAccount { id: string; name: string; sub?: string | null; picture?: string | null }

/** Lets the user choose exactly which connected account to disconnect. */
export default function DisconnectAccountPicker({ open, onOpenChange, label, accounts, onDisconnect }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  label: string;
  accounts: PickerAccount[];
  onDisconnect: (id: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={(v) => !busyId && onOpenChange(v)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Disconnect {label}</DialogTitle>
          <DialogDescription>Choose the account to disconnect. Your other accounts stay connected.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border p-2.5">
              {a.picture ? <img src={a.picture} alt="" className="h-8 w-8 rounded-full object-cover" /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.name}</p>
                {a.sub ? <p className="truncate text-xs text-muted-foreground">{a.sub}</p> : null}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={!!busyId}
                onClick={async () => {
                  setBusyId(a.id);
                  try { await onDisconnect(a.id); if (accounts.length <= 1) onOpenChange(false); } finally { setBusyId(null); }
                }}
              >
                {busyId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
