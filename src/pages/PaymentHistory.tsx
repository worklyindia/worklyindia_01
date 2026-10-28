import { useEffect, useRef, useState, type ReactNode } from 'react';
import { goBack } from "@/lib/goBack";
import { ArrowLeft, CheckCircle2, Copy, Download, Eye, Loader2, XCircle, ReceiptText, RotateCcw, UserCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { downloadPaymentDetailsPdf } from '@/lib/paymentHistoryPdf';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RazorpayInvoiceSection, fetchRazorpayInvoice, invoiceQueryKey, INVOICE_STALE_MS, type InvoiceResult } from '@/components/payments/RazorpayInvoiceSection';
import { refundDisplay, refundDestination } from '../../supabase/functions/_shared/refundDisplay';

type Refund = {
  id: string;
  amount: number;
  status: string;
  speed: string | null;
  created_at: string;
  expected_by: string | null;
  processed_at?: string | null;
  display_status: 'in_progress' | 'successful' | 'failed';
  events: Array<{ type: string; at: string | null; speed: string | null }>;
  currency?: string | null;
  comment?: string | null;
  description?: string | null;
  customer_id?: string | null;
  upi_transaction_id?: string | null;
};

type Payment = {
  id: string;
  order_id: string;
  label: string;
  amount: number;
  status: 'captured' | 'failed' | 'refunded' | 'partially_refunded' | 'expired' | 'cancelled';
  refunded_amount?: number;
  created_at: string;
  refunds?: Refund[];
  event_id?: string | null;
  rrn?: string | null;
  currency?: string | null;
  description?: string | null;
  customer_id?: string | null;
  subscription_id?: string | null;
  transaction_id?: string | null;
  method?: string | null;
  vpa?: string | null;
  bank_name?: string | null;
  card_network?: string | null;
  card_last4?: string | null;
  card_type?: string | null;
  wallet?: string | null;
  email?: string | null;
  contact?: string | null;
  error_code?: string | null;
  error_description?: string | null;
  error_reason?: string | null;
  reference_id?: string | null;
  provider?: string | null;
  paypal_order_id?: string | null;
  paypal_capture_id?: string | null;
  amount_usd?: number | null;
  payer_name?: string | null;
  webhook_verified?: boolean;
  billing_address?: string | null;
  gstin?: string | null;
  shipping_address?: string | null;
  payment_link_id?: string | null;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const fmtDateTime = (iso: string) => `${fmtDate(iso)} · ${new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}`;
const eventLabel: Record<string, string> = {
  'refund.created': 'Refund started',
  'refund.speed_changed': 'Refund speed changed',
  'refund.processed': 'Refund processed',
  'refund.failed': 'Refund failed',
};

// When several refund updates land in the same minute, the later stage wins,
// so a refund created and processed at once reads as a single line.
const eventRank: Record<string, number> = {
  'refund.created': 0,
  'refund.speed_changed': 1,
  'refund.processed': 2,
  'refund.failed': 2,
};

function RefundTracker({ refund, payment }: { refund: Refund; payment: Payment }) {
  const events = [
    { type: 'refund.created', at: refund.created_at, speed: null },
    ...refund.events.filter(event => event.type !== 'refund.created' && event.at),
  ].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const byTime = new Map<string, (typeof events)[number]>();
  for (const event of events) {
    const key = event.at ? fmtDateTime(event.at) : '—';
    const kept = byTime.get(key);
    if (!kept || (eventRank[event.type] ?? 0) >= (eventRank[kept.type] ?? 0)) byTime.set(key, event);
  }
  const timeline = [...byTime.values()];
  return (
    <div className="mt-1.5 min-w-0">
      <ol className="space-y-1 border-l border-border pl-2.5">
        {timeline.map((event, index) => (
          <li key={`${event.type}-${event.at}-${index}`} className="text-[11px] leading-4 text-muted-foreground">
            {eventLabel[event.type] ?? event.type} · {event.at ? fmtDateTime(event.at) : '—'}
          </li>
        ))}
        {refund.display_status === 'successful' && <li className="break-words text-[11px] leading-4 font-medium text-success">Refund Success · {refundDestination(payment)}</li>}
      </ol>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] leading-5 text-muted-foreground">{label}</p>
      <div className="mt-0.5 break-words text-[15px] leading-6 font-medium">{value}</div>
    </div>
  );
}

function CopyDetailRow({ label, copyValue, viewUrl }: { label: string; copyValue: string | null | undefined; viewUrl?: string | null }) {
  const hasValue = Boolean(copyValue);
  const view = () => {
    if (!viewUrl) return;
    const opened = window.open(viewUrl, '_blank', 'noopener,noreferrer');
    if (!opened) toast.error('Please allow pop-ups to view.');
  };
  const copy = async () => {
    if (!copyValue) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyValue);
      } else {
        const input = document.createElement('textarea');
        input.value = copyValue;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Couldn't copy ${label.toLowerCase()}`);
    }
  };
  return (
    <div className="min-w-0">
      <p className="text-[13px] leading-5 text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex min-w-0 items-center gap-1">
        <p className="min-w-0 break-all text-[15px] leading-6 font-medium">{copyValue || '—'}</p>
        {hasValue && (
          <Button variant="ghost" size="icon" className="-mr-1 h-6 w-6 shrink-0 rounded-md text-muted-foreground hover:text-foreground" onClick={copy} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
        {hasValue && viewUrl ? (
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-md text-muted-foreground hover:text-foreground" onClick={view} aria-label={`View ${label}`} title={`View ${label}`}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function refundStatusText(refund: Refund) {
  if (refund.display_status === 'failed') return 'Refund Failed';
  if (refund.display_status === 'successful') return 'Refund Success';
  return 'Refund can take up to 7 days.';
}

// The Refund Status line itself shows the requested speed: Normal or Instant.
function refundSpeedLabel(refund: Refund) {
  if (refund.display_status === 'failed') return 'Failed';
  const speed = (refund.speed ?? '').toLowerCase();
  if (speed === 'instant') return 'Instant';
  if (speed === 'normal') return 'Normal';
  return 'Processing';
}

function refundSpeedTone(refund: Refund) {
  if (refund.display_status === 'failed') return 'text-destructive';
  if (refund.speed?.toLowerCase() === 'instant') return 'text-success';
  if (refund.speed?.toLowerCase() === 'normal') return 'text-warning';
  return 'text-muted-foreground';
}

const methodNames: Record<string, string> = {
  upi: 'UPI',
  bank: 'Bank',
  card: 'Card',
  netbanking: 'Netbanking',
  wallet: 'Wallet',
  emi: 'EMI',
  cardless_emi: 'Cardless EMI',
  paylater: 'Credit Line',
  paypal: 'PayPal',
  fasr: 'FASR',
};

function methodLabel(method: string, cardType?: string | null) {
  const key = method.toLowerCase();
  const normalizedCardType = (cardType ?? '').toLowerCase();
  if (key === 'card' && normalizedCardType === 'debit') return 'Debit Card';
  if (key === 'card' && normalizedCardType === 'credit') return 'Credit Card';
  return methodNames[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function paymentStatusInfo(payment: Payment) {
  const latestRefund = payment.refunds?.[0];
  const refunded = payment.status === 'refunded' || payment.status === 'partially_refunded' || Boolean(latestRefund);
  const successful = payment.status === 'captured' && !refunded;
  const refundFailed = refunded && latestRefund?.display_status === 'failed';
  const refundSuccessful = refunded && latestRefund?.display_status === 'successful';
  const tone = successful || refundSuccessful ? 'text-success' : refundFailed || !refunded ? 'text-destructive' : 'text-warning';
  const text = refundFailed ? 'Refund Failed'
    : refunded ? (payment.status === 'partially_refunded' ? `Refunded ₹${(payment.refunded_amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Refunded')
      : successful ? 'Successful' : payment.status === 'expired' ? 'Link Expired' : payment.status === 'cancelled' ? 'Link Cancelled' : 'Failed';
  return { refunded, successful, refundFailed, refundSuccessful, tone, text };
}

const filters = [
  { label: 'Today', days: 1 },
  { label: '7 Day', days: 7 },
  { label: '30 Day', days: 30 },
] as const;

type Counts = { success: number; failed: number; refund: number; history: number };
type Amounts = { success: number; failed: number; refund: number; history: number };
const emptyCounts: Counts = { success: 0, failed: 0, refund: 0, history: 0 };
const emptyAmounts: Amounts = { success: 0, failed: 0, refund: 0, history: 0 };
const statusFilters = [
  { key: 'success', label: 'Success' },
  { key: 'failed', label: 'Failed' },
  { key: 'refund', label: 'Refund' },
  { key: 'history', label: 'History' },
] as const;
type StatusKey = (typeof statusFilters)[number]['key'];

export default function PaymentHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [days, setDays] = useState<1 | 7 | 30>(7);
  // Count boxes are display-only; the list always shows every payment in the period.
  const status: StatusKey = 'history';
  const [downloading, setDownloading] = useState(false);
  const [selected, setSelected] = useState<Payment | null>(null);
  const { data: workbook } = useQuery({
    queryKey: ['payment-workbook', selected?.id, user?.id],
    enabled: !!selected?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const paymentId = selected?.id;
      if (!paymentId) return { rows: [], linkedSubscriptionId: null };
      type EvRow = { event_id: string; payload: any; event_created_at: string; entity_id?: string | null };
      const isSub = (v: unknown): v is string => typeof v === 'string' && v.startsWith('sub_');
      const [{ data: paymentEvents }, { data: invoiceEvents }, { data: subscriptionRows }, { data: nestedPaymentEvents }] = await Promise.all([
        supabase.from('razorpay_events').select('event_id,payload,event_created_at,entity_id')
          .eq('entity_id', paymentId).order('event_created_at', { ascending: false }).limit(20),
        supabase.from('razorpay_events').select('event_id,payload,event_created_at,entity_id')
          .eq('payload->payload->invoice->entity->>payment_id', paymentId).limit(20),
        user?.id
          ? supabase.from('api_subscriptions').select('subscription_id,payment_id,created_at,activated_at')
            .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
          : Promise.resolve({ data: [] as any[] }),
        // Payment-link events keep the link id as entity_id but carry the payment inside.
        supabase.from('razorpay_events').select('event_id,payload,event_created_at,entity_id')
          .eq('payload->payload->payment->entity->>id', paymentId).limit(20),
      ]);
      const baseRows: EvRow[] = [...((paymentEvents ?? []) as EvRow[]), ...((invoiceEvents ?? []) as EvRow[]), ...((nestedPaymentEvents ?? []) as EvRow[])];
      const subRows = ((subscriptionRows ?? []) as any[]);

      // 1) Direct link saved at verification time
      let subscriptionId: string | null = subRows.find(r => r.payment_id === paymentId && isSub(r.subscription_id))?.subscription_id ?? null;
      // 2) Inside workbook payloads (payment notes / invoice / subscription entity)
      if (!subscriptionId) {
        for (const r of baseRows) {
          const p = r.payload?.payload;
          const cand = p?.subscription?.entity?.id || p?.invoice?.entity?.subscription_id
            || p?.payment?.entity?.subscription_id || p?.payment?.entity?.notes?.subscription_id;
          if (isSub(cand)) { subscriptionId = cand; break; }
        }
      }
      // 3) Payment's invoice → invoice event carries subscription_id
      if (!subscriptionId) {
        const invoiceIds = [...new Set(baseRows.map(r => r.payload?.payload?.payment?.entity?.invoice_id).filter(Boolean))] as string[];
        if (invoiceIds.length) {
          const { data: invRows } = await supabase.from('razorpay_events').select('event_id,payload,event_created_at,entity_id')
            .in('entity_id', invoiceIds).limit(20);
          for (const r of (invRows ?? []) as EvRow[]) {
            baseRows.push(r);
            const cand = r.payload?.payload?.invoice?.entity?.subscription_id;
            if (!subscriptionId && isSub(cand)) subscriptionId = cand;
          }
        }
      }
      // 4) Mandate/auth payment: user's subscription whose events happened around the same time
      const userSubIds = [...new Set(subRows.map(r => r.subscription_id).filter(isSub))] as string[];
      let subscriptionEvents: EvRow[] = [];
      if (userSubIds.length && (subscriptionId || selected?.created_at)) {
        const { data } = await supabase.from('razorpay_events').select('event_id,payload,event_created_at,entity_id')
          .in('entity_id', subscriptionId ? [subscriptionId] : userSubIds)
          .order('event_created_at', { ascending: false }).limit(100);
        subscriptionEvents = (data ?? []) as EvRow[];
        if (!subscriptionId && selected?.created_at) {
          const paidAt = new Date(selected.created_at).getTime();
          const WINDOW = 30 * 60 * 1000;
          let best: { id: string; diff: number } | null = null;
          const consider = (id: unknown, at: unknown) => {
            if (!isSub(id) || !at) return;
            const diff = Math.abs(new Date(String(at)).getTime() - paidAt);
            if (diff <= WINDOW && (!best || diff < best.diff)) best = { id, diff };
          };
          for (const e of subscriptionEvents) consider(e.entity_id, e.event_created_at);
          for (const r of subRows) { consider(r.subscription_id, r.activated_at); consider(r.subscription_id, r.created_at); }
          subscriptionId = (best as { id: string } | null)?.id ?? null;
        }
        subscriptionEvents = subscriptionId ? subscriptionEvents.filter(e => e.entity_id === subscriptionId) : [];
      }
      const deduped = new Map<string, EvRow>();
      for (const row of [...baseRows, ...subscriptionEvents]) deduped.set(row.event_id, row);
      const rows = [...deduped.values()].sort((a, b) => b.event_created_at.localeCompare(a.event_created_at));
      return { rows, linkedSubscriptionId: subscriptionId };
    },
  });
  // Fallback billing address: the same Payment Profile every payment uses.
  const { data: profileBilling } = useQuery({
    queryKey: ['payment-profile-billing', user?.id],
    enabled: !!user?.id && !!selected,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('payment_profiles').select('address,city,state,postal_code,country,shipping_address,gstin').eq('user_id', user!.id).maybeSingle();
      if (!data) return null;
      const join = (a: any) => [a?.address, a?.city, a?.state, a?.postal_code, a?.country].map(v => String(v ?? '').trim()).filter(Boolean).join(', ') || null;
      return { billing: join(data), shipping: join(data.shipping_address as any), gstin: ((data as any).gstin as string) || null };
    },
  });
  const selectedView: Payment | null = (() => {
    if (!selected) return null;
    const rows = workbook?.rows ?? [];
    if (!rows.length && !workbook?.linkedSubscriptionId) return { ...selected, billing_address: selected.billing_address || profileBilling?.billing || null, shipping_address: selected.shipping_address || profileBilling?.shipping || null, gstin: selected.gstin || profileBilling?.gstin || null };
    const pick = <T,>(fn: (r: any) => T | null | undefined): T | null => {
      for (const r of rows) { const v = fn(r); if (v) return v; }
      return null;
    };
    const pay = (r: any) => r.payload?.payload?.payment?.entity;
    const notesText = (n: any) => {
      if (!n || typeof n !== 'object') return null;
      if (n.comment) return String(n.comment).trim();
      return null;
    };
    const refundsById = new Map<string, any>();
    for (const r of rows) {
      const rf = r.payload?.payload?.refund?.entity;
      if (rf?.id && !refundsById.has(rf.id)) refundsById.set(rf.id, rf);
    }
    return {
      ...selected,
      event_id: selected.event_id || pick(r => (r.entity_id === selected.id ? r.event_id : null)) || rows[0]?.event_id || null,
      customer_id: selected.customer_id || pick(r => pay(r)?.customer_id || r.payload?.payload?.subscription?.entity?.customer_id),
      subscription_id: selected.subscription_id || workbook?.linkedSubscriptionId || pick(r => r.payload?.payload?.subscription?.entity?.id || pay(r)?.subscription_id),
      transaction_id: selected.transaction_id || pick(r => { const a = pay(r)?.acquirer_data; return a?.upi_transaction_id || a?.bank_transaction_id || a?.transaction_id || a?.auth_code; }),
      rrn: selected.rrn || pick(r => pay(r)?.acquirer_data?.rrn),
      currency: selected.currency || pick(r => pay(r)?.currency),
      description: selected.description || pick(r => pay(r)?.description),
      reference_id: selected.reference_id || pick(r => r.payload?.payload?.payment_link?.entity?.reference_id),
      billing_address: selected.billing_address || pick(r => r.payload?.payload?.payment_link?.entity?.notes?.billing_address || pay(r)?.notes?.billing_address) || profileBilling?.billing || null,
      shipping_address: selected.shipping_address || pick(r => r.payload?.payload?.payment_link?.entity?.notes?.shipping_address || pay(r)?.notes?.shipping_address) || profileBilling?.shipping || null,
      gstin: selected.gstin || pick(r => r.payload?.payload?.payment_link?.entity?.notes?.gstin || pay(r)?.notes?.gstin) || profileBilling?.gstin || null,
      email: selected.email || pick(r => r.payload?.payload?.payment_link?.entity?.customer?.email),
      contact: selected.contact || pick(r => r.payload?.payload?.payment_link?.entity?.customer?.contact),
      refunds: selected.refunds?.map(rf => {
        const w = refundsById.get(rf.id);
        if (!w) return rf;
        return {
          ...rf,
          currency: rf.currency || w.currency || null,
          comment: rf.comment || notesText(w.notes),
          description: rf.description || w.description || null,
          customer_id: rf.customer_id || w.customer_id || null,
          upi_transaction_id: rf.upi_transaction_id || w.acquirer_data?.upi_transaction_id || null,
          rrn: (rf as any).rrn || w.acquirer_data?.rrn || null,
        };
      }),
    } as Payment;
  })();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pageSize = 20;
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['employee-razorpay-history', user?.id, days, status],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.functions.invoke<{ payments: Payment[]; nextOffset: number | null; counts: Counts; amounts?: Amounts }>('unified-verify-payment', {
        body: { action: 'employee-payment-history', days, offset: pageParam, limit: pageSize, filter: status === 'history' ? 'all' : status },
      });
      if (error) throw error;
      if (!data?.payments) throw new Error('Payment history unavailable');
      return { ...data, payments: data.payments.map(payment => ({
        ...payment,
        refunds: payment.refunds?.map(refund => ({ ...refund, ...refundDisplay(refund) })),
      })) };
    },
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.nextOffset ?? undefined,
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const payments = data?.pages.flatMap(page => page.payments) ?? [];
  // Server counts cover the whole period; fall back to the loaded rows if absent.
  const { counts, amounts }: { counts: Counts; amounts: Amounts } = (() => {
    const server = data?.pages[0]?.counts;
    const serverAmounts = data?.pages[0]?.amounts;
    if (server && server.history > 0) return { counts: server, amounts: serverAmounts ?? emptyAmounts };
    const local = { ...emptyCounts, history: payments.length };
    const localAmounts = { ...emptyAmounts };
    for (const p of payments) {
      const bucket = ['failed', 'expired', 'cancelled'].includes(p.status) ? 'failed' as const
        : (p.status === 'refunded' || p.status === 'partially_refunded' || (p.refunds?.length ?? 0) > 0) ? 'refund' as const : 'success' as const;
      local[bucket]++;
      localAmounts[bucket] += bucket === 'refund' ? (p.refunded_amount ?? p.amount) : p.amount;
      localAmounts.history += p.amount;
    }
    return local.history > 0
      ? { counts: local, amounts: localAmounts }
      : { counts: server ?? emptyCounts, amounts: serverAmounts ?? emptyAmounts };
  })();
  const queryClient = useQueryClient();
  // Prefetch invoices for listed payments so the sheet shows Invoice ID instantly.
  const paymentKey = payments.map(p => `${p.id}:${p.status}`).join(',');
  useEffect(() => {
    payments.filter(p => p.id.startsWith('pay_')).filter(p => p.status === 'captured' || p.status === 'refunded' || p.status === 'partially_refunded').forEach(p => {
      void queryClient.prefetchQuery({ queryKey: invoiceQueryKey(p.id), queryFn: () => fetchRazorpayInvoice(p.id), staleTime: INVOICE_STALE_MS, retry: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentKey, queryClient]);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const downloadSelectedPdf = async () => {
    if (!selected) return;
    setDownloadingPdf(true);
    try {
      let invoiceId: string | null = null;
      if (selected.provider === 'paypal') invoiceId = null; // PayPal IDs render in the PDF's PayPal Details section.
      else if (!['failed', 'expired', 'cancelled'].includes(selected.status)) {
        try {
          const inv = await queryClient.fetchQuery<InvoiceResult>({ queryKey: invoiceQueryKey(selected.id), queryFn: () => fetchRazorpayInvoice(selected.id), staleTime: INVOICE_STALE_MS, retry: false });
          invoiceId = inv?.invoice?.invoice_id ?? null;
        } catch { /* invoice optional */ }
      }
      await downloadPaymentDetailsPdf((selectedView ?? selected) as any, invoiceId);
    } catch {
      toast.error("Couldn't create the PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };
  const selectedLabel = filters.find(filter => filter.days === days)?.label ?? 'Today';
  const statusLabel = statusFilters.find(filter => filter.key === status)?.label ?? 'History';

  const downloadPdf = async () => {
    if (downloading || isLoading) return;
    setDownloading(true);
    const selectedDays = days;
    const label = filters.find(filter => filter.days === selectedDays)?.label ?? 'Today';
    const end = new Date();
    const start = new Date(end);
    if (selectedDays === 1) {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(end);
      const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
      start.setTime(new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00+05:30`).getTime());
    } else {
      start.setDate(start.getDate() - selectedDays);
    }

    const allPayments: Payment[] = [];
    const batchSize = 50;
    try {
      for (let offset = 0; ; offset += batchSize) {
        const { data: response, error } = await supabase.functions.invoke<{ payments: Payment[]; nextOffset: number | null }>('unified-verify-payment', {
          body: { action: 'employee-payment-history', days: selectedDays, offset, limit: batchSize },
        });
        if (error) throw error;
        const batch = response?.payments ?? [];
        allPayments.push(...batch.map(payment => ({ ...payment, refunds: payment.refunds?.map(refund => ({ ...refund, ...refundDisplay(refund) })) })));
        if (!response?.nextOffset || batch.length === 0) break;
      }
      const { downloadPaymentHistoryPdf } = await import('@/lib/paymentHistoryPdf');
      downloadPaymentHistoryPdf(allPayments, label, start, end);
      toast.success('Payment History PDF downloaded');
    } catch (downloadError) {
      console.error('Payment History PDF download failed', downloadError);
      toast.error("Couldn't download payment history. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) void fetchNextPage();
      },
      { root: null, rootMargin: '240px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, payments.length]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-2 px-3 sm:px-5">
          <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => goBack(navigate, '/employer-portal')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-lg font-semibold">Payment History</h1>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Payment profile" title="Payment profile" onClick={() => navigate('/payment-profile')}>
            <UserCircle2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Download ${selectedLabel} payment history PDF`} title="Download PDF" disabled={downloading || isLoading} onClick={downloadPdf}>
            {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl">
        <div className="sticky top-0 z-30 border-b border-border bg-background">
          <div className="grid w-full grid-cols-3 border-b border-border" role="group" aria-label="Payment date range">
            {filters.map(filter => (
              <Button
                key={filter.days}
                type="button"
                variant="ghost"
                aria-pressed={days === filter.days}
                onClick={() => setDays(filter.days)}
                className={`h-11 w-full rounded-none border-b-2 text-sm font-medium ${days === filter.days ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <div className="grid w-full grid-cols-4" role="group" aria-label={`Payment counts for ${selectedLabel}`}>
            {statusFilters.map((filter, index) => {
              const isHistory = filter.key === 'history';
              const value = counts[filter.key];
              const bucketAmount = isHistory ? 0 : amounts[filter.key];
              return (
                <div
                  key={filter.key}
                  className={`flex h-16 w-full flex-col items-center justify-center gap-0 px-1 ${index > 0 ? 'border-l border-border' : ''}`}
                >
                  {isHistory ? (
                    <span className="text-base font-semibold leading-5 tabular-nums text-foreground">{value.toLocaleString('en-IN')}</span>
                  ) : (
                    <span className={`text-base font-semibold leading-5 tabular-nums ${filter.key === 'failed' ? 'text-destructive' : filter.key === 'success' ? 'text-success' : 'text-warning'}`}>₹{bucketAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                  )}
                  <span className="text-[11px] leading-4 text-muted-foreground">{filter.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <section aria-label="Payment history" className="w-full pb-[max(1rem,env(safe-area-inset-bottom))]">
          {isLoading ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground" role="status">Loading payments…</p>
          ) : isError ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-muted-foreground">Payment history could not be loaded.</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-4">Try again</Button>
            </div>
          ) : !payments.length ? (
            <div className="px-4 py-14 text-center text-muted-foreground">
              <ReceiptText className="mx-auto mb-3 h-8 w-8" aria-hidden="true" />
              <p className="text-sm">{status === 'history' ? 'No payments in this period.' : `No ${statusLabel.toLowerCase()} payments in this period.`}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {payments.map(payment => {
                const { refunded, successful, refundFailed, refundSuccessful, tone, text: statusText } = paymentStatusInfo(payment);
                const created = new Date(payment.created_at);
                return (
                  <article
                    key={payment.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${payment.label}, open full payment details`}
                    onClick={() => setSelected(payment)}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(payment); } }}
                    className="grid w-full min-w-0 cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-x-3 px-4 py-4 transition-colors hover:bg-muted/40 active:bg-muted/60 sm:px-5"
                  >
                    <div className={`mt-0.5 shrink-0 ${tone}`}>
                      {successful ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : refunded ? <RotateCcw className="h-5 w-5" aria-hidden="true" /> : <XCircle className="h-5 w-5" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{payment.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {created.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                        {' · '}
                        {created.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                      </p>
                    </div>

                    <div className="min-w-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className={`mt-1 text-xs font-semibold ${tone}`}>{statusText}</p>
                    </div>
                     <div className={`col-start-2 col-end-4 mt-1 min-w-0 items-baseline gap-x-2 gap-y-0.5 ${refundSuccessful ? 'grid grid-cols-[minmax(0,1fr)_auto]' : 'flex flex-wrap justify-between'}`}>
                      <p className="min-w-0 break-all text-[11px] text-muted-foreground sm:text-xs">{payment.rrn ? `RRN: ${payment.rrn}` : payment.id}</p>
                      {refundSuccessful && <p className="ml-auto shrink-0 text-[11px] font-medium text-success">Refund Success</p>}
                      {refunded && !refundSuccessful && (refundFailed ? (
                        <Button variant="link" className="ml-auto h-auto shrink-0 p-0 text-[9px] leading-3 text-destructive hover:text-destructive sm:text-[10px] sm:leading-4" onClick={event => { event.stopPropagation(); navigate('/contact-us'); }}>Contact Us</Button>
                      ) : (
                         <p className="ml-auto text-right text-[11px] leading-4 text-muted-foreground sm:text-xs">Refund can take up to 7 days.</p>
                      ))}
                    </div>
                  </article>

                );
              })}
              <div ref={sentinelRef} className="h-px" aria-hidden="true" />
              {isFetchingNextPage && (
                <div className="flex justify-center py-4" role="status">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="sr-only">Loading more payments</span>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <NativeBottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.label}>
        {selectedView && (() => {
          const selected = selectedView;
          const info = paymentStatusInfo(selected);
          const isUpi = (selected.method ?? '').toLowerCase() === 'upi';
          const methodKey = (selected.method ?? '').toLowerCase();
          return (
            <div className="space-y-5">
              {selected.provider === 'paypal' ? (
                <>
                  {selected.paypal_capture_id ? <CopyDetailRow label="Payment ID" copyValue={selected.paypal_capture_id} viewUrl={`https://www.paypal.com/activity/payment/${selected.paypal_capture_id}`} /> : null}
                  {selected.paypal_order_id ? <CopyDetailRow label="PayPal Order ID" copyValue={selected.paypal_order_id} /> : null}
                  {selected.transaction_id ? <CopyDetailRow label="Transaction ID" copyValue={selected.transaction_id} /> : null}
                  {selected.customer_id ? <CopyDetailRow label="Payer ID" copyValue={selected.customer_id} /> : null}
                  {selected.event_id ? <CopyDetailRow label="Event ID" copyValue={selected.event_id} /> : null}
                  <div className="space-y-3">
                    <DetailRow label="Method" value="PayPal" />
                    {selected.payer_name ? <DetailRow label="Payer Name" value={selected.payer_name} /> : null}
                    {selected.amount_usd ? <DetailRow label="Charged (USD)" value={`$${Number(selected.amount_usd).toFixed(2)} USD`} /> : null}
                    <DetailRow label="Confirmation" value={<span className={selected.webhook_verified ? 'text-success' : 'text-warning'}>{selected.webhook_verified ? 'Confirmed by PayPal' : 'Awaiting PayPal confirmation'}</span>} />
                  </div>
                </>
              ) : (
                <>
              <CopyDetailRow label={selected.id.startsWith("plink_") ? "Payment Link ID" : "Payment ID"} copyValue={selected.id} />
              {selected.transaction_id ? <CopyDetailRow label="Transaction ID" copyValue={selected.transaction_id} /> : null}
              {selected.customer_id ? <CopyDetailRow label="Customer ID" copyValue={selected.customer_id} /> : null}
              {selected.event_id ? <CopyDetailRow label="Event ID" copyValue={selected.event_id} /> : null}
              {selected.subscription_id ? <CopyDetailRow label="Subscription ID" copyValue={selected.subscription_id} /> : null}
              {selected.reference_id ? <CopyDetailRow label="Reference ID" copyValue={selected.reference_id} /> : null}
              {selected.id.startsWith('pay_') ? <RazorpayInvoiceSection paymentId={selected.id} paymentStatus={selected.status} /> : null}
              {selected.method && (
                <div className="min-w-0 space-y-3">
                   <DetailRow label="Method" value={methodLabel(selected.method, selected.card_type)} />
                   {isUpi && selected.vpa ? (
                    <CopyDetailRow label="Payer UPI ID" copyValue={selected.vpa} />
                  ) : methodKey === 'card' && (selected.card_network || selected.card_last4) ? (
                    <DetailRow label="Card Details" value={`${selected.card_network ?? 'Card'} ${selected.card_last4 ? `•• ${selected.card_last4}` : ''}`.trim()} />
                   ) : ['bank', 'netbanking'].includes(methodKey) && selected.bank_name ? (
                    <DetailRow label="Bank" value={selected.bank_name} />
                   ) : ['wallet', 'paylater', 'cardless_emi'].includes(methodKey) && (selected.wallet || selected.bank_name) ? (
                     <DetailRow label="Provider" value={methodLabel(selected.wallet || selected.bank_name || '')} />
                  ) : null}
                   {methodKey === 'card' && selected.bank_name ? <DetailRow label="Bank" value={selected.bank_name} /> : null}
                </div>
              )}
                </>
              )}
              <div className="space-y-3">
                <DetailRow label="Status" value={<span className={`font-semibold ${info.tone}`}>{info.text}</span>} />
                <DetailRow label="Amount" value={`₹${selected.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                <DetailRow label="Currency" value={selected.currency ?? 'INR'} />
                {selected.description ? <DetailRow label="Description" value={selected.description} /> : null}
                <DetailRow label="Received" value={fmtDateTime(selected.created_at)} />
                 {selected.rrn ? <CopyDetailRow label="RRN" copyValue={selected.rrn} /> : null}
                {selected.order_id && <CopyDetailRow label="Order ID" copyValue={selected.order_id} />}
              </div>
               {selected.contact || selected.email || selected.billing_address || selected.shipping_address || selected.gstin ? (
                 <div className="space-y-3 border-t border-border pt-4">
                   <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer Details</p>
                   {selected.contact ? <CopyDetailRow label="Mobile Number" copyValue={selected.contact} /> : null}
                   {selected.email ? <CopyDetailRow label="Email ID" copyValue={selected.email} /> : null}
                   {selected.gstin ? <CopyDetailRow label="GSTIN" copyValue={selected.gstin} /> : null}
                   {selected.billing_address ? <DetailRow label="Billing Address" value={selected.billing_address} /> : null}
                   {selected.shipping_address ? <DetailRow label="Shipping Address" value={selected.shipping_address} /> : null}
                 </div>
               ) : null}
              {info.refunded && selected.refunds?.length ? (
                <div className="space-y-4 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Refund Updates</p>
                  {selected.refunds.map(refund => (
                    <div key={refund.id} className="space-y-3">
                      <CopyDetailRow label="Refund ID" copyValue={refund.id} />
                       <DetailRow label="Refund Speed" value={<span className={refundSpeedTone(refund)}>{refundSpeedLabel(refund)}</span>} />
                       <DetailRow label="Refund Status" value={<span className={refund.display_status === 'failed' ? 'text-destructive' : refundStatusText(refund) === 'Refund Success' ? 'text-success' : 'text-warning'}>{refundStatusText(refund)}</span>} />
                      {selected.refunded_amount ? <DetailRow label="Refunded Amount" value={`₹${selected.refunded_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} /> : null}
                       {refund.currency ? <DetailRow label="Currency" value={refund.currency} /> : null}
                       {refund.comment ? <DetailRow label="Comment" value={refund.comment} /> : null}
                       {refund.description ? <DetailRow label="Description" value={refund.description} /> : null}
                       {refund.customer_id ? <CopyDetailRow label="Customer ID" copyValue={refund.customer_id} /> : null}
                       {refund.upi_transaction_id ? <CopyDetailRow label="UPI Transaction ID" copyValue={refund.upi_transaction_id} /> : null}
                       <RefundTracker refund={refund} payment={selected} />
                    </div>
                  ))}
                </div>
              ) : null}
              {['failed', 'expired', 'cancelled'].includes(selected.status) ? (
                <div className="border-t border-border pt-4">
                  <DetailRow label="Error Details" value={selected.error_description || selected.error_reason || selected.error_code || 'Payment failed. No additional details were provided.'} />
                </div>
              ) : null}
              <Button className="w-full gap-2" onClick={() => void downloadSelectedPdf()} disabled={downloadingPdf}>
                {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download PDF
              </Button>
            </div>
          );
        })()}
      </NativeBottomSheet>
    </div>
  );
}