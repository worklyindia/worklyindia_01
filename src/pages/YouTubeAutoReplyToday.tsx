import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Loader2, RefreshCw, AlertCircle, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fetchAutoReplyLog, type YTAutoReplyLogItem } from '@/hooks/useYouTubeGrowth';
import { formatDateOnly } from '@/utils/dateFormatUtils';

/** Aaj (IST) ki date key — date badalne par refresh trigger karti hai. */
const istDateKey = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export default function YouTubeAutoReplyToday() {
  const navigate = useNavigate();
  const [items, setItems] = useState<YTAutoReplyLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const dayRef = useRef(istDateKey());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // todayOnly: sirf aaj (IST) ka data — purana data server par delete ho jata hai
      const data = await fetchAutoReplyLog(100, true);
      dayRef.current = istDateKey();
      setItems(data);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load replies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Date change (midnight IST) ya app wapas open hone par auto refresh
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

  const replied = items.filter((i) => i.status === 'replied').length;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Today's AI Replies | YouTube Auto Reply</title>
        <meta name="description" content="Aaj ke AI auto replies — YouTube comments par bheje gaye jawab." />
      </Helmet>

      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-foreground">Recent AI replies</h1>
          <p className="text-[11px] text-muted-foreground">{formatDateOnly(new Date())} · {replied} replied</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      <main className="p-3 space-y-2 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Bot className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Aaj abhi tak koi AI reply nahi hua.</p>
          </div>
        ) : (
          items.map((l) => (
            <article key={l.id} className="rounded-lg border border-border bg-card p-2">
              <p className="text-[10px] text-muted-foreground truncate">
                {l.video_title || l.video_id} · {new Date(l.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })}
              </p>
              <p className="text-[11px] text-foreground"><span className="font-medium">{l.author_name}:</span> {l.comment_text}</p>
              {l.reply_text && <p className="text-[11px] text-red-600 mt-1">↳ {l.reply_text}</p>}
              {l.status !== 'replied' && (
                <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {l.status}{l.error ? `: ${l.error}` : ''}
                </p>
              )}
            </article>
          ))
        )}
      </main>
    </div>
  );
}
