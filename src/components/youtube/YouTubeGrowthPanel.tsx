import { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  BarChart3, ChevronDown, ChevronUp, Eye, Loader2, LogOut, RefreshCw,
  Sparkles, ThumbsUp, TrendingDown, TrendingUp, UserPlus, Youtube,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useYouTubeGrowth, type YouTubeVideoStat } from '@/hooks/useYouTubeGrowth';
import { formatCount } from '@/utils/formatNumber';

interface Props {
  onAskAI: (prompt: string) => void;
}

const RANGES: Array<{ label: string; value: 7 | 28 | 90 | 365 }> = [
  { label: '7d', value: 7 },
  { label: '28d', value: 28 },
  { label: '90d', value: 90 },
  { label: '1y', value: 365 },
];

const AI_PROMPTS = [
  { emoji: '🔍', label: 'Analyze my channel', prompt: 'Analyze my YouTube channel using my real analytics: give me an overview, what is working, what is not working, problems detected, my scores, and a today / 7-day / 30-day action plan.' },
  { emoji: '📉', label: 'Why are views down?', prompt: 'Why are my YouTube views down? Use my real analytics data to diagnose the cause and tell me exactly what to fix first.' },
  { emoji: '✍️', label: 'Fix my titles', prompt: 'Look at my recent YouTube video titles and thumbnails performance and suggest better titles for my weakest videos, based on what already works on my channel.' },
  { emoji: '🏷️', label: 'SEO check', prompt: 'Act as my YouTube SEO master. Check my recent uploads for weak titles, thin descriptions, missing tags, missing hashtags and wrong category, then give me fixed title, description, hashtags and tags for each within YouTube limits.' },

  { emoji: '💡', label: 'Video ideas', prompt: 'Based on my top-performing YouTube topics, give me 10 new video ideas with titles and a one-line hook for each.' },
  { emoji: '📅', label: 'Upload plan', prompt: 'Build me a realistic 30-day YouTube upload and content plan based on my current upload cadence, format mix and engagement data.' },
  { emoji: '👥', label: 'Grow subscribers', prompt: 'My subscriber conversion rate — how do I improve it? Use my real subs-per-1000-views data and give me concrete steps.' },
];

const scoreColor = (n: number) =>
  n >= 70 ? 'text-emerald-600' : n >= 45 ? 'text-amber-600' : 'text-rose-600';
const scoreBar = (n: number) =>
  n >= 70 ? 'bg-emerald-500' : n >= 45 ? 'bg-amber-500' : 'bg-rose-500';

function Metric({ icon, label, value, change }: { icon: React.ReactNode; label: string; value: string; change?: number | null }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
        {icon}<span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold text-gray-900 leading-none">{value}</div>
      {change !== null && change !== undefined && (
        <div className={`mt-1 flex items-center gap-0.5 text-[11px] font-semibold ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {change > 0 ? '+' : ''}{change}%
        </div>
      )}
    </div>
  );
}

function VideoRow({ v }: { v: YouTubeVideoStat }) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${v.videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <img src={v.thumbnail} alt={v.title} loading="lazy" className="w-20 h-12 rounded-md object-cover shrink-0 bg-gray-100" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-snug">{v.title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {formatCount(v.views)} views · {formatCount(v.likes)} likes · {v.engagementRate}% eng · {v.isShort ? 'Short' : 'Long'}
        </p>
      </div>
    </a>
  );
}

export default function YouTubeGrowthPanel({ onAskAI }: Props) {
  const {
    connection, snapshot, days, loading, connecting, error,
    connect, disconnect, loadSnapshot, changeRange,
  } = useYouTubeGrowth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'top' | 'recent' | 'weak'>('top');

  const dailyData = useMemo(
    () =>
      (Array.isArray(snapshot?.daily) ? snapshot!.daily : [])
        .filter((d) => d && typeof d === 'object')
        .map((d: any) => {
          const raw = typeof d.date === 'string' ? d.date : typeof d.day === 'string' ? d.day : '';
          return {
            date: raw.length > 5 ? raw.slice(5) : raw,
            views: Number(d.views) || 0,
            subs: (Number(d.subscribersGained) || 0) - (Number(d.subscribersLost) || 0),
            watch: Math.round((Number(d.estimatedMinutesWatched) || 0) / 60),
          };
        }),
    [snapshot],
  );

  const scoreData = useMemo(() => {
    const s = snapshot?.scores;
    if (!s) return [];
    return [
      { name: 'Content', value: Number(s.content) || 0 },
      { name: 'Consistency', value: Number(s.consistency) || 0 },
      { name: 'Engagement', value: Number(s.engagement) || 0 },
      { name: 'Subs', value: Number(s.subscriberGrowth) || 0 },
      { name: 'Topics', value: Number(s.topicStrategy) || 0 },
      { name: 'Trend', value: Number(s.trend) || 0 },
    ];
  }, [snapshot]);

  const videos = Array.isArray(snapshot?.videos?.[tab]) ? snapshot!.videos[tab] : [];



  return (
    <div className="mx-auto max-w-4xl px-1 relative z-10">
      <div className="rounded-2xl border border-red-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2.5 p-3 text-left"
        >
          <span className="h-9 w-9 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
            <Youtube className="h-5 w-5 text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-gray-900 truncate">
              {connection ? connection.channelTitle : 'YouTube Growth Coach'}
            </span>
            <span className="block text-[11px] text-gray-500 truncate">
              {connection
                ? `${formatCount(connection.subscriberCount)} subscribers · AI analyzes your real analytics`
                : 'Connect your channel for AI-powered, data-backed growth advice'}
            </span>
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
        </button>

        {open && (
          <div className="border-t border-gray-100 p-3 space-y-3">
            {!connection ? (
              <div className="text-center py-4">
                <p className="text-xs text-gray-600 max-w-sm mx-auto mb-3">
                  Read-only access to your YouTube analytics. The AI can never upload, edit, delete,
                  like or comment. You can disconnect anytime and your stored data is deleted.
                </p>
                <Button onClick={connect} disabled={connecting} className="bg-red-600 hover:bg-red-700 text-white">
                  {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Youtube className="h-4 w-4 mr-2" />}
                  Connect YouTube
                </Button>
                {error && (
                  <p className="mt-3 text-[11px] text-rose-600 max-w-sm mx-auto">{error}</p>
                )}
              </div>
            ) : (
              <>
                {/* Range + actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {RANGES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => changeRange(r.value)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                        days === r.value
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                  <span className="flex-1" />
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-500" onClick={() => loadSnapshot(days, true)} disabled={loading}>
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-500" onClick={disconnect}>
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {error && <p className="text-[11px] text-rose-600">{error}</p>}
                {snapshot?.analyticsError && (
                  <p className="text-[11px] text-amber-600">
                    Watch-time & traffic data unavailable: {snapshot.analyticsError}
                  </p>
                )}

                {loading && !snapshot ? (
                  <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-red-600" /></div>
                ) : snapshot ? (
                  <>
                    {/* Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Metric icon={<Eye className="h-3 w-3" />} label={`Views (${days}d)`} value={formatCount(snapshot.totals.views)} change={snapshot.totals.viewsChangePct} />
                      <Metric icon={<BarChart3 className="h-3 w-3" />} label="Watch hours" value={formatCount(Math.round(snapshot.totals.estimatedMinutesWatched / 60))} change={snapshot.totals.watchTimeChangePct} />
                      <Metric icon={<UserPlus className="h-3 w-3" />} label="Net subs" value={formatCount(snapshot.totals.netSubscribers)} />
                      <Metric icon={<ThumbsUp className="h-3 w-3" />} label="Engagement" value={`${snapshot.totals.engagementRate}%`} />
                    </div>

                    {/* Overall score */}
                    <div className="rounded-xl border border-gray-200 p-3">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-700">Channel Growth Score</span>
                        <span className={`text-2xl font-extrabold ${scoreColor(snapshot.scores.overall)}`}>{snapshot.scores.overall}<span className="text-xs text-gray-400">/100</span></span>
                      </div>
                      <div className="space-y-1.5">
                        {scoreData.map((s) => (
                          <div key={s.name} className="flex items-center gap-2">
                            <span className="w-20 text-[11px] text-gray-500 shrink-0">{s.name}</span>
                            <span className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <span className={`block h-full rounded-full ${scoreBar(s.value)}`} style={{ width: `${s.value}%` }} />
                            </span>
                            <span className={`w-7 text-right text-[11px] font-semibold ${scoreColor(s.value)}`}>{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Views trend */}
                    {dailyData.length > 1 && (
                      <div className="rounded-xl border border-gray-200 p-2">
                        <p className="text-[11px] font-semibold text-gray-600 px-1 mb-1">Views per day</p>
                        <ResponsiveContainer width="100%" height={140}>
                          <AreaChart data={dailyData} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                            <defs>
                              <linearGradient id="ytViews" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#dc2626" stopOpacity={0.5} />
                                <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9 }} width={40} />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                            <Area type="monotone" dataKey="views" stroke="#dc2626" strokeWidth={2} fill="url(#ytViews)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Subs per day */}
                    {dailyData.length > 1 && (
                      <div className="rounded-xl border border-gray-200 p-2">
                        <p className="text-[11px] font-semibold text-gray-600 px-1 mb-1">Net subscribers per day</p>
                        <ResponsiveContainer width="100%" height={120}>
                          <BarChart data={dailyData} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9 }} width={40} />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                            <Bar dataKey="subs" radius={[3, 3, 0, 0]}>
                              {dailyData.map((d, i) => (
                                <Cell key={i} fill={d.subs >= 0 ? '#10b981' : '#f43f5e'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Watch hours */}
                    {dailyData.length > 1 && (
                      <div className="rounded-xl border border-gray-200 p-2">
                        <p className="text-[11px] font-semibold text-gray-600 px-1 mb-1">Watch hours per day</p>
                        <ResponsiveContainer width="100%" height={120}>
                          <LineChart data={dailyData} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9 }} width={40} />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                            <Line type="monotone" dataKey="watch" stroke="#6366f1" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Traffic sources */}
                    {!!snapshot.trafficSources?.length && (
                      <div className="rounded-xl border border-gray-200 p-3">
                        <p className="text-[11px] font-semibold text-gray-600 mb-2">Traffic sources</p>
                        <div className="space-y-1.5">
                          {snapshot.trafficSources.slice(0, 6).map((t) => {
                            const max = snapshot.trafficSources[0].views || 1;
                            return (
                              <div key={t.source} className="flex items-center gap-2">
                                <span className="w-24 text-[11px] text-gray-500 truncate shrink-0">{t.source}</span>
                                <span className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <span className="block h-full rounded-full bg-red-500" style={{ width: `${(t.views / max) * 100}%` }} />
                                </span>
                                <span className="w-10 text-right text-[11px] text-gray-600">{formatCount(t.views)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Format mix + cadence */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-gray-200 p-3">
                        <p className="text-[11px] font-semibold text-gray-600 mb-1">Format mix</p>
                        <p className="text-[11px] text-gray-500">Shorts: {snapshot.format.shorts.count} · avg {formatCount(snapshot.format.shorts.avgViews)} views</p>
                        <p className="text-[11px] text-gray-500">Long: {snapshot.format.longForm.count} · avg {formatCount(snapshot.format.longForm.avgViews)} views</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 p-3">
                        <p className="text-[11px] font-semibold text-gray-600 mb-1">Upload cadence</p>
                        <p className="text-[11px] text-gray-500">{snapshot.cadence.uploadsPerWeekLast90} uploads / week</p>
                        <p className="text-[11px] text-gray-500">Avg gap: {snapshot.cadence.avgGapDays ?? 'n/a'} days</p>
                      </div>
                    </div>

                    {/* Videos */}
                    <div className="rounded-xl border border-gray-200">
                      <div className="flex gap-1 p-2 border-b border-gray-100">
                        {(['top', 'recent', 'weak'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTab(t)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors ${
                              tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <div className="p-1 max-h-72 overflow-y-auto">
                        {videos.length
                          ? videos.map((v) => <VideoRow key={v.videoId} v={v} />)
                          : <p className="p-3 text-[11px] text-gray-500">No videos found.</p>}
                      </div>
                    </div>
                  </>
                ) : null}

                {/* Ask AI */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-red-600" /> Ask the AI Growth Coach
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_PROMPTS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => onAskAI(p.prompt)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-red-200 text-gray-800 text-[11px] font-medium hover:bg-red-50 active:scale-95 transition-all"
                      >
                        <span>{p.emoji}</span>{p.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-gray-400 leading-snug">
                    Read-only integration. Advice is based on your real analytics — never guaranteed results.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
