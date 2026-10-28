import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Loader2, RefreshCw, AlertCircle, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fetchSocialAutoReplyLog } from '@/hooks/useSocialConnect';
import { getUserBotReplies } from '@/hooks/useUserTelegramBot';
import { getGmailReplies } from '@/hooks/useUserGmail';
import { getOutlookReplies } from '@/hooks/useUserOutlook';
import { getCustomEmailReplies } from '@/hooks/useUserCustomEmail';
import { formatDateOnly } from '@/utils/dateFormatUtils';

const LABELS: Record<string, string> = {
  x: 'X (Twitter)',
  linkedin: 'LinkedIn',
  telegram: 'Telegram',
  gmail: 'Gmail',
  outlook: 'Outlook',
  email: 'Domain email',
};

interface ReplyRow {
  id: string;
  author: string;
  incoming: string | null;
  reply: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

/** Aaj (IST) ki date key — date change hone par refresh trigger karti hai. */
const istDateKey = (d: Date | string = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof d === 'string' ? new Date(d) : d);

export default function AIConnectRepliesToday() {
  const navigate = useNavigate();
  const { platform = '' } = useParams();
  const key = platform.toLowerCase();
  const label = LABELS[key] || 'AI Connect';

  const [items, setItems] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const dayRef = useRef(istDateKey());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let rows: ReplyRow[] = [];

      if (key === 'x' || key === 'linkedin') {
        const log = await fetchSocialAutoReplyLog(key as 'x' | 'linkedin', 100, true);
        rows = log.map((l) => ({
          id: l.id,
          author: l.author_name || 'Someone',
          incoming: l.comment_text,
          reply: l.reply_text,
          status: l.status,
          error: l.error,
          created_at: l.created_at,
        }));
      } else if (key === 'telegram') {
        const res: any = await getUserBotReplies(100);
        rows = (res?.items || []).map((l: any) => ({
          id: l.id,
          author: l.from_name || 'Customer',
          incoming: l.user_message,
          reply: l.ai_reply,
          status: l.status,
          error: l.error ?? null,
          created_at: l.created_at,
        }));
      } else if (key === 'gmail' || key === 'email' || key === 'outlook') {
        const res: any = key === 'gmail'
          ? await getGmailReplies(100)
          : key === 'outlook'
            ? await getOutlookReplies(100)
            : await getCustomEmailReplies(100);
        rows = (res?.items || []).map((l: any) => ({
          id: l.id,
          author: l.from_email || 'Sender',
          incoming: l.subject,
          reply: l.reply_text,
          status: l.status,
          error: l.error ?? null,
          created_at: l.created_at,
        }));
      }

      // Sirf aaj (IST) ka data
      const today = istDateKey();
      dayRef.current = today;
      setItems(rows.filter((r) => istDateKey(r.created_at) === today));
    } catch (e: any) {
      toast.error(e?.message || 'Could not load replies');
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => { load(); }, [load]);

  // Date badalne par (midnight IST / app wapas open) auto refresh
  useEffect(() => {
    const check = () => {
      if (istDateKey() !== dayRef.current) load();
    };
    const id = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [load]);

  const replied = items.filter((i) => i.status === 'replied' || i.status === 'sent').length;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{label} AI replies today | Workly India</title>
        <meta name="description" content={`Aaj ke AI auto replies — ${label} par bheje gaye jawab.`} />
      </Helmet>

      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card px-3 py-2 safe-top">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-foreground truncate">{label} — recent AI replies</h1>
          <p className="text-[11px] text-muted-foreground">{formatDateOnly(new Date())} · {replied} replied</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      <main className="p-3 space-y-2 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Bot className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Aaj abhi tak koi AI reply nahi hua.</p>
          </div>
        ) : (
          items.map((l) => (
            <article key={l.id} className="rounded-lg border border-border bg-card p-2">
              <p className="text-[10px] text-muted-foreground truncate">
                {new Date(l.created_at).toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-[11px] text-foreground break-words">
                <span className="font-medium">{l.author}:</span> {l.incoming || '—'}
              </p>
              {l.reply && <p className="mt-1 text-[11px] text-primary break-words">↳ {l.reply}</p>}
              {l.status !== 'replied' && l.status !== 'sent' && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600">
                  <AlertCircle className="h-3 w-3" /> {l.status}
                  {l.error ? `: ${l.error}` : ''}
                </p>
              )}
            </article>
          ))
        )}
      </main>
    </div>
  );
}
