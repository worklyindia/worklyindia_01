import { useNavigate } from 'react-router-dom';
import { goBack } from "@/lib/goBack";
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useYouTubeGrowth } from '@/hooks/useYouTubeGrowth';
import { formatCount } from '@/utils/formatNumber';
import AutoReplyHeaderToggle from '@/components/social/AutoReplyHeaderToggle';

function parseKeywords(raw: string): string[] {
  const out: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const k = (m[1] || m[2] || '').trim();
    if (k) out.push(k);
  }
  return Array.from(new Set(out));
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex gap-2 py-1.5 border-b border-border/60 last:border-0">
      <span className="w-32 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="flex-1 text-[11px] text-foreground break-words">{value}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <p className="text-xs font-semibold text-foreground mb-2">{title}</p>
      {children}
    </section>
  );
}

export default function YouTubeChannelSettings() {
  const navigate = useNavigate();
  const { snapshot, checking, loading, connection } = useYouTubeGrowth();
  const c = snapshot?.channel;

  return (
    <div className="min-h-screen bg-background pb-16">
      <Helmet>
        <title>Channel Settings & About | YouTube Studio</title>
        <meta name="description" content="Full YouTube channel details: description, handle, channel ID, country, keywords, topics, status and lifetime stats." />
      </Helmet>

      <header className="sticky top-0 z-30 bg-[#0f0f0f] text-white px-2 py-2.5 flex items-center gap-2 shadow-md">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, '/ai-assistant')} className="text-white hover:bg-white/10 h-9 w-9" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold truncate">Channel settings</h1>
          <p className="text-[11px] text-white/70 truncate">{c?.title || connection?.channelTitle || 'About this channel'}</p>
        </div>
        <AutoReplyHeaderToggle platform="youtube" connected={!!c} />
        {c?.customUrl && (
          <a
            href={`https://www.youtube.com/${c.customUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-white/10"
            aria-label="Open channel on YouTube"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </header>

      <main className="px-3 py-3 space-y-3 max-w-3xl mx-auto">
        {(checking || loading) && !c ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-red-600" /></div>
        ) : !c ? (
          <p className="text-[11px] text-muted-foreground">Connect your YouTube channel first to see channel details.</p>
        ) : (
          <>
            <section className="rounded-xl border border-border bg-card p-3 shadow-sm flex gap-3">
              {c.thumbnail && <img src={c.thumbnail} alt={c.title} className="h-14 w-14 rounded-full object-cover bg-muted shrink-0" loading="lazy" />}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{c.customUrl}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatCount(c.subscriberCount || 0)} subscribers · {formatCount(c.videoCount || 0)} videos · {formatCount(c.viewCount || 0)} lifetime views
                </p>
              </div>
            </section>


            <Card title="AI SEO Master">
              <p className="text-[11px] text-muted-foreground mb-2">
                Scan your latest uploads for weak titles, thin descriptions, missing tags or hashtags,
                and videos posted outside your channel's main category — then fix them with AI.
              </p>
              <Button size="sm" className="h-8 text-[11px] bg-red-600 hover:bg-red-700 text-white" onClick={() => navigate('/ai-assistant/youtube/seo')}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Run AI SEO audit
              </Button>
            </Card>





            {c.description && (
              <Card title="About this channel">
                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words">{c.description}</p>
              </Card>
            )}

            <Card title="Channel details">
              <Row label="Handle" value={c.customUrl} />
              <Row label="Channel ID" value={c.id} />
              <Row label="Created" value={c.publishedAt ? new Date(c.publishedAt).toLocaleDateString() : null} />
              <Row label="Country" value={c.country} />
              <Row label="Status" value={c.privacyStatus} />
              <Row label="Made for kids" value={c.madeForKids == null ? null : c.madeForKids ? 'Yes' : 'No'} />
              <Row label="Hidden subs" value={c.hiddenSubscriberCount == null ? null : c.hiddenSubscriberCount ? 'Yes' : 'No'} />
              <Row label="Subscribers" value={formatCount(c.subscriberCount || 0)} />
              <Row label="Videos" value={formatCount(c.videoCount || 0)} />
              <Row label="Lifetime views" value={formatCount(c.viewCount || 0)} />
            </Card>

            {(c.keywords || !!c.topicCategories?.length) && (
              <Card title="Keywords & topics">
                {c.keywords && (
                  <div className="mb-3">
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                      Keywords ({parseKeywords(c.keywords).length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {parseKeywords(c.keywords).map((k, i) => (
                        <span
                          key={`${k}-${i}`}
                          className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {!!c.topicCategories?.length && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                      Topics ({c.topicCategories.length}) · YouTube auto-detected
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.topicCategories.map((t, i) => (
                        <span
                          key={`${t}-${i}`}
                          className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground"
                        >
                          {String(t).split('/').pop()?.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            <Card title="Channel category">
              {c.categories?.length ? (
                <>
                  {c.primaryCategory && (
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                      Primary category · <span className="text-foreground font-medium">{c.primaryCategory}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {c.categories.map((cat, i) => (
                      <span
                        key={`${cat.id}-${i}`}
                        className="inline-flex items-center rounded-full bg-red-600/10 px-2.5 py-1 text-[11px] font-medium text-red-600"
                      >
                        {cat.name} · {cat.count}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Category detect nahi hui. Studio page par Refresh dabakar dobara load karein.
                </p>
              )}
            </Card>



            {c.banner && (
              <Card title="Channel banner">
                <img src={c.banner} alt="Channel banner" loading="lazy" className="w-full rounded-lg object-cover" />
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
