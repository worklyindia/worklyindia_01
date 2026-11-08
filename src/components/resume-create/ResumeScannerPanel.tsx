import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Copy, Loader2, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getWorklyAndroidBridge, isWorklyAndroidApp } from "@/lib/nativeAppBridge";

/**
 * Uses Android ML Kit on-device OCR. The selected image is processed locally
 * by the native app and is not uploaded to Workly or a third-party service.
 */
const ResumeScannerPanel = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [error, setError] = useState("");
  const supported = isWorklyAndroidApp() && !!getWorklyAndroidBridge()?.scanResumeImage;

  useEffect(() => {
    const handleResult = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string; error?: string }>).detail;
      setScanning(false);
      if (detail?.error) {
        setError(detail.error);
        toast({ title: "Resume scan failed", description: detail.error, variant: "destructive" });
        return;
      }
      const text = detail?.text?.trim() || "";
      setExtractedText(text);
      setError(text ? "" : "No readable text found. Try a clearer photo with good lighting.");
      if (text) toast({ title: "Text extracted", description: "Review the scanned text and copy it into your resume fields." });
    };
    window.addEventListener("workly-native-resume-ocr", handleResult);
    return () => window.removeEventListener("workly-native-resume-ocr", handleResult);
  }, [toast]);

  const handlePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a photo of your resume.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Choose an image smaller than 12 MB.");
      return;
    }
    const bridge = getWorklyAndroidBridge();
    if (!bridge?.scanResumeImage) {
      setError("On-device resume scanning is available in the Workly India Android app.");
      return;
    }
    setScanning(true);
    setError("");
    setExtractedText("");
    const reader = new FileReader();
    reader.onerror = () => {
      setScanning(false);
      setError("Could not read this image. Please try again.");
    };
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl || !bridge.scanResumeImage?.(dataUrl)) {
        setScanning(false);
        setError("Could not start the scanner. Please try another image.");
      }
    };
    reader.readAsDataURL(file);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      toast({ title: "Copied", description: "Scanned text copied to clipboard." });
    } catch {
      toast({ title: "Copy unavailable", description: "Select the text and copy it manually.", variant: "destructive" });
    }
  };

  return (
    <section className="mb-4 rounded-2xl border bg-card p-4 space-y-3" aria-label="Resume scanner">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ScanText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Scan an existing resume</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Take a clear photo of a resume page. Android reads the text on your device; nothing is uploaded for OCR.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePick}
        aria-label="Choose or photograph a resume page"
      />
      <Button type="button" variant="outline" className="min-h-11 w-full rounded-xl" onClick={() => inputRef.current?.click()} disabled={scanning}>
        {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
        {scanning ? "Reading resume…" : "Take photo or choose image"}
      </Button>
      {!supported && <p className="text-xs text-muted-foreground">Scanner OCR requires the updated Workly India Android app.</p>}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      {extractedText && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">Extracted text · Review before using</p>
            <Button type="button" size="sm" variant="ghost" className="h-9" onClick={copyText}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy text
            </Button>
          </div>
          <Textarea value={extractedText} readOnly rows={6} className="text-xs leading-5" aria-label="Extracted resume text" />
          <p className="text-[11px] text-muted-foreground">OCR may make mistakes. Check names, contact details, dates and skills before adding them to your resume.</p>
        </div>
      )}
    </section>
  );
};

export default ResumeScannerPanel;
