import { useQuery } from '@tanstack/react-query';
import { Copy, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

type Invoice = {
  invoice_number: string | null; invoice_id: string; payment_id: string; order_id: string | null;
  customer_name: string | null; customer_email: string | null; amount: number | null; tax_amount: number;
  currency: string | null; invoice_date: string | null; status: string; payment_status: string | null;
  refund_status: string | null; mode: string; download_url: string | null;
};

async function readError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try { return (await error.context.json())?.error as string; } catch { /* ignore */ }
  }
  return 'Could not load the invoice. Please try again.';
}

export type InvoiceResult = { invoice: Invoice | null; reason: string | null };

export const invoiceQueryKey = (paymentId: string) => ['razorpay-invoice', paymentId] as const;

export async function fetchRazorpayInvoice(paymentId: string): Promise<InvoiceResult> {
  const { data, error } = await supabase.functions.invoke<InvoiceResult>('unified-verify-payment', {
    body: { action: 'employee-invoice', payment_id: paymentId },
  });
  if (error) throw new Error(await readError(error));
  return data ?? { invoice: null, reason: 'Invoice not available.' };
}

export const INVOICE_STALE_MS = 10 * 60_000;

export function RazorpayInvoiceSection({ paymentId, paymentStatus }: { paymentId: string; paymentStatus: string }) {
  const eligible = paymentStatus !== 'failed';
  const { data } = useQuery({
    queryKey: invoiceQueryKey(paymentId),
    enabled: eligible,
    staleTime: INVOICE_STALE_MS,
    gcTime: 30 * 60_000,
    retry: false,
    queryFn: () => fetchRazorpayInvoice(paymentId),
  });

  if (!eligible) return null;

  const copy = async () => {
    const value = data?.invoice?.invoice_id;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Invoice ID copied');
    } catch {
      toast.error("Couldn't copy invoice ID");
    }
  };

  const inv = data?.invoice;
  if (!inv) return null;

  const view = () => {
    if (!inv.download_url) { toast.error('Invoice is not available yet.'); return; }
    const opened = window.open(inv.download_url, '_blank', 'noopener,noreferrer');
    if (!opened) toast.error('Please allow pop-ups to view the invoice.');
  };

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <p className="text-[13px] leading-5 text-muted-foreground">Invoice ID</p>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-md text-muted-foreground hover:text-foreground" disabled={!inv.download_url} onClick={view} aria-label="View Invoice" title="View Invoice">
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1">
        <p className="min-w-0 break-all text-[15px] leading-6 font-medium">{inv.invoice_id}</p>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-md text-muted-foreground hover:text-foreground" onClick={() => void copy()} aria-label="Copy Invoice ID" title="Copy Invoice ID">
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
