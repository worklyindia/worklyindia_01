import { confirmDialog } from '@/lib/confirmDialog';
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Bold, Braces, ChevronRight, Code, ExternalLink, FileUp, Info, Italic, Loader2, Lock, Plus, Save, Smile, Strikethrough, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WhatsAppPreview } from "@/components/owner-portal/whatsapp/WhatsAppPreview";

type App = { package_name: string; signature_hash: string };
type OtpType = "COPY_CODE" | "ONE_TAP" | "ZERO_TAP";
type Comp = {
  type: string; format?: string; text?: string; add_security_recommendation?: boolean; code_expiration_minutes?: number;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string; otp_type?: string; autofill_text?: string; supported_apps?: App[] }>;
  example?: { body_text?: string[][]; header_handle?: string[] };
};
export type StudioTemplate = { id: string; name: string; status: string; language: string; category: string; rejected_reason?: string; components?: Comp[] };

type Btn = { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; url?: string; phone_number?: string };
type HeaderType = "none" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
type Draft = {
  id?: string; status?: string; rejected?: string; name: string; category: string; language: string;
  headerType: HeaderType; header: string; mediaUrl: string; mediaHandle: string; mediaName: string;
  body: string; footer: string; examples: string[]; buttons: Btn[];
  security: boolean; expiry: number | null; otpText: string;
  otpType: OtpType; apps: App[]; autofillText: string; zeroTapTerms: boolean;
};

export interface TemplateStudioApi {
  key: string;
  list: () => Promise<StudioTemplate[]>;
  save: (mode: "create" | "edit", payload: Record<string, unknown>) => Promise<void>;
  remove: (name: string) => Promise<void>;
  upload: (dataUrl: string) => Promise<string>;
}

const META_LIBRARY_URL = "https://business.facebook.com/latest/whatsapp_manager/template_library";

const empty: Draft = {
  name: "", category: "UTILITY", language: "en_US", headerType: "none", header: "", mediaUrl: "", mediaHandle: "", mediaName: "",
  body: "", footer: "", examples: [], buttons: [], security: true, expiry: 10, otpText: "Copy code",
  otpType: "COPY_CODE", apps: [{ package_name: "", signature_hash: "" }], autofillText: "Autofill", zeroTapTerms: false,
};

/** Meta allows editing only approved, rejected or paused templates; name, category and language stay fixed. */
const EDITABLE = ["APPROVED", "REJECTED", "PAUSED"];
const FILE_RULES: Record<Exclude<HeaderType, "none" | "TEXT">, { accept: string; mb: number; label: string }> = {
  IMAGE: { accept: "image/jpeg,image/png", mb: 5, label: "JPG or PNG, up to 5 MB" },
  VIDEO: { accept: "video/mp4", mb: 16, label: "MP4, up to 16 MB" },
  DOCUMENT: { accept: "application/pdf", mb: 15, label: "PDF, up to 15 MB" },
};

const toDraft = (t: StudioTemplate): Draft => {
  const c = t.components || [];
  const h = c.find((x) => x.type === "HEADER");
  const bodyC = c.find((x) => x.type === "BODY");
  const footC = c.find((x) => x.type === "FOOTER");
  const btns = c.find((x) => x.type === "BUTTONS")?.buttons || [];
  const otpBtn = btns.find((b) => b.type === "OTP");
  const fmt = (h?.format?.toUpperCase() || "none") as HeaderType;
  return {
    ...empty,
    id: t.id, status: t.status?.toUpperCase(), rejected: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : undefined,
    name: t.name, category: t.category?.toUpperCase() || "UTILITY", language: t.language || "en_US",
    headerType: ["TEXT", "IMAGE", "VIDEO", "DOCUMENT"].includes(fmt) ? fmt : "none",
    header: fmt === "TEXT" ? h?.text || "" : "", mediaUrl: h?.example?.header_handle?.[0] || "",
    body: bodyC?.text || "", footer: footC?.text || "", examples: bodyC?.example?.body_text?.[0] || [],
    buttons: btns.filter((b) => ["QUICK_REPLY", "URL", "PHONE_NUMBER"].includes(b.type)) as Btn[],
    security: bodyC?.add_security_recommendation ?? true, expiry: footC?.code_expiration_minutes ?? (t.category?.toUpperCase() === "AUTHENTICATION" ? null : 10),
    otpText: otpBtn?.text || "Copy code",
    otpType: (["ZERO_TAP", "ONE_TAP"].includes(otpBtn?.otp_type || "") ? otpBtn!.otp_type : "COPY_CODE") as OtpType,
    apps: otpBtn?.supported_apps?.length ? otpBtn.supported_apps : [{ package_name: "", signature_hash: "" }],
    autofillText: otpBtn?.autofill_text || "Autofill", zeroTapTerms: otpBtn?.otp_type === "ZERO_TAP",
  };
};

const statusLabel = (s?: string) => ({ APPROVED: "Approved", PENDING: "Waiting for approval", REJECTED: "Rejected", PAUSED: "Paused", DISABLED: "Disabled", IN_APPEAL: "In appeal" } as Record<string, string>)[s || ""] || s || "";
const readFile = (file: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
const EMOJIS = ["😊", "👍", "🙏", "🎉", "✅", "📅", "📍", "💼", "📞", "⭐", "🔥", "👋"];

export default function WhatsAppTemplateStudio({ api, title, onBack }: { api: TemplateStudioApi; title: string; onBack: () => void }) {
  const qc = useQueryClient();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  // Load once when the page opens; check again only on a full page refresh or after a save/delete.
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["wa-template-studio", api.key], queryFn: api.list, refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: Infinity,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["wa-template-studio", api.key] });

  const isAuth = draft?.category === "AUTHENTICATION";
  const locked = !!draft?.id && !EDITABLE.includes(draft.status || "");
  const varCount = useMemo(() => new Set(draft?.body.match(/\{\{\d+\}\}/g) || []).size, [draft?.body]);
  const previewBody = useMemo(() => {
    if (!draft) return "";
    if (isAuth) return `*123456* is your verification code.${draft.security ? " For your security, do not share this code." : ""}`;
    let text = draft.body;
    draft.examples.forEach((v, i) => { if (v) text = text.split(`{{${i + 1}}}`).join(v); });
    return text;
  }, [draft, isAuth]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const name = draft.name.trim().toLowerCase();
      if (!/^[a-z0-9_]{1,512}$/.test(name)) throw new Error("Name may use only small letters, numbers and _.");
      if (isAuth) {
        const autofill = draft.otpType !== "COPY_CODE";
        const apps = draft.apps.filter((a) => a.package_name || a.signature_hash);
        if (autofill) {
          if (!apps.length) throw new Error("Add at least one Android app for autofill.");
          if (apps.some((a) => !/^[A-Za-z0-9_.]{1,224}$/.test(a.package_name) || a.signature_hash.length !== 11)) throw new Error("Each app needs a package name and an 11-character signature hash.");
          if (draft.otpType === "ZERO_TAP" && !draft.zeroTapTerms) throw new Error("Tick the zero-tap terms box to submit.");
        }
        await api.save(draft.id ? "edit" : "create", {
          template_id: draft.id, template_name: name, category: "AUTHENTICATION", language: draft.language, content: "",
          add_security_recommendation: draft.security, code_expiration_minutes: draft.expiry, otp_button_text: draft.otpText.trim() || "Copy code",
          otp_type: draft.otpType,
          ...(autofill ? { supported_apps: apps, autofill_text: draft.autofillText.trim() || "Autofill", zero_tap_terms_accepted: draft.otpType === "ZERO_TAP" } : {}),
        });
        return;
      }
      if (!draft.body.trim()) throw new Error("Message text is required.");
      const media = ["IMAGE", "VIDEO", "DOCUMENT"].includes(draft.headerType);
      if (media && !draft.mediaHandle) throw new Error(draft.id ? "Upload the header file again — Meta needs it for every edit." : "Upload the header file first.");
      if (draft.headerType === "TEXT" && !draft.header.trim()) throw new Error("Header text is empty.");
      if (draft.buttons.some((b) => !b.text.trim() || (b.type === "URL" && !/^https:\/\//.test(b.url || "")) || (b.type === "PHONE_NUMBER" && !/^\+?\d{6,16}$/.test(b.phone_number || "")))) throw new Error("Complete every button (https link / phone number).");
      await api.save(draft.id ? "edit" : "create", {
        template_id: draft.id, template_name: name, category: draft.category, language: draft.language,
        content: draft.body.trim(), header_type: draft.headerType, header_content: draft.headerType === "TEXT" ? draft.header.trim() : null,
        header_handle: media ? draft.mediaHandle : null,
        footer: draft.footer.trim() || null, examples: Array.from({ length: varCount }, (_, i) => draft.examples[i] || `Sample${i + 1}`),
        buttons: draft.buttons,
      });
    },
    onSuccess: () => { toast.success("Sent to Meta for approval."); setDraft(null); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });
  const del = useMutation({
    mutationFn: (name: string) => api.remove(name),
    onSuccess: () => { toast.success("Template deleted."); setDraft(null); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const insert = (before: string, after = before, placeholder = "text") => {
    const el = bodyRef.current;
    if (!el || !draft) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const picked = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + picked + after + value.slice(e);
    set({ body: next.slice(0, 1024) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + picked.length); });
  };
  const insertRaw = (text: string) => {
    const el = bodyRef.current;
    if (!el || !draft) return;
    const pos = el.selectionStart ?? draft.body.length;
    set({ body: (draft.body.slice(0, pos) + text + draft.body.slice(pos)).slice(0, 1024) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos + text.length, pos + text.length); });
  };

  const onFile = async (file?: File) => {
    if (!file || !draft || draft.headerType === "none" || draft.headerType === "TEXT") return;
    const rule = FILE_RULES[draft.headerType];
    if (!rule.accept.split(",").includes(file.type)) return toast.error(`Choose ${rule.label}.`);
    if (file.size > rule.mb * 1024 * 1024) return toast.error(`File must be under ${rule.mb} MB.`);
    setUploading(true);
    try {
      const handle = await api.upload(await readFile(file));
      set({ mediaHandle: handle, mediaUrl: URL.createObjectURL(file), mediaName: file.name });
      toast.success("File uploaded to Meta.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const list = data.filter((t) => filter === "ALL" || t.status?.toUpperCase() === filter);

  const header = (label: string, back: () => void, extra?: React.ReactNode) => (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-2 py-3">
      <Button variant="ghost" size="icon" onClick={back} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{label}</h1>
      {extra}
    </header>
  );

  if (draft) {
    const fixedLock = !!draft.id;
    const tool = (label: string, icon: React.ReactNode, onClick: () => void) => (
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={label} title={label} disabled={locked} onClick={onClick}>{icon}</Button>
    );
    const lockHint = <Lock className="ml-1 inline h-3 w-3 text-muted-foreground" aria-label="Cannot be changed" />;
    return (
      <div className="min-h-screen bg-background text-foreground">
        {header(draft.id ? draft.name : "New template", () => setDraft(null), draft.id ? <Badge variant={draft.status === "APPROVED" ? "default" : draft.status === "REJECTED" ? "destructive" : "secondary"}>{statusLabel(draft.status)}</Badge> : undefined)}
        <main className="mx-auto grid max-w-5xl gap-4 p-3 pb-10 md:grid-cols-2">
          <div className="space-y-4">
            {draft.id && (
              <div className="flex gap-2 rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  {locked
                    ? <p>Meta does not allow changes while a template is {statusLabel(draft.status).toLowerCase()}. You can view it or delete it.</p>
                    : <p>Name, category and language cannot be changed after creation. Approved templates can be edited once every 24 hours (up to 10 times in 30 days). Every edit is reviewed again by Meta.</p>}
                  {draft.rejected && <p className="text-destructive">Rejection reason: {draft.rejected}</p>}
                </div>
              </div>
            )}
            <fieldset disabled={locked} className="space-y-4 disabled:opacity-70">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Template name{fixedLock && lockHint}</Label>
                <Input id="tpl-name" value={draft.name} disabled={fixedLock} placeholder="order_update" onChange={(e) => set({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category{fixedLock && lockHint}</Label>
                  <Select value={draft.category} disabled={fixedLock || locked} onValueChange={(v) => set({ category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTILITY">Utility</SelectItem>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                      <SelectItem value="AUTHENTICATION">OTP (Authentication)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Language{fixedLock && lockHint}</Label>
                  <Select value={draft.language} disabled={fixedLock || locked} onValueChange={(v) => set({ language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["en_US", "en", "hi", "en_GB"].includes(draft.language) ? null : <SelectItem value={draft.language}>{draft.language}</SelectItem>}
                      <SelectItem value="en_US">English (US)</SelectItem><SelectItem value="en">English</SelectItem><SelectItem value="en_GB">English (UK)</SelectItem><SelectItem value="hi">Hindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isAuth ? (
                <div className="space-y-4 rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Meta writes the OTP message itself. The code is filled in when you send it.</p>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="tpl-sec">Add "do not share this code" warning</Label>
                    <Switch id="tpl-sec" checked={draft.security} onCheckedChange={(v) => set({ security: v })} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="tpl-exp-on">Show code expiry time</Label>
                    <Switch id="tpl-exp-on" checked={draft.expiry !== null} onCheckedChange={(v) => set({ expiry: v ? 10 : null })} />
                  </div>
                  {draft.expiry !== null && (
                    <div className="space-y-1.5">
                      <Label htmlFor="tpl-exp">Expires after (minutes, 1–90)</Label>
                      <Input id="tpl-exp" type="number" min={1} max={90} value={draft.expiry} onChange={(e) => set({ expiry: Math.min(90, Math.max(1, Number(e.target.value) || 1)) })} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Code delivery setup</Label>
                    {([
                      ["ZERO_TAP", "Zero-tap autofill", "Code is sent to your Android app automatically, no tap needed."],
                      ["ONE_TAP", "One-tap autofill", "Code goes to your app when the customer taps the button."],
                      ["COPY_CODE", "Copy code", "Customer copies the code and pastes it into your app."],
                    ] as const).map(([v, l, d]) => (
                      <label key={v} className={`flex cursor-pointer gap-2 rounded-md border p-2 ${draft.otpType === v ? "border-primary bg-muted" : "border-border"}`}>
                        <input type="radio" name="otp-type" className="mt-1" checked={draft.otpType === v} onChange={() => set({ otpType: v })} />
                        <span><span className="block text-sm font-medium">{l}</span><span className="block text-xs text-muted-foreground">{d}</span></span>
                      </label>
                    ))}
                    <p className="text-xs text-muted-foreground">Autofill works only in an Android app. If it isn't possible, a copy code message is sent.</p>
                  </div>
                  {draft.otpType === "ZERO_TAP" && (
                    <label className="flex gap-2 rounded-md border border-border bg-muted p-2 text-xs">
                      <input type="checkbox" className="mt-0.5" checked={draft.zeroTapTerms} onChange={(e) => set({ zeroTapTerms: e.target.checked })} />
                      <span>I understand that use of zero-tap authentication is subject to the WhatsApp Business Terms of Service, and customers must expect the code to be filled in automatically.</span>
                    </label>
                  )}
                  {draft.otpType !== "COPY_CODE" && (
                    <div className="space-y-2">
                      <Label>App setup (up to 5 apps)</Label>
                      {draft.apps.map((a, i) => (
                        <div key={i} className="space-y-2 rounded-md border border-border/60 p-2">
                          <Input placeholder="Package name (com.example.app)" maxLength={224} className="w-full" value={a.package_name} onChange={(e) => set({ apps: draft.apps.map((x, j) => j === i ? { ...x, package_name: e.target.value.trim() } : x) })} />
                          <div className="flex gap-2">
                            <Input placeholder="Signature hash (11 chars)" maxLength={11} className="flex-1 font-mono" value={a.signature_hash} onChange={(e) => set({ apps: draft.apps.map((x, j) => j === i ? { ...x, signature_hash: e.target.value.trim() } : x) })} />
                            {draft.apps.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label="Remove app" onClick={() => set({ apps: draft.apps.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>}
                          </div>
                        </div>
                      ))}
                      {draft.apps.length < 5 && <Button type="button" variant="outline" size="sm" onClick={() => set({ apps: [...draft.apps, { package_name: "", signature_hash: "" }] })}>Add another app</Button>}
                      <div className="space-y-1.5">
                        <Label htmlFor="tpl-autofill">Autofill button text</Label>
                        <Input id="tpl-autofill" maxLength={25} value={draft.autofillText} onChange={(e) => set({ autofillText: e.target.value })} />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-otp">Copy button text</Label>
                    <Input id="tpl-otp" maxLength={25} value={draft.otpText} onChange={(e) => set({ otpText: e.target.value })} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Header</Label>
                    <div className="grid grid-cols-5 gap-1 rounded-md bg-muted p-1">
                      {(["none", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"] as HeaderType[]).map((h) => (
                        <button key={h} type="button" onClick={() => set({ headerType: h, mediaHandle: "", mediaUrl: h === draft.headerType ? draft.mediaUrl : "", mediaName: "" })}
                          className={`rounded px-1 py-1.5 text-xs font-medium ${draft.headerType === h ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                          {{ none: "None", TEXT: "Text", IMAGE: "Image", VIDEO: "Video", DOCUMENT: "PDF" }[h]}
                        </button>
                      ))}
                    </div>
                    {draft.headerType === "TEXT" && <Input maxLength={60} placeholder="Header text" value={draft.header} onChange={(e) => set({ header: e.target.value })} />}
                    {draft.headerType !== "none" && draft.headerType !== "TEXT" && (
                      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border p-3 text-sm">
                        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5 text-muted-foreground" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{draft.mediaName || (draft.mediaHandle ? "File uploaded" : "Upload sample file")}</span>
                          <span className="block text-xs text-muted-foreground">{FILE_RULES[draft.headerType].label}{draft.id && !draft.mediaHandle ? " · required again for edits" : ""}</span>
                        </span>
                        <input type="file" className="sr-only" accept={FILE_RULES[draft.headerType].accept} disabled={uploading || locked} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-body">Message</Label>
                    <div className="overflow-hidden rounded-md border border-input">
                      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 px-1 py-0.5">
                        {tool("Bold", <Bold className="h-4 w-4" />, () => insert("*"))}
                        {tool("Italic", <Italic className="h-4 w-4" />, () => insert("_"))}
                        {tool("Strikethrough", <Strikethrough className="h-4 w-4" />, () => insert("~"))}
                        {tool("Monospace", <Code className="h-4 w-4" />, () => insert("```"))}
                        {tool("Add variable", <Braces className="h-4 w-4" />, () => insertRaw(`{{${varCount + 1}}}`))}
                        {tool("Emoji", <Smile className="h-4 w-4" />, () => setShowEmoji((v) => !v))}
                        <span className="ml-auto pr-2 text-xs text-muted-foreground">{draft.body.length}/1024</span>
                      </div>
                      {showEmoji && (
                        <div className="flex flex-wrap gap-1 border-b border-border p-1.5">
                          {EMOJIS.map((em) => <button key={em} type="button" className="rounded p-1 text-lg hover:bg-muted" onClick={() => insertRaw(em)}>{em}</button>)}
                        </div>
                      )}
                      <Textarea ref={bodyRef} id="tpl-body" rows={7} maxLength={1024} value={draft.body} className="rounded-none border-0 focus-visible:ring-0"
                        placeholder="Hello {{1}}, your interview is on {{2}}." onChange={(e) => set({ body: e.target.value })} />
                    </div>
                  </div>
                  {varCount > 0 && (
                    <div className="space-y-2">
                      <Label>Sample values (Meta needs these for review)</Label>
                      {Array.from({ length: varCount }, (_, i) => (
                        <Input key={i} placeholder={`Sample for {{${i + 1}}}`} value={draft.examples[i] || ""} onChange={(e) => { const ex = [...draft.examples]; ex[i] = e.target.value; set({ examples: ex }); }} />
                      ))}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-footer">Footer (optional)</Label>
                    <Input id="tpl-footer" maxLength={60} value={draft.footer} onChange={(e) => set({ footer: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Buttons</Label>
                      <Button type="button" variant="outline" size="sm" disabled={draft.buttons.length >= 10} onClick={() => set({ buttons: [...draft.buttons, { type: "QUICK_REPLY", text: "" }] })}><Plus className="mr-1 h-4 w-4" />Add</Button>
                    </div>
                    {draft.buttons.map((b, i) => {
                      const upd = (p: Partial<Btn>) => set({ buttons: draft.buttons.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                      return (
                        <div key={i} className="space-y-2 rounded-md border border-border p-2">
                          <div className="flex gap-2">
                            <Select value={b.type} onValueChange={(v) => upd({ type: v as Btn["type"] })}>
                              <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="QUICK_REPLY">Quick reply</SelectItem><SelectItem value="URL">Website</SelectItem><SelectItem value="PHONE_NUMBER">Call</SelectItem></SelectContent>
                            </Select>
                            <Input maxLength={25} placeholder="Button text" value={b.text} onChange={(e) => upd({ text: e.target.value })} />
                            <Button type="button" variant="ghost" size="icon" aria-label="Remove button" onClick={() => set({ buttons: draft.buttons.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>
                          </div>
                          {b.type === "URL" && <Input placeholder="https://..." value={b.url || ""} onChange={(e) => upd({ url: e.target.value })} />}
                          {b.type === "PHONE_NUMBER" && <Input placeholder="+91..." value={b.phone_number || ""} onChange={(e) => upd({ phone_number: e.target.value })} />}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </fieldset>
            <div className="flex flex-col gap-2 sm:flex-row">
              {!locked && (
                <Button className="w-full sm:w-auto" disabled={save.isPending || uploading} onClick={() => save.mutate()}>
                  {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {draft.id ? "Update & resubmit" : "Submit for approval"}
                </Button>
              )}
              {draft.id && (
                <Button variant="destructive" className="w-full sm:w-auto" disabled={del.isPending} onClick={async () => { if (await confirmDialog("Delete this template from Meta? The same name cannot be reused for 30 days.")) del.mutate(draft.name); }}>
                  {del.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete
                </Button>
              )}
            </div>
          </div>
          <div className="md:sticky md:top-20 md:self-start">
            <WhatsAppPreview
              header={draft.headerType === "none" || isAuth ? undefined : { type: draft.headerType, content: draft.headerType === "TEXT" ? draft.header : draft.mediaUrl }}
              body={previewBody}
              footer={isAuth ? (draft.expiry !== null ? `This code expires in ${draft.expiry} minutes.` : "") : draft.footer}
              buttons={isAuth ? [{ type: "COPY_CODE", text: draft.otpText || "Copy code" }] : draft.buttons}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {header(title, onBack, (
        <>
          <Button variant="outline" size="sm" asChild><a href={META_LIBRARY_URL} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Library</a></Button>
          <Button size="sm" onClick={() => setDraft({ ...empty })}><Plus className="mr-1 h-4 w-4" />New</Button>
        </>
      ))}
      <main className="mx-auto max-w-2xl space-y-3 p-3 pb-10">
        <div className="flex gap-2 overflow-x-auto">
          {["ALL", "APPROVED", "PENDING", "REJECTED"].map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f === "ALL" ? "All" : statusLabel(f)}</Button>
          ))}
        </div>
        {isLoading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : "Could not load templates."}</p>}
        {!isLoading && !error && list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No templates yet.</p>}
        {list.map((t) => {
          const s = t.status?.toUpperCase();
          const bodyText = t.components?.find((c) => c.type === "BODY")?.text;
          return (
            <button key={t.id} type="button" onClick={() => setDraft(toDraft(t))} className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{bodyText || (t.category?.toUpperCase() === "AUTHENTICATION" ? "OTP verification code" : "")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.category?.toUpperCase() === "AUTHENTICATION" ? "OTP" : t.category} · {t.language}</p>
              </div>
              <Badge variant={s === "APPROVED" ? "default" : s === "REJECTED" ? "destructive" : "secondary"}>{statusLabel(s)}</Badge>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </main>
    </div>
  );
}
