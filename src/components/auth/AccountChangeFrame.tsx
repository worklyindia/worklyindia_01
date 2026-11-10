import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { goBack } from '@/lib/goBack';

export function AccountChangeFrame({ standalone, title, fallback, open, onOpenChange, trigger, children }: {
  standalone?: boolean; title: string; fallback: string; open: boolean;
  onOpenChange: (open: boolean) => void; trigger?: ReactNode; children: ReactNode;
}) {
  const navigate = useNavigate();
  if (standalone) return (
    <div className="min-h-dvh w-full bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-3 py-3">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => goBack(navigate, fallback)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="min-w-0 text-lg font-semibold">{title}</h1>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-24 sm:px-6">{children}</main>
    </div>
  );
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetTrigger asChild>{trigger}</SheetTrigger>
    <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-3xl p-6 [&>button]:hidden">{children}</SheetContent>
  </Sheet>;
}