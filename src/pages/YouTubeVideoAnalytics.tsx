import { useEffect, useState } from 'react';
import { goBack } from "@/lib/goBack";
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowLeft, Clock, Eye, Loader2, MessageSquare, Pencil, Play, Share2,
  ThumbsUp, UserPlus,

} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchVideoAnalytics, type YouTubeVideoAnalytics } from '@/hooks/useYouTubeGrowth';
import { formatCount } from '@/utils/formatNumber';

const RANGES: Array<{ label: string; value: 0 | 7 | 28 | 90 | 365 }> = [
  { label: '7 days', value: 7 },
  { label: '28 days', value: 28 },
  { label: '90 days', value: 90 },
  { label: '1 year', value: 365 },
  { label: 'Lifetime', value: 0 },
];

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card border border-border p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}<span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold text-foreground leading-none">{value}</div>
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

function BarList({ rows }: { rows: Array<{ key: string; views: number }> }) {
  if (!rows?.length) return <p className="text-[11px] text-muted-foreground">Data unavailable</p>;
  const max = rows[0].views || 1;
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="w-28 text-[11px] text-muted-foreground truncate shrink-0">{r.key}</span>
          <span className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <span className="block h-full rounded-full bg-red-500" style={{ width: `${(r.views / max) * 100}%` }} />
          </span>
          <span className="w-10 text-right text-[11px] text-muted-foreground">{formatCount(r.views)}</span>
        </div>
      ))}
    </div>
  );
}

export default function YouTubeVideoAnalytics() {
  const { videoId = '' } = useParams();
  const navigate = useNavigate();
  const [days, setDays] = useState<0 | 7 | 28 | 90 | 365>(28);
  const [data, setData] = useState<YouTubeVideoAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // Reset the player when navigating to a different video
  useEffect(() => { setPlaying(false); }, [videoId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchVideoAnalytics(videoId, days)
      .then((res) => { if (alive) setData(res); })
      .catch((e) => { if (alive) setError(e?.message || 'Could not load video analytics'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [videoId, days]);

  const daily = (data?.daily || []).map((d) => ({
    date: d.date.length > 5 ? d.date.slice(5) : d.date,
    views: d.views,
    watch: Math.round(d.estimatedMinutesWatched / 60),
    subs: d.subscribersGained - d.subscribersLost,
  }));

  // Hide the range filters when there is no analytics data at all (avoids confusion)
  const hasAnalytics = !!data && !data.analyticsError && (
    (data.totals?.views || 0) > 0 ||
    (data.totals?.estimatedMinutesWatched || 0) > 0 ||
    daily.some((d) => d.views > 0)
  );


  return (
    <div className="min-h-screen bg-background pb-16">
      <Helmet>
        <title>{data?.video?.title ? `${data.video.title.slice(0, 45)} | Video Analytics` : 'Video Analytics'}</title>
        <meta name="description" content="Per-video YouTube analytics: views, watch time, retention, subscribers, traffic sources and audience." />
      </Helmet>

      <header className="sticky top-0 z-30 bg-[#0f0f0f] text-white px-2 py-2.5 flex items-center gap-2 shadow-md">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, '/ai-assistant')} className="text-white hover:bg-white/10 h-9 w-9" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold truncate">Video analytics</h1>
          <p className="text-[11px] text-white/70 truncate">{data?.video?.title || videoId}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/ai-assistant/youtube/video/${videoId}/edit`)}
          className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-white/10"
          aria-label="Edit video details"
        >
          <Pencil className="h-4 w-4" />
        </button>

      </header>

      <main className="px-3 py-3 space-y-3 max-w-3xl mx-auto">
        {hasAnalytics && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setDays(r.value)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-colors ${
                  days === r.value ? 'bg-red-600 text-white border-red-600' : 'bg-card text-muted-foreground border-border'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}


        {loading && !data ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-red-600" /></div>
        ) : error ? (
          <p className="text-[11px] text-rose-600">{error}</p>
        ) : data ? (
          <>
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-3">
              <div
                className={`relative mx-auto w-full overflow-hidden rounded-lg bg-black ${
                  data.video.isShort ? 'max-w-[260px] aspect-[9/16]' : 'aspect-video'
                }`}
              >
                {playing ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`}
                    title={data.video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full border-0"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    aria-label={`Play ${data.video.title}`}
                    className="group absolute inset-0 h-full w-full"
                  >
                    <img
                      src={data.video.thumbnail}
                      alt={data.video.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 shadow-lg">
                        <Play className="h-6 w-6 translate-x-[1px] fill-current text-primary-foreground" />
                      </span>
                    </span>
                  </button>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground line-clamp-3">{data.video.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {data.video.isShort ? 'Short' : 'Video'} · {new Date(data.video.publishedAt).toLocaleDateString()} · {data.video.ageDays}d ago
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Lifetime: {formatCount(data.video.lifetime.views)} views · {formatCount(data.video.lifetime.likes)} likes · {formatCount(data.video.lifetime.comments)} comments · {data.video.lifetime.engagementRate}% eng
                </p>
              </div>
            </div>

            {data.analyticsError && (
              <p className="text-[11px] text-amber-600">Analytics API unavailable: {data.analyticsError}</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Metric icon={<Eye className="h-3 w-3" />} label="Views" value={formatCount(data.totals.views)} />
              <Metric icon={<Clock className="h-3 w-3" />} label="Watch hours" value={formatCount(Math.round(data.totals.estimatedMinutesWatched / 60))} />
              <Metric icon={<Clock className="h-3 w-3" />} label="Avg view duration" value={`${Math.round(data.totals.averageViewDuration)}s`} />
              <Metric icon={<Clock className="h-3 w-3" />} label="Avg viewed %" value={`${data.totals.averageViewPercentage}%`} />
              <Metric icon={<UserPlus className="h-3 w-3" />} label="Net subscribers" value={formatCount(data.totals.netSubscribers)} />
              <Metric icon={<Share2 className="h-3 w-3" />} label="Shares" value={formatCount(data.totals.shares)} />
              <Metric icon={<ThumbsUp className="h-3 w-3" />} label="Likes / dislikes" value={`${formatCount(data.totals.likes)} / ${formatCount(data.totals.dislikes)}`} />
              <Metric icon={<MessageSquare className="h-3 w-3" />} label="Comments" value={formatCount(data.totals.comments)} />
            </div>

            {daily.length > 1 && (
              <Card title="Views per day">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={daily} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ytVidViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#dc2626" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9 }} width={40} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="views" stroke="#dc2626" strokeWidth={2} fill="url(#ytVidViews)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}

            {daily.length > 1 && (
              <Card title="Net subscribers per day">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={daily} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9 }} width={40} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="subs" radius={[3, 3, 0, 0]}>
                      {daily.map((d, i) => <Cell key={i} fill={d.subs >= 0 ? '#10b981' : '#f43f5e'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            <Card title="Traffic sources">
              <BarList rows={(data.trafficSources || []).map((t) => ({ key: t.source, views: t.views }))} />
            </Card>
            <Card title="Top countries"><BarList rows={data.countries || []} /></Card>
            <Card title="Devices"><BarList rows={data.devices || []} /></Card>
            <Card title="Subscribed vs not subscribed"><BarList rows={data.subscribedStatus || []} /></Card>

            <Card title="Video details">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Duration', value: `${Math.floor(data.video.durationSeconds / 60)}m ${data.video.durationSeconds % 60}s` },
                  { label: 'Quality', value: data.video.definition?.toUpperCase() || 'n/a' },
                  { label: 'Captions', value: data.video.caption ? 'Yes' : 'No' },
                  { label: 'Visibility', value: data.video.privacyStatus || 'n/a' },
                  { label: 'Views/day', value: String(data.video.lifetime.viewsPerDay) },
                  { label: 'Type', value: data.video.isShort ? 'Short' : 'Video' },
                ].map((d) => (
                  <div key={d.label} className="rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.label}</p>
                    <p className="text-xs font-semibold text-foreground capitalize">{d.value}</p>
                  </div>
                ))}
              </div>
            </Card>

            {!!data.video.tags?.length && (
              <Card title={`Tags (${data.video.tags.length})`}>
                <div className="flex flex-wrap gap-1.5">
                  {data.video.tags.map((t, i) => (
                    <span key={i} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {data.video.description && (
              <Card title="Description">
                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words">{data.video.description}</p>
              </Card>
            )}

          </>
        ) : null}
      </main>
    </div>
  );
}
