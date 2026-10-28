import { useEffect, useId, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Ban, Loader2, Unlink } from 'lucide-react';

import { matchesConfirmation } from '@/lib/typedConfirmation';

interface ConfirmDisconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Platform label, e.g. "LinkedIn". The user must type "LinkedIn Disconnect". */
  platform: string;
  /** Optional account label shown in the description (email / handle). */
  account?: string | null;
  action?: 'disconnect' | 'cancel';
  description?: string;
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmDisconnectDialog({
  open,
  onOpenChange,
  platform,
  account,
  action = 'disconnect',
  description,
  onConfirm,
}: ConfirmDisconnectDialogProps) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const cancelling = action === 'cancel';
  const phrase = `${platform} ${cancelling ? 'Cancel' : 'Disconnect'}`;
  const matches = matchesConfirmation(value, phrase);

  useEffect(() => {
    if (open) {
      setValue('');
      setBusy(false);
    }
  }, [open, phrase]);

  const handleConfirm = async () => {
    if (!matches || busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Caller displays errors; leave dialog open for retry.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? null : onOpenChange(o))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {cancelling ? 'Cancel' : 'Disconnect'} {platform}?
          </DialogTitle>
          <DialogDescription>
            {description || <>{account ? <span className="font-medium">{account}</span> : platform} will be unlinked and
            AI features for it will stop working. You can connect it again anytime.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-1">
          <Label htmlFor={inputId} className="text-xs">
            To confirm, type <span className="font-semibold text-foreground">{phrase}</span> below
          </Label>
          <Input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={phrase}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
            }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!matches || busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              cancelling ? <Ban className="h-4 w-4 mr-2" /> : <Unlink className="h-4 w-4 mr-2" />
            )}
            {cancelling ? `Cancel ${platform}` : 'Disconnect'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
