import { useEffect, useState } from 'react';
import { goBack } from "@/lib/goBack";
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCw, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { fetchSeoAudit, type YTSeoAudit } from '@/hooks/useYouTubeGrowth';

function healthTone(n: number) {
  if (n >= 80) return 'text-emerald-600';
  if (n >= 55) return 'text-amber-600';
  return 'text-rose-600';
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2.5 shadow-sm">
      <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      <p className={`text-base font-bold leading-none mt-1 ${tone || 'text-foreground'}`}>{value}</p>
    </div>
  );
}

export default function YouTubeSeoAudit() {
  const navigate = useNavigate();
  const [audit, setAudit] = useState<YTSeoAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setAudit(await fetchSeoAudit());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Audit failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="min-h-screen bg-background pb-16">
      <Helmet>
        <title>AI SEO Audit | YouTube Studio</title>
        <meta name="description" content="AI-powered YouTube SEO audit: find videos with weak titles, thin descriptions, missing tags, missing hashtags or the wrong category." />
      </Helmet>

      <header className="sticky top-0 z-30 bg-[#0f0f0f] text-white px-2 py-2.5 flex items-center gap-2 shadow-md">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, '/ai-assistant')} className="text-white hover:bg-white/10 h-9 w-9" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold truncate">AI SEO audit</h1>
          <p className="text-[11px] text-white/70 truncate">
            {audit?.channel?.title || 'Scan your uploads for SEO problems'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading} className="text-white hover:bg-white/10 h-9 w-9" aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      <main className="px-3 py-3 space-y-3 max-w-3xl mx-auto">
        {loading && !audit ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-red-600" /></div>
        ) : error ? (
          <p className="text-[11px] text-rose-600">{error}</p>
        ) : audit ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Videos scanned" value={String(audit.totals.scanned)} />
              <Stat label="Need work" value={String(audit.totals.needsWork)} tone={audit.totals.needsWork ? 'text-rose-600' : 'text-emerald-600'} />
              <Stat label="Wrong category" value={String(audit.totals.categoryMismatch)} tone={audit.totals.categoryMismatch ? 'text-amber-600' : 'text-emerald-600'} />
              <Stat label="Avg SEO health" value={`${audit.totals.avgHealth}%`} tone={healthTone(audit.totals.avgHealth)} />
            </div>

            <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="text-xs font-semibold text-foreground mb-1">Channel category</p>
              <p className="text-[11px] text-muted-foreground">
                {audit.channel.primaryCategoryTitle
                  ? <>Your channel mostly posts in <span className="font-medium text-foreground">{audit.channel.primaryCategoryTitle}</span>. Videos outside this category are flagged below so your uploads stay consistent for the algorithm.</>
                  : 'Not enough uploads yet to detect your main category.'}
              </p>
              {!audit.canEdit && (
                <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-700">
                  Edit permission missing — reconnect your channel to apply AI fixes automatically.
                </p>
              )}
            </section>

            <section className="space-y-2">
              {audit.items.map((v) => (
                <div key={v.videoId} className="rounded-xl border border-border bg-card p-2.5 shadow-sm">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{v.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {v.isShort ? 'Short' : 'Video'} · {v.categoryTitle || 'No category'} · {v.tagCount} tags
                      </p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${healthTone(v.health)}`}>{v.health}%</span>
                  </div>

                  {v.problems.length ? (
                    <ul className="mt-2 space-y-1">
                      {v.problems.map((p, i) => (
                        <li key={i} className="flex gap-1.5 text-[11px] text-muted-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-px" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 flex gap-1.5 text-[11px] text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-px" /> SEO looks good
                    </p>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 text-[11px]"
                    onClick={() => navigate(`/ai-assistant/youtube/video/${v.videoId}/edit`)}
                  >
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Fix with AI
                  </Button>
                </div>
              ))}
              {!audit.items.length && (
                <p className="text-[11px] text-muted-foreground">No uploads found to audit yet.</p>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
