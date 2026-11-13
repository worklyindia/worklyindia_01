import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download, ShieldCheck, BriefcaseBusiness, MessageCircle, Video,
  RefreshCw, Smartphone, ChevronRight, ExternalLink, Globe2,
  FileText, Users, CheckCircle2, Info
} from "lucide-react";

type PublicRelease = {
  id: string;
  version_name: string;
  version_code: number;
  apk_path: string;
  apk_size_bytes: number;
  release_notes: string | null;
  published_at: string | null;
  is_published: boolean;
};

const screenshots = [
  { src: "/screenshots/screenshot-1.webp", alt: "Workly India app job discovery screen", label: "Discover opportunities" },
  { src: "/screenshots/screenshot-2.webp", alt: "Workly India career paths screen", label: "Explore career paths" },
  { src: "/screenshots/feature-graphic.webp", alt: "Workly India app feature graphic", label: "Build your career" },
];

const formatSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Not provided";
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${(bytes / 1_000).toFixed(0)} KB`;
};

const isTrustedDownloadUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      (url.hostname === "github.com" &&
        url.pathname.startsWith("/worklyindia/worklyindia_01/releases/download/android-v") &&
        url.pathname.endsWith("/Workly-India.apk")) ||
      ["pub-e8cec40741a24d08bc49bd0c7070f8f3.r2.dev", "downloads.devs.surf"].includes(url.hostname)
    ) && !url.username && !url.password;
  } catch {
    return false;
  }
};

export default function AppDownloadPage() {
  const [release, setRelease] = useState<PublicRelease | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);

  const loadPublicRelease = async () => {
    setLoading(true);
    setError("");
    setDownloadUrl("");
    try {
      const { data, error: queryError } = await supabase
        .from("android_app_releases")
        .select("id,version_name,version_code,apk_path,apk_size_bytes,release_notes,published_at,is_published")
        .eq("is_published", true)
        .order("version_code", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (queryError) throw queryError;
      if (!data) {
        setRelease(null);
        return;
      }
      const row = data as PublicRelease;
      setRelease(row);
      if (isTrustedDownloadUrl(row.apk_path)) {
        setDownloadUrl(row.apk_path);
      } else {
        const { data: signed, error: signedError } = await supabase.storage
          .from("android-app-releases")
          .createSignedUrl(row.apk_path, 60 * 60);
        if (signedError) throw signedError;
        if (!signed?.signedUrl) throw new Error("APK download link is not available right now.");
        setDownloadUrl(signed.signedUrl);
      }
    } catch (e) {
      console.error("Public Android release load failed:", e);
      setError("Latest app release could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPublicRelease(); }, []);

  const startDownload = () => {
    if (!downloadUrl || preparing) return;
    setPreparing(true);
    window.location.assign(downloadUrl);
    window.setTimeout(() => setPreparing(false), 1800);
  };

  const installButton = (
    <Button
      size="lg"
      onClick={startDownload}
      disabled={loading || !downloadUrl || preparing}
      className="h-12 w-full rounded-full bg-[#16834a] px-7 text-base font-semibold text-white shadow-sm hover:bg-[#116b3b] sm:w-auto"
    >
      {loading ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
      {loading ? "Checking latest version" : preparing ? "Preparing download…" : "Download APK"}
    </Button>
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Workly India",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Android",
    description: "Explore job opportunities, connect with employers and manage your job search with Workly India.",
    url: "https://worklyindia.devs.surf/download",
    downloadUrl: "https://worklyindia.devs.surf/download"
  };

  return (
    <>
      <Helmet>
        <title>Workly India – Jobs & Career App for Android | Download</title>
        <meta name="description" content="Explore job opportunities across India, connect with employers and manage your job search. View the official Workly India Android app details and download the latest APK." />
        <meta name="keywords" content="Workly India app, Workly India download, jobs app India, Android job search app, career app India" />
        <link rel="canonical" href="https://worklyindia.devs.surf/download" />
        <meta property="og:title" content="Workly India – Jobs & Career App" />
        <meta property="og:description" content="Explore opportunities, connect with employers and manage your job search with Workly India." />
        <meta property="og:url" content="https://worklyindia.devs.surf/download" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://worklyindia.devs.surf/screenshots/feature-graphic.webp" />
        <meta name="robots" content="index,follow" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <main className="min-h-screen bg-white pb-24 text-[#202124] sm:pb-12">
        <header className="border-b border-[#dadce0] bg-white">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
            <a href="/" aria-label="Workly India home" className="flex min-h-11 items-center gap-2">
              <img src="/icons/icon-192x192.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
              <span className="text-lg font-semibold tracking-tight">Workly India</span>
            </a>
            <span className="ml-auto text-sm text-[#5f6368]">App details</span>
          </div>
        </header>

        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <section className="pt-7 sm:pt-10">
            <div className="flex items-start gap-4 sm:gap-6">
              <img
                src="/icons/icon-512x512.png"
                alt="Workly India app icon"
                className="h-24 w-24 shrink-0 rounded-[1.35rem] border border-[#dadce0] object-cover shadow-sm sm:h-32 sm:w-32"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-[25px] font-semibold leading-tight tracking-tight sm:text-3xl">Workly India</h1>
                <a href="/" className="mt-1 inline-block text-sm font-medium text-[#137c43] hover:underline">Workly India</a>
                <p className="mt-1 text-sm text-[#5f6368]">Jobs, careers and employer connections</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-md border-[#dadce0] bg-white font-medium text-[#5f6368]">Official website</Badge>
                  <Badge variant="outline" className="rounded-md border-[#dadce0] bg-white font-medium text-[#5f6368]">Android</Badge>
                </div>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-3 divide-x divide-[#dadce0] border-y border-[#dadce0] py-4 text-center">
              <div className="px-2">
                <Smartphone className="mx-auto h-5 w-5 text-[#5f6368]" />
                <p className="mt-1 text-sm font-semibold">Android</p>
                <p className="text-xs text-[#5f6368]">Platform</p>
              </div>
              <div className="px-2">
                <BriefcaseBusiness className="mx-auto h-5 w-5 text-[#5f6368]" />
                <p className="mt-1 text-sm font-semibold">Jobs</p>
                <p className="text-xs text-[#5f6368]">App category</p>
              </div>
              <div className="px-2">
                <Globe2 className="mx-auto h-5 w-5 text-[#5f6368]" />
                <p className="mt-1 text-sm font-semibold">India</p>
                <p className="text-xs text-[#5f6368]">Focus</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="w-full sm:w-auto">{installButton}</div>
              <p className="text-xs leading-5 text-[#5f6368]">Download is provided by the official Workly India website.</p>
            </div>
            {error && <div role="alert" className="mt-3 rounded-xl bg-[#fce8e6] p-3 text-sm text-[#b3261e]">{error}</div>}
            {!loading && !error && !release && (
              <div className="mt-3 rounded-xl border border-[#f9ab00] bg-[#fef7e0] p-3 text-sm text-[#5f4b00]">
                The next Android release is not public yet. Please check again later.
              </div>
            )}
            {release && downloadUrl && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5f6368]">
                <span className="font-medium text-[#202124]">Version {release.version_name}</span>
                <span>{formatSize(release.apk_size_bytes)}</span>
                {release.published_at && <span>Updated {new Date(release.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                <span className="inline-flex items-center gap-1 text-[#137c43]"><CheckCircle2 className="h-3.5 w-3.5" />Public release</span>
              </div>
            )}
          </section>

          <section className="mt-9">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Screenshots</h2>
              <span className="text-xs text-[#5f6368]">App preview</span>
            </div>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
              {screenshots.map((shot) => (
                <figure key={shot.src} className="w-[min(70vw,245px)] shrink-0 snap-start">
                  <img src={shot.src} alt={shot.alt} loading="lazy" className="aspect-[9/16] w-full rounded-2xl border border-[#dadce0] bg-[#f8f9fa] object-cover" />
                  <figcaption className="mt-2 text-sm text-[#5f6368]">{shot.label}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="mt-8 border-t border-[#dadce0] pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">About this app</h2>
              <Info className="h-5 w-5 text-[#5f6368]" />
            </div>
            <p className="mt-3 text-sm leading-7 text-[#3c4043]">
              Workly India helps job seekers explore opportunities and stay connected with employers. Use the app to discover jobs, manage your job-search activity and communicate with employers from your Android device.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { icon: BriefcaseBusiness, title: "Explore jobs", detail: "Discover job opportunities and career options." },
                { icon: MessageCircle, title: "Connect with employers", detail: "Keep job-related conversations in one place." },
                { icon: Video, title: "Interview conversations", detail: "Use supported video interview features when available." },
                { icon: Users, title: "Manage your activity", detail: "Keep track of your job-search journey." },
              ].map(({ icon: Icon, title, detail }) => (
                <div key={title} className="flex gap-3 rounded-xl bg-[#f8f9fa] p-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#137c43]" />
                  <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-[#5f6368]">{detail}</p></div>
                </div>
              ))}
            </div>
            {release?.release_notes && (
              <div className="mt-5 rounded-xl border border-[#dadce0] p-4">
                <h3 className="text-sm font-semibold">What’s new</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#5f6368]">{release.release_notes}</p>
              </div>
            )}
          </section>

          <section className="mt-8 border-t border-[#dadce0] pt-6">
            <h2 className="text-xl font-semibold">App support and information</h2>
            <div className="mt-3 divide-y divide-[#dadce0] rounded-xl border border-[#dadce0]">
              <a href="/privacy" className="flex min-h-14 items-center gap-3 px-4 text-sm hover:bg-[#f8f9fa]">
                <ShieldCheck className="h-5 w-5 text-[#5f6368]" /><span className="flex-1">Privacy policy</span><ExternalLink className="h-4 w-4 text-[#5f6368]" />
              </a>
              <a href="/terms-conditions" className="flex min-h-14 items-center gap-3 px-4 text-sm hover:bg-[#f8f9fa]">
                <FileText className="h-5 w-5 text-[#5f6368]" /><span className="flex-1">Terms and conditions</span><ExternalLink className="h-4 w-4 text-[#5f6368]" />
              </a>
              <a href="/" className="flex min-h-14 items-center gap-3 px-4 text-sm hover:bg-[#f8f9fa]">
                <Globe2 className="h-5 w-5 text-[#5f6368]" /><span className="flex-1">Developer website</span><ChevronRight className="h-4 w-4 text-[#5f6368]" />
              </a>
            </div>
          </section>

          <section className="mt-8 rounded-xl bg-[#f8f9fa] p-4">
            <h2 className="text-sm font-semibold">Install the Android app</h2>
            <ol className="mt-2 space-y-2 text-sm leading-6 text-[#5f6368]">
              <li>1. Download the APK using the button above.</li>
              <li>2. If Android asks, allow your browser to install apps from this source.</li>
              <li>3. Review Android’s installation prompt, then install and open Workly India.</li>
            </ol>
            <p className="mt-3 text-xs leading-5 text-[#5f6368]">For your safety, install only the APK served from the official Workly India download page. Android may show a standard confirmation before installation.</p>
          </section>

          <footer className="mt-8 border-t border-[#dadce0] py-6 text-xs text-[#5f6368]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>© {new Date().getFullYear()} Workly India</span>
              <nav className="flex gap-4"><a href="/privacy" className="hover:underline">Privacy</a><a href="/terms-conditions" className="hover:underline">Terms</a><a href="/" className="hover:underline">Home</a></nav>
            </div>
            <p className="mt-3">This is the official Workly India website download page. It is not a Google Play Store listing.</p>
          </footer>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dadce0] bg-white/95 p-3 backdrop-blur sm:hidden">
          <div className="mx-auto max-w-4xl">{installButton}</div>
        </div>
      </main>
    </>
  );
}
