import { useEffect, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

type Opts = { title?: string; confirmText?: string; cancelText?: string; destructive?: boolean };
type Req = Opts & { message: string; resolve: (ok: boolean) => void };

let push: ((r: Req) => void) | null = null;
const queue: Req[] = [];

const looksDestructive = (m: string) => /delete|remove|disconnect|discard/i.test(m);

/** In-app replacement for window.confirm. Resolves true when the user confirms. */
export function confirmDialog(message: string, opts: Opts = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const req = { message, ...opts, resolve };
    if (push) push(req); else queue.push(req);
  });
}

/** Mount once near the app root. */
export function ConfirmDialogHost() {
  const [req, setReq] = useState<Req | null>(null);
  useEffect(() => {
    push = (r) => setReq(r);
    const next = queue.shift();
    if (next) setReq(next);
    return () => { push = null; };
  }, []);

  const close = (ok: boolean) => { req?.resolve(ok); setReq(null); };
  const destructive = req ? (req.destructive ?? looksDestructive(req.message)) : false;

  return (
    <AlertDialog open={!!req} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{req?.title ?? 'Are you sure?'}</AlertDialogTitle>
          <AlertDialogDescription>{req?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>{req?.cancelText ?? 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? buttonVariants({ variant: 'destructive' }) : undefined}
            onClick={() => close(true)}
          >
            {req?.confirmText ?? (destructive ? 'Yes, continue' : 'OK')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
