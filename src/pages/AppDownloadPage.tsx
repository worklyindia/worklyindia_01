import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ShieldCheck, BriefcaseBusiness, MessageCircle, Video, RefreshCw, Smartphone, CheckCircle2 } from "lucide-react";

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

const formatSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Size unavailable";
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${(bytes / 1_000).toFixed(0)} KB`;
};

const isTrustedDownloadUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.hostname === "github.com" &&
      url.pathname.startsWith("/worklyindia/worklyindia_01/releases/download/android-v") &&
      url.pathname.endsWith("/Workly-India.apk") ||
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

  return (
    <>
      <Helmet>
        <title>Download Workly India App for Android | Official APK</title>
        <meta name="description" content="Download the official Workly India Android app. Find jobs, connect with employers, manage applications and explore career opportunities across India." />
        <meta name="keywords" content="Workly India app, download Workly India, Android jobs app India, job search app India, official APK" />
        <link rel="canonical" href="https://worklyindia.devs.surf/download" />
        <meta property="og:title" content="Download Workly India App" />
        <meta property="og:description" content="Find jobs and manage your career with the official Workly India Android app." />
        <meta property="og:url" content="https://worklyindia.devs.surf/download" />
        <meta property="og:type" content="website" />
        <meta name="robots" content="index,follow" />
      </Helmet>
      <main className="min-h-screen bg-[#f6f8fc] text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
            <img src="/favicon.ico" alt="Workly India" className="h-11 w-11 rounded-xl object-contain" />
            <div className="min-w-0">
              <p className="font-bold leading-tight">Workly India</p>
              <p className="text-xs text-slate-500">Official Android app</p>
            </div>
            <Badge className="ml-auto bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Official download</Badge>
          </div>
        </header>

        <section className="mx-auto max-w-5xl px-4 pb-12 pt-8 sm:px-6 sm:pt-14">
          <div className="grid items-center gap-8 md:grid-cols-[1.1fr_.9fr]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-4 w-4" /> Official Workly India app
              </div>
              <h1 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-5xl">Your next opportunity is just a tap away.</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Discover job opportunities, connect with employers and keep your career moving — all from your Android phone.</p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                {loading ? (
                  <Button disabled size="lg" className="h-12 rounded-xl px-6"><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Checking latest version</Button>
                ) : downloadUrl ? (
                  <Button size="lg" onClick={startDownload} disabled={preparing} className="h-12 rounded-xl bg-emerald-600 px-6 text-base font-semibold hover:bg-emerald-700">
                    <Download className="mr-2 h-5 w-5" />{preparing ? "Preparing download..." : "Download for Android"}
                  </Button>
                ) : (
                  <Button size="lg" variant="outline" onClick={() => void loadPublicRelease()} className="h-12 rounded-xl px-6">
                    <RefreshCw className="mr-2 h-4 w-4" />Try again
                  </Button>
                )}
                <span className="text-xs text-slate-500">Android APK · Free to download</span>
              </div>
              {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
              {!loading && !error && !release && <p className="mt-3 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">A new app version is not public yet. Please check back soon.</p>}
              {release && downloadUrl && (
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">Version {release.version_name}</span>
                  <span>{formatSize(release.apk_size_bytes)}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" />Latest public release</span>
                </div>
              )}
            </div>

            <div className="mx-auto w-full max-w-sm">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[1.7rem] bg-emerald-50">
                  <img src="/favicon.ico" alt="" className="h-16 w-16 rounded-2xl object-contain" />
                </div>
                <div className="mt-5 text-center">
                  <h2 className="text-xl font-bold">Workly India</h2>
                  <p className="mt-1 text-sm text-slate-500">Jobs • Careers • Connections</p>
                  <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100 py-4">
                    <div><p className="font-bold">India</p><p className="text-[11px] text-slate-500">Focused</p></div>
                    <div><p className="font-bold">Free</p><p className="text-[11px] text-slate-500">Install</p></div>
                    <div><p className="font-bold">Android</p><p className="text-[11px] text-slate-500">App</p></div>
                  </div>
                  <p className="mt-4 text-left text-sm leading-6 text-slate-600">A simple place to explore opportunities and stay connected through your job search.</p>
                </div>
              </div>
            </div>
          </div>

          <section className="mt-14">
            <h2 className="text-xl font-bold sm:text-2xl">Everything you need for your career</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: BriefcaseBusiness, title: "Find jobs", text: "Explore opportunities across India." },
                { icon: MessageCircle, title: "Connect", text: "Stay in touch with employers." },
                { icon: Video, title: "Interviews", text: "Connect for interview conversations." },
                { icon: Smartphone, title: "On the go", text: "Keep your job activity close at hand." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <Icon className="h-6 w-6 text-emerald-600" />
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <h2 className="font-bold">How to install</h2>
            <ol className="mt-3 grid gap-3 text-sm leading-6 text-slate-600 sm:grid-cols-3">
              <li><strong className="text-slate-900">1. Download</strong><br />Tap the Download for Android button above.</li>
              <li><strong className="text-slate-900">2. Allow install</strong><br />If Android asks, allow your browser to install apps from this source.</li>
              <li><strong className="text-slate-900">3. Open Workly</strong><br />Finish installation and launch the app.</li>
            </ol>
            <p className="mt-4 text-xs leading-5 text-slate-500">Only install APK files downloaded from the official Workly India website. Android may show a standard confirmation before installing an APK.</p>
          </section>
        </section>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>© {new Date().getFullYear()} Workly India. All rights reserved.</span>
            <nav className="flex gap-4"><a className="hover:text-slate-900" href="/privacy">Privacy</a><a className="hover:text-slate-900" href="/terms-conditions">Terms</a><a className="hover:text-slate-900" href="/">Home</a></nav>
          </div>
        </footer>
      </main>
    </>
  );
}
