import { Link, Navigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { CANONICAL_URL } from "@/config/domainConfig";
import { VIDEOS, findVideo, videoSchema, watchPath } from "@/lib/videoCatalog.mjs";

/** Dedicated watch page: the video is the main content, so Google can index it as a video result. */
export default function VideoWatch() {
  const { slug } = useParams();
  const video = slug ? findVideo(slug) : null;
  if (!video) return <Navigate to="/videos" replace />;
  const others = VIDEOS.filter((v) => v.slug !== video.slug);

  return (
    <main className="min-h-screen bg-background">
      <SEO title={`${video.title} | Workly India`} description={video.description} canonical={watchPath(video.slug)} image={video.thumbnailUrl} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(videoSchema(CANONICAL_URL, video))}</script>
      </Helmet>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <video
          src={video.contentUrl}
          poster={video.thumbnailUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-xl bg-muted"
        />
        <h1 className="mt-5 text-2xl font-bold">{video.title}</h1>
        <p className="mt-2 text-muted-foreground">{video.description}</p>
        <Button asChild className="mt-4"><Link to={video.cta.href}>{video.cta.label}</Link></Button>

        <h2 className="mt-10 text-lg font-semibold">More videos</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {others.map((v) => (
            <Link key={v.slug} to={watchPath(v.slug)} className="overflow-hidden rounded-xl border border-border bg-card">
              <img src={v.thumbnailUrl} alt={v.title} loading="lazy" className="aspect-video w-full object-cover" />
              <p className="p-3 text-sm font-medium">{v.title}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

export function VideoHub() {
  return (
    <main className="min-h-screen bg-background">
      <SEO title="Workly India Videos" description="Watch short Workly India videos on finding free verified jobs and hiring candidates fast." canonical="/videos" />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="text-2xl font-bold">Workly India Videos</h1>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {VIDEOS.map((v) => (
            <Link key={v.slug} to={watchPath(v.slug)} className="overflow-hidden rounded-xl border border-border bg-card">
              <img src={v.thumbnailUrl} alt={v.title} loading="lazy" className="aspect-video w-full object-cover" />
              <p className="p-3 text-sm font-medium">{v.title}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
