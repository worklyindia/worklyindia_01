import { useRef, useState, type ChangeEvent } from "react";
import { Camera, FileText, Loader2, ScanText, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getWorklyAndroidBridge, isWorklyAndroidApp } from "@/lib/nativeAppBridge";

type ScanResult = { text?: string; error?: string };
const looksLikeResume = (value: string) => {
  const text = value.toLowerCase();
  const hasContact = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(value) || /(?:\+?\d[\d\s().-]{8,}\d)/.test(value);
  const headings = ["experience", "education", "skills", "employment", "qualification", "summary", "objective", "projects", "certification", "work history"];
  return hasContact && headings.filter((heading) => text.includes(heading)).length >= 2;
};

const ResumeScannerPanel = ({ onImport }: { onImport: (data: { fullName: string; email: string; mobile: string; resumeText: string }) => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [error, setError] = useState("");
  const [validResume, setValidResume] = useState(false);
  const supported = isWorklyAndroidApp() && !!getWorklyAndroidBridge()?.scanResumeImage;

  const scanImage = (file: File) => new Promise<string>((resolve, reject) => {
    const bridge = getWorklyAndroidBridge();
    if (!bridge?.scanResumeImage) return reject(new Error("Scanning is available only in the Workly India Android app."));
    if (file.size > 12 * 1024 * 1024) return reject(new Error("Choose an image smaller than 12 MB."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return reject(new Error("Could not read this image."));
      const timeout = window.setTimeout(() => { window.removeEventListener("workly-native-resume-ocr", listener); reject(new Error("Scanning timed out. Please try again.")); }, 30000);
      const listener = (event: Event) => {
        const detail = (event as CustomEvent<ScanResult>).detail;
        window.clearTimeout(timeout);
        window.removeEventListener("workly-native-resume-ocr", listener);
        if (detail?.error) reject(new Error(detail.error));
        else resolve(detail?.text || "");
      };
      window.addEventListener("workly-native-resume-ocr", listener);
      if (!bridge.scanResumeImage?.(dataUrl)) {
        window.clearTimeout(timeout);
        window.removeEventListener("workly-native-resume-ocr", listener);
        reject(new Error("Could not start the camera scanner. Please try again."));
      }
    };
    reader.readAsDataURL(file);
  });

  const scanPdf = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) throw new Error("Choose a PDF smaller than 20 MB.");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableWorker: true }).promise;
    if (!pdf.numPages) throw new Error("This PDF has no readable pages.");
    const pages: string[] = [];
    for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 5); pageNo++) {
      const page = await pdf.getPage(pageNo);
      const viewport = page.getViewport({ scale: 1.7 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare the PDF page.");
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not render PDF page.")), "image/jpeg", 0.88));
      canvas.width = 0; canvas.height = 0;
      pages.push(await scanImage(new File([blob], `resume-page-${pageNo}.jpg`, { type: "image/jpeg" })));
    }
    return pages.join("\n\n");
  };

  const handlePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setScanning(true); setError(""); setExtractedText(""); setValidResume(false);
    try {
      const text = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        ? await scanPdf(file)
        : file.type.startsWith("image/") ? await scanImage(file) : (() => { throw new Error("Choose a resume image or PDF."); })();
      if (!looksLikeResume(text)) {
        setError("This document does not look like a resume. It was rejected. Scan a resume with readable contact details and sections such as Experience, Education or Skills.");
        toast({ title: "Not a resume", description: "The selected document was rejected.", variant: "destructive" });
      } else {
        setExtractedText(text); setValidResume(true);
        toast({ title: "Resume detected", description: "Review the extracted information before saving." });
      }
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Could not scan this file.");
    } finally { setScanning(false); }
  };

  const confirmImport = () => {
    const lines = extractedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const email = extractedText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || "";
    const mobile = extractedText.match(/(?:\+?\d[\d\s().-]{8,}\d)/)?.[0]?.replace(/\s+/g, " ").trim() || "";
    const fullName = lines.find((line) => /^[A-Z][A-Za-z.' -]{2,55}$/.test(line) && !/resume|curriculum vitae/i.test(line)) || "";
    onImport({ fullName, email, mobile, resumeText: extractedText });
    toast({ title: "Resume data saved", description: "Detected contact details and the complete editable OCR text were saved to your resume draft." });
    setExtractedText(""); setValidResume(false);
  };

  if (!supported) return null;
  return (
    <section className="mb-4 space-y-3 rounded-2xl border bg-card p-4" aria-label="Resume scanner">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ScanText className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Scan an existing resume</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Take a photo or select a resume image/PDF. Review the extracted text before saving.</p></div>
      </div>
      <input ref={inputRef} type="file" accept="image/*,application/pdf,.pdf" capture="environment" className="hidden" onChange={handlePick} aria-label="Take a resume photo or choose an image or PDF" />
      <Button type="button" variant="outline" className="min-h-11 w-full rounded-xl" onClick={() => inputRef.current?.click()} disabled={scanning}>
        {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}{scanning ? "Scanning resume…" : "Scan with camera or choose file"}
      </Button>
      {error && <p className="flex items-start gap-2 text-xs text-destructive" role="alert"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
      {validResume && <div className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-semibold text-green-600"><CheckCircle2 className="h-4 w-4" /> Resume detected · Confirm after review</p>
        <Textarea value={extractedText} onChange={(event) => { setExtractedText(event.target.value); setValidResume(looksLikeResume(event.target.value)); }} rows={9} className="text-xs leading-5" aria-label="Review and edit all extracted resume text" />
        <Button type="button" className="w-full min-h-11 rounded-xl" disabled={!looksLikeResume(extractedText)} onClick={confirmImport}><FileText className="mr-2 h-4 w-4" />Confirm and save resume data</Button>
        <p className="text-[11px] text-muted-foreground">OCR can misread characters. Review all names, numbers, dates and qualifications. The full text is kept editable so no extracted content is silently discarded.</p>
      </div>}
    </section>
  );
};
export default ResumeScannerPanel;
