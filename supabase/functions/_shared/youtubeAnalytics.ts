// A-Z YouTube analytics built on the public Data API helpers.
// Aggregates a channel's public profile + recent uploads into real numbers
// (upload frequency, average views, engagement, best/worst performers,
// Shorts vs long-form split, top tags, posting-day/hour patterns).

import {
  getChannelUploads,
  mapChannel,
  resolveChannel,
} from "./youtubePublicSearch.ts";

const IST = "Asia/Kolkata";

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function compact(n: number): string {
  if (!isFinite(n)) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function istParts(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const day = d.toLocaleDateString("en-IN", { timeZone: IST, weekday: "long" });
  const hour = Number(
    d.toLocaleString("en-GB", { timeZone: IST, hour: "2-digit", hour12: false }),
  );
  return { day, hour: isNaN(hour) ? null : hour };
}

function topCounts(items: string[], limit: number) {
  const map = new Map<string, number>();
  for (const raw of items) {
    const k = String(raw || "").trim().toLowerCase();
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export async function analyzeYouTubeChannel(
  channelInput: string,
  sampleSize = 25,
) {
  const raw = await resolveChannel(channelInput);
  if (!raw) {
    return {
      success: false,
      error: `Channel "${channelInput}" not found on YouTube.`,
    };
  }
  const channel = mapChannel(raw);

  const uploads = await getChannelUploads(
    channel.handle || channel.channelId || channelInput,
    { order: "date", maxResults: Math.min(50, Math.max(5, sampleSize)) },
  );
  const videos: any[] = Array.isArray(uploads?.videos) ? uploads.videos : [];

  if (!videos.length) {
    return {
      success: true,
      channel,
      analytics: null,
      note:
        "Channel profile mil gaya, lekin recent public uploads nahi mile — analytics sirf public videos par bante hain.",
    };
  }

  const views = videos.map((v) => Number(v.views || 0));
  const likes = videos.map((v) => Number(v.likes || 0));
  const comments = videos.map((v) => Number(v.comments || 0));
  const engagement = videos.map((v) => Number(v.engagementRate || 0));

  const dates = videos
    .map((v) => new Date(v.publishedAt).getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => b - a);
  const spanDays = dates.length > 1
    ? Math.max(1, (dates[0] - dates[dates.length - 1]) / 86400000)
    : 1;
  const uploadsPerWeek = Number(((dates.length / spanDays) * 7).toFixed(2));
  const daysSinceLastUpload = dates.length
    ? Math.floor((Date.now() - dates[0]) / 86400000)
    : null;

  const shorts = videos.filter((v) => v.isShort);
  const longs = videos.filter((v) => !v.isShort);

  const byViews = [...videos].sort((a, b) =>
    Number(b.views || 0) - Number(a.views || 0)
  );
  const slim = (v: any) => ({
    title: v.title,
    url: v.url,
    views: Number(v.views || 0),
    views_label: `${compact(Number(v.views || 0))} views`,
    likes: Number(v.likes || 0),
    comments: Number(v.comments || 0),
    engagementRate: v.engagementRate,
    duration: v.duration,
    isShort: !!v.isShort,
    publishedAt: v.publishedAt,
  });

  const dayCounts = topCounts(
    videos.map((v) => istParts(v.publishedAt)?.day || ""),
    3,
  );
  const hourCounts = topCounts(
    videos.map((v) => {
      const h = istParts(v.publishedAt)?.hour;
      return h === null || h === undefined ? "" : `${h}:00 IST`;
    }),
    3,
  );

  const avgViews = avg(views);
  const subs = Number(channel.subscribers || 0);

  return {
    success: true,
    channel,
    analytics: {
      sample_size: videos.length,
      sample_span_days: Math.round(spanDays),
      uploads_per_week: uploadsPerWeek,
      uploads_per_month: Number((uploadsPerWeek * 4.345).toFixed(1)),
      days_since_last_upload: daysSinceLastUpload,
      lifetime: {
        subscribers: subs,
        subscribers_label: compact(subs),
        total_views: Number(channel.totalViews || 0),
        total_views_label: compact(Number(channel.totalViews || 0)),
        total_videos: Number(channel.videoCount || 0),
        avg_views_per_video_lifetime: channel.videoCount
          ? Math.round(Number(channel.totalViews || 0) / Number(channel.videoCount))
          : 0,
      },
      recent: {
        avg_views: avgViews,
        avg_views_label: compact(avgViews),
        median_views: median(views),
        best_views: Math.max(...views),
        worst_views: Math.min(...views),
        avg_likes: avg(likes),
        avg_comments: avg(comments),
        avg_engagement_rate: Number(
          (engagement.reduce((a, b) => a + b, 0) / engagement.length).toFixed(2),
        ),
        like_to_view_pct: avgViews
          ? Number(((avg(likes) / avgViews) * 100).toFixed(2))
          : 0,
        comment_to_view_pct: avgViews
          ? Number(((avg(comments) / avgViews) * 100).toFixed(2))
          : 0,
        views_per_subscriber: subs ? Number((avgViews / subs).toFixed(3)) : null,
      },
      format_split: {
        shorts_count: shorts.length,
        long_count: longs.length,
        shorts_avg_views: avg(shorts.map((v) => Number(v.views || 0))),
        long_avg_views: avg(longs.map((v) => Number(v.views || 0))),
        better_format: avg(shorts.map((v) => Number(v.views || 0))) >
            avg(longs.map((v) => Number(v.views || 0)))
          ? "shorts"
          : "long-form",
      },
      posting_pattern: {
        top_days: dayCounts,
        top_hours_ist: hourCounts,
      },
      top_tags: topCounts(videos.flatMap((v) => v.tags || []), 12),
      top_categories: topCounts(
        videos.map((v) => v.category || "").filter(Boolean),
        5,
      ),
      top_videos: byViews.slice(0, 5).map(slim),
      lowest_videos: byViews.slice(-3).reverse().map(slim),
      latest_videos: videos.slice(0, 5).map(slim),
      live_activity: {
        live_now: videos.filter((v) => v.live?.isLive).length,
        past_streams: videos.filter((v) => v.live?.wasLive).length,
        upcoming: videos.filter((v) => v.liveBroadcastContent === "upcoming")
          .length,
      },
    },
    presentation_note:
      "Present this as a clean A-Z analytics report: channel profile first (subscribers, total views, total videos, country, created date), then performance (avg/median views, engagement %, views per subscriber), upload consistency, Shorts vs long-form comparison, best posting days/hours (IST), top tags, and top/lowest performing videos as clickable markdown links. Use compact numbers (5.6M) and finish with 2-3 concrete growth suggestions based on the numbers.",
  };
}
