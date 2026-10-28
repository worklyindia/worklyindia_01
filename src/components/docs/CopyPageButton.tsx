import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { findPublicDocument } from "./documentCatalog";

/** Header button that copies the whole document page as plain text (for sharing with an AI or developer). */
export default function CopyPageButton({ title }: { title: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [done, setDone] = useState(false);
  const doc = findPublicDocument(window.location.pathname);
  const description = `${title} — Workly India developer setup, API examples, permissions and troubleshooting.`;
  const copy = async () => {
    const headerEl = ref.current?.closest("header");
    const page = headerEl?.parentElement ?? document.getElementById("root") ?? document.body;
    const body = (page?.querySelector("main") ?? page)?.innerText?.trim() || "";
    const header = headerEl ? page?.querySelector("header")?.innerText?.trim() || "" : "";
    let content = header && body.startsWith(header) ? body.slice(header.length).trim() : body;
    if (doc) {
      try {
        const response = await fetch(`/docs/${doc[1]}.txt`, { cache: "no-cache" });
        if (response.ok && response.headers.get("content-type")?.includes("text/plain")) {
          const complete = await response.text();
          if (complete.trim()) content = complete;
        }
      } catch { /* The visible document remains copyable offline. */ }
    }
    const text = `${title}\nSource: ${window.location.href}\n\n${content}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
      const copied = document.execCommand("copy"); t.remove();
      if (!copied) { toast.error("Could not copy the page. Please try again."); return; }
    }
    setDone(true); toast.success("Full page copied — paste it to your developer or AI");
    setTimeout(() => setDone(false), 2000);
  };
  return (
    <>
    {doc && <Helmet>
      <title>{title} | Workly India Developers</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={`${window.location.origin}${doc[0]}`} />
      <meta property="og:title" content={`${title} | Workly India Developers`} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={`${window.location.origin}${doc[0]}`} />
      <link rel="alternate" type="text/plain" href={`/docs/${doc[1]}.txt`} title={`${title} — complete text`} />
    </Helmet>}
    <Button ref={ref} variant="ghost" size="icon" className="ml-auto shrink-0" onClick={copy} aria-label="Copy full page" title="Copy full page">
      {done ? <Check className="h-5 w-5 text-primary" /> : <Copy className="h-5 w-5" />}
    </Button>
    </>
  );
}
