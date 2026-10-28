import { useEffect, useMemo } from 'react';
import { Phone } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';

const PhoneDigitsSchema = z.string().regex(/^\d{7,15}$/);

const CallRedirect = () => {
  const digits = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get('number') || '';
    const parsed = PhoneDigitsSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }, []);

  const openDialer = () => {
    if (!digits) return;
    window.location.href = `tel:+${digits}`;
  };

  useEffect(() => {
    openDialer();
  }, [digits]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Phone className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold">{digits ? 'Opening phone dialer' : 'Invalid phone number'}</h1>
        {digits && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">+{digits}</p>
            <Button className="mt-6" onClick={openDialer}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call now
            </Button>
          </>
        )}
      </div>
    </main>
  );
};

export default CallRedirect;