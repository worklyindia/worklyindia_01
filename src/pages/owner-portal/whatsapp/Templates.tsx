import { confirmDialog } from '@/lib/confirmDialog';
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, Bold, ChevronRight, Clock, Code, ImagePlus, Italic, Plus, RefreshCw, Send, Settings, Strikethrough, Trash2 } from "lucide-react";
import { WhatsAppPreview } from "@/components/owner-portal/whatsapp/WhatsAppPreview";
import { TemplateStatusBadge } from "@/components/owner-portal/whatsapp/TemplateStatusBadge";
import { ImageCropDialog } from "@/components/brand/ImageCropDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uploadToR2 } from "@/lib/r2Media";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { waInvoke, whatsappTemplateName, useWhatsAppAudience, type WhatsAppAudience } from "@/lib/whatsappAudience";
import {
  PUSH_TEMPLATE_GROUPS,
  applyVariables,
  audienceOf,
  sampleValuesFor,
  telegramDefaultsFor,
  variablesFor,
  type PushTemplateDef,
} from "@/config/pushTemplateCatalog";

interface WhatsAppTemplateRow {
  id: string;
  name: string;
  display_name?: string | null;
  category?: string | null;
  language?: string | null;
  content_preview?: string | null;
  variables?: string[] | null;
  is_active?: boolean | null;
  notify_enabled?: boolean | null;
  total_sent?: number | null;
  created_at?: string | null;
  status?: string | null;
  rejection_reason?: string | null;
  header_type?: string | null;
  header_content?: string | null;
  footer?: string | null;
  buttons?: unknown[] | null;
  last_synced_at?: string | null;
  msg91_template_id?: string | null;
}

interface BuiltTemplate {
  name: string;
  displayName: string;
  category: "UTILITY" | "AUTHENTICATION" | "MARKETING";
  language: string;
  title: string;
  body: string;
  metaBody: string;
  variables: string[];
  examples: string[];
  headerContent: string | null;
  previewBody: string;
}

type TemplateButton = { type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY"; text: string; url?: string; phone_number?: string };
type TemplateDraft = { header: string; body: string; footer: string; imageUrl: string; buttons: TemplateButton[] };

const removeEmoji = (value: string) => value.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/gu, "").replace(/\s+\n/g, "\n");
const storedButtons = (value: unknown): TemplateButton[] => Array.isArray(value) ? value.filter((button): button is TemplateButton =>
  !!button && typeof button === "object" && ["URL", "PHONE_NUMBER", "QUICK_REPLY"].includes(button.type) && typeof button.text === "string",
).map((button) => ({ ...button, text: removeEmoji(button.text).trim() })) : [];

const MAX_META_BODY_LENGTH = 1024;
const SITE_URL = "https://worklyindia.devs.surf";

const cleanWhatsAppText = (value: string) =>
  value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?(?:b|strong)>/gi, "*")
    .replace(/<\/?(?:i|em)>/gi, "_")
    .replace(/<\/?(?:s|strike|del)>/gi, "~")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/^[━─]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const limitMetaBody = (value: string) => {
  if (value.length <= MAX_META_BODY_LENGTH) return value;
  return `${value.slice(0, MAX_META_BODY_LENGTH - 3).trimEnd()}...`;
};

const orderedVariableKeys = (value: string) => {
  const keys: string[] = [];
  value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    if (!keys.includes(key)) keys.push(key);
    return _match;
  });
  return keys;
};

const toMetaVariables = (value: string, keys: string[]) =>
  value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => `{{${Math.max(1, keys.indexOf(key) + 1)}}}`);

// Meta treats welcome messages, profile nudges and promos as MARKETING; submitting them as UTILITY gets them recategorised.
const categoryFor = (def: PushTemplateDef): BuiltTemplate["category"] =>
  /otp|2fa/i.test(def.key) ? "AUTHENTICATION"
    : /_promo$|weekly_digest|new_job_match|signup_welcome|profile_complete|profile_incomplete/.test(def.key) ? "MARKETING" : "UTILITY";

const metaCategory = (row?: { category?: string | null } | null): BuiltTemplate["category"] | null => {
  const value = String(row?.category || "").toUpperCase();
  return value === "UTILITY" || value === "MARKETING" || value === "AUTHENTICATION" ? value : null;
};

const WHATSAPP_COPY: Record<string, string> = {
  signup_welcome: "Hi {{name}}, welcome to Workly India! 👋\n\nYour job seeker account is ready. Complete your profile, then explore roles that fit your skills.\n\nWe're glad you're here.",
  employer_signup_welcome: "Hi {{name}}, welcome to Workly India! 👋\n\nYour employer account is ready. Complete your company profile to start posting jobs and reviewing applicants.\n\nWe're glad you're here.",
  application_submitted: "✅ Your application has been sent.\n\n💼 Role: *{{job_title}}*\n🏢 Company: {{company}}\n\nYou can track updates in your Activity page.",
  application_status_changed: "📩 Your application has an update.\n\n💼 Role: *{{job_title}}*\n🏢 Company: {{company}}\n📌 Status: *{{status}}*\n\nOpen Activity for the latest details.",
  new_job_match: "Hi {{name}}, a job may match your profile. 💼\n\n*{{job_title}}* at {{company}}\n📍 {{location}}\n\nReview the role and its requirements before you apply.",
  new_application_received: "📩 A new application has arrived.\n\n💼 Role: *{{job_title}}*\n👤 Candidate: {{name}}\n\nReview the applicant in your Employer Portal.",
  job_posted: "✅ Your job post is live on Workly India.\n\n💼 Role: *{{job_title}}*\n📍 Location: {{location}}\n\nOpen your Employer Portal to manage applications.",
  weekly_digest: "Hi {{name}}, here are {{job_count}} jobs that may match your profile. 💼\n\n{{jobs_list}}\n\nExplore all recommendations and check each role before applying.",
  resume_builder_promo: "Hi {{name}}, get your resume ready for your next application. 📄\n\nExplore these Workly India resume designs: {{resume_templates}}.\n\nChoose the one that works for you and start building.",
  cover_letter_builder_promo: "Hi {{name}}, give your next application a personal touch. ✨\n\nExplore these Workly India cover letter designs: {{cover_templates}}.\n\nChoose a design and write your letter.",
  developer_platform_promo: "Hi {{name}}, add jobs, messaging and sign-in to your website with Workly India APIs. 🚀\n\nExplore our developer services: {{developer_services}}.\n\nOpen the Developer Portal to get your API key.",
  profile_complete: "Hi {{name}}, your Workly India profile is complete. ✅\n\nYou can now browse jobs and apply to roles that match your skills.\n\nTake a look at what's available today.",
  profile_incomplete_job_seeker: "Hi {{name}}, your job seeker profile still needs a few details. 📋\n\nAdd your skills and experience so employers can understand what you offer.\n\nComplete your profile when you're ready.",
  profile_incomplete_employer: "Hi {{name}}, your company profile is not complete yet. 🏢\n\nAdd your company details so candidates can learn about your workplace before applying.\n\nOpen your Employer Portal to finish it.",
  application_under_review: "👀 Your application is under review.\n\n💼 Role: *{{job_title}}*\n🏢 Company: {{company}}\n\nYou can follow its progress in Activity.",
  application_shortlisted: "Hi {{name}}, you've been shortlisted! 🎉\n\n💼 Role: *{{job_title}}*\n🏢 Company: {{company}}\n\nKeep an eye on your Activity page for the next update.",
  application_interview_scheduled: "📅 An interview has been scheduled for your application.\n\n💼 Role: *{{job_title}}* at {{company}}\n🗓️ Date: {{interview_date}}\n⏰ Time: {{interview_time}}\n📍 Mode: {{mode}}\n\nCheck Activity for the latest details.",
  application_hired: "Hi {{name}}, you've been selected! 🎉\n\n💼 Role: *{{job_title}}*\n🏢 Company: {{company}}\n\nCheck Activity for your application details.",
  application_rejected: "Hi {{name}}, {{company}} isn't moving forward with your application for *{{job_title}}*.\n\nThank you for applying. 💙\n\nYou can explore other opportunities on Workly India.",
  application_withdrawn: "↩️ Your application has been withdrawn.\n\n💼 Role: *{{job_title}}*\n🏢 Company: {{company}}\n\nYou can browse other opportunities whenever you're ready.",
  application_viewed: "👀 {{company}} has viewed your application.\n\n💼 Role: *{{job_title}}*\n\nCheck Activity for any updates to your application.",
  interview_status_update: "📅 Your interview has an update.\n\n💼 Role: *{{job_title}}* at {{company}}\n📌 Status: *{{status}}*\n🗓️ Date: {{interview_date}}\n⏰ Time: {{interview_time}}\n📍 Mode: {{mode}}\n\nOpen Activity to confirm the latest details.",
  employer_interview_scheduled: "📅 An interview has an update.\n\n👤 Candidate: {{name}}\n💼 Role: *{{job_title}}*\n📌 Status: *{{status}}*\n🗓️ Date: {{interview_date}}\n⏰ Time: {{interview_time}}\n📍 Mode: {{mode}}\n\nOpen your Employer Portal for details.",
  job_expiry: "⏰ Your job post has an expiry update.\n\n💼 Role: *{{job_title}}*\n🗓️ Expiry date: {{expiry_date}}\n\nOpen your Employer Portal to check its status or extend it.",
  boost_expiry: "⏰ Your job boost has an expiry update.\n\n💼 Role: *{{job_title}}*\n🗓️ Expiry date: {{expiry_date}}\n\nCheck your Employer Portal to manage the boost.",
  verification_expiry: "⏰ Your company verification badge has an expiry update.\n\n🏢 Company: {{company}}\n🗓️ Expiry date: {{expiry_date}}\n\nOpen your Employer Portal to check its status.",
};

const defaultButtonsFor = (def: PushTemplateDef, category: BuiltTemplate["category"], audience: WhatsAppAudience): TemplateButton[] => {
  if (category === "AUTHENTICATION") return [];
  const { button_text, button_url } = telegramDefaultsFor(def);
  if (!button_text?.trim() || !button_url?.trim()) return [];
  const destination = audience === "employer" && def.key === "subscribe" ? "/employer-portal" : button_url;
  const label = audience === "employer" && def.key === "subscribe" ? "Employer Portal" : button_text;
  const url = /^https:\/\//i.test(destination) ? destination : `${SITE_URL}${destination.startsWith("/") ? "" : "/"}${destination}`;
  return [{ type: "URL", text: removeEmoji(label).trim().slice(0, 25), url }];
};

const audienceCopy = (key: string, audience: WhatsAppAudience): string | undefined => {
  if (key === "subscribe") return audience === "employer"
    ? "Hi {{name}}, your Workly India employer WhatsApp notifications are on. 🔔\n\nHiring and account updates will arrive here."
    : "Hi {{name}}, your Workly India job seeker WhatsApp notifications are on. 🔔\n\nJob and application updates will arrive here.";
  if (key === "unsubscribe") return audience === "employer"
    ? "Hi {{name}}, your Workly India employer WhatsApp notifications are off.\n\nYou can turn them on again in your notification settings."
    : "Hi {{name}}, your Workly India job seeker WhatsApp notifications are off.\n\nYou can turn them on again in your notification settings.";
  return WHATSAPP_COPY[key];
};

const buildWhatsAppTemplate = (def: PushTemplateDef, audience: WhatsAppAudience): BuiltTemplate => {
  const defaults = telegramDefaultsFor(def);
  const title = removeEmoji(cleanWhatsAppText(defaults.title));
  const body = cleanWhatsAppText(audienceCopy(def.key, audience) || defaults.body);
  const category = categoryFor(def);
  const variableSamples = sampleValuesFor(def);

  if (category === "AUTHENTICATION") {
    return {
      name: whatsappTemplateName(def.key, audience),
      displayName: removeEmoji(def.label).trim(),
      category,
      language: "en_US",
      title,
      body: "Meta generates the verification code message and Copy code button automatically.",
      metaBody: "Your Workly India verification code is {{1}}.",
      variables: ["otp"],
      examples: [variableSamples.otp || "123456"],
      headerContent: null,
      previewBody: "Your Workly India verification code is {{1}}.",
    };
  }

  const titleHasVariable = /\{\{\s*[\w.]+\s*\}\}/.test(title);
  const headerContent = title && !titleHasVariable && title.length <= 60 ? title : null;
  const sourceBody = headerContent ? body : `${title}\n\n${body}`.trim();
  const limitedBody = limitMetaBody(sourceBody);
  const variables = orderedVariableKeys(limitedBody);
  const examples = variables.map((key) => variableSamples[key] || variablesFor(def).find((v) => v.key === key)?.sample || "Sample");

  return {
    name: whatsappTemplateName(def.key, audience),
    displayName: removeEmoji(def.label).trim(),
    category,
    language: "en_US",
    title,
    body: limitedBody,
    metaBody: toMetaVariables(limitedBody, variables),
    variables,
    examples,
    headerContent,
    previewBody: applyVariables(limitedBody, variableSamples) || limitedBody,
  };
};

const groupsForWhatsApp = (audience: WhatsAppAudience) =>
  PUSH_TEMPLATE_GROUPS
    .map((group) => ({
      ...group,
      events: group.events.filter((def) => !def.emailOnly && !def.telegramOnly && (audienceOf(def) === "both" || audienceOf(def) === audience)),
    }))
    .filter((group) => group.events.length > 0);

const normalizedStatus = (row?: WhatsAppTemplateRow | null) => (row?.status || "NOT_SUBMITTED").toUpperCase();

const statusText = (row?: WhatsAppTemplateRow | null) => {
  const status = normalizedStatus(row);
  if (status === "APPROVED") return "Active";
  if (status === "PENDING") return "Waiting for approval";
  if (status === "REJECTED") return "Rejected";
  return "Ready for approval";
};

const StatusBadge = ({ row }: { row?: WhatsAppTemplateRow | null }) => {
  const status = normalizedStatus(row);
  if (status === "NOT_SUBMITTED") return <Badge variant="outline">Ready</Badge>;
  return <TemplateStatusBadge status={status} rejectionReason={row?.rejection_reason} />;
};

export default function WhatsAppTemplates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [audience, setAudience] = useWhatsAppAudience();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastRequestedAudience = useRef<WhatsAppAudience | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, TemplateDraft>>({});
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => groupsForWhatsApp(audience), [audience]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["whatsapp-ready-templates", audience],
    queryFn: async () => {
      const names = groups.flatMap((group) => group.events.map((def) => whatsappTemplateName(def.key, audience)));
      if (names.length === 0) return [] as WhatsAppTemplateRow[];
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .in("name", names)
        .order("name", { ascending: true });
      if (error) throw error;
      const latest = (data || [])
        .map((row: any) => row.last_synced_at as string | null)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1);
      if (latest) setLastSyncTime(latest);
      return (data || []) as WhatsAppTemplateRow[];
    },
  });

  const rowByName = useMemo(() => new Map(rows.map((row) => [row.name, row])), [rows]);
  const selectedDef = selectedTemplate ? groups.flatMap((group) => group.events).find((def) => def.key === selectedTemplate) : undefined;
  const selectedBuilt = selectedDef ? buildWhatsAppTemplate(selectedDef, audience) : undefined;
  const selectedRow = selectedBuilt ? rowByName.get(selectedBuilt.name) : undefined;
  const draft = selectedBuilt ? drafts[selectedBuilt.name] ?? {
    header: removeEmoji(selectedRow?.header_type === "TEXT" ? selectedRow.header_content || "" : selectedBuilt.headerContent || ""),
    body: selectedRow?.content_preview ? selectedRow.content_preview.replace(/\{\{(\d+)\}\}/g, (_match, n: string) => { const stored = selectedRow.variables?.[Number(n) - 1]; return `{{${stored && !/^body_\d+$/.test(stored) ? stored : selectedBuilt.variables[Number(n) - 1] || `body_${n}`}}}`; }) : selectedBuilt.body,
    footer: removeEmoji(selectedRow?.footer || ""),
    imageUrl: selectedRow?.header_type === "IMAGE" ? selectedRow.header_content || "" : "",
    buttons: selectedRow ? storedButtons(selectedRow.buttons) : defaultButtonsFor(selectedDef, selectedBuilt.category, audience),
  } : undefined;
  const setDraft = (patch: Partial<TemplateDraft>) => {
    if (!selectedBuilt || !draft) return;
    setDrafts((prev) => ({ ...prev, [selectedBuilt.name]: { ...draft, ...patch } }));
  };

  const syncMutation = useMutation({
    mutationFn: async (targetAudience: WhatsAppAudience) => {
      setSyncError(null);
      const { data, error } = await waInvoke("whatsapp-cloud-api", { body: { action: "sync_templates", audience: targetAudience } });
      if (error) throw error;
      if (data?.success === false || data?.error_type) throw new Error(data?.error || "Templates could not be synced.");
      return data;
    },
    onSuccess: (data, targetAudience) => {
      if (data?.synced_at) setLastSyncTime(data.synced_at);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-ready-templates", targetAudience] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Templates could not be synced.";
      setSyncError(message);
    },
  });

  useEffect(() => {
    if (lastRequestedAudience.current !== audience) {
      lastRequestedAudience.current = audience;
      syncMutation.mutate(audience);
    }
    // Keep category/status in step with Meta while the page is open.
    const timer = window.setInterval(() => { if (!document.hidden) syncMutation.mutate(audience); }, 60_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  const notifyMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("whatsapp_templates").update({ notify_enabled: enabled } as any).eq("id", id);
      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      toast.success(enabled ? "WhatsApp notification turned on." : "WhatsApp notification turned off.");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-ready-templates", audience] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update this template."),
  });

  const approvalMutation = useMutation({
    mutationFn: async (def: PushTemplateDef) => {
      const built = buildWhatsAppTemplate(def, audience);
      const existing = rowByName.get(built.name);
      const current = drafts[built.name] ?? {
        header: removeEmoji(existing?.header_type === "TEXT" ? existing.header_content || "" : built.headerContent || ""),
        body: existing?.content_preview ? existing.content_preview.replace(/\{\{(\d+)\}\}/g, (_match, n: string) => { const stored = existing.variables?.[Number(n) - 1]; return `{{${stored && !/^body_\d+$/.test(stored) ? stored : built.variables[Number(n) - 1] || `body_${n}`}}}`; }) : built.body,
        footer: removeEmoji(existing?.footer || ""), imageUrl: existing?.header_type === "IMAGE" ? existing.header_content || "" : "", buttons: existing ? storedButtons(existing.buttons) : defaultButtonsFor(def, built.category, audience),
      };
       const body = current.body.trim();
      const header = removeEmoji(current.header).trim();
      const footer = removeEmoji(current.footer).trim();
      if (!body || body.length > MAX_META_BODY_LENGTH) throw new Error("Message must be 1–1024 characters.");
      if (header.length > 60 || /[\r\n*~_]/.test(header)) throw new Error("Header must be 60 characters or less, with no newlines or formatting characters.");
      if (footer.length > 60) throw new Error("Footer must be 60 characters or less.");
      if (current.buttons.length > 3 || current.buttons.some((b) => !b.text.trim() || b.text.length > 25 || /[\r\n]/.test(b.text) || (b.type === "URL" && !/^https:\/\/[^\s/]+\.[^\s/]+(?:\/[^\s]*)?$/.test(b.url || "")) || (b.type === "PHONE_NUMBER" && !/^\+\d{8,15}$/.test(b.phone_number || "")))) throw new Error("Check button labels (max 25 characters) and HTTPS links or international phone numbers.");
      const variables = orderedVariableKeys(body);
      if (variables.some((key) => /^\d+$/.test(key) || !/^[a-zA-Z][\w]*$/.test(key))) throw new Error("Use named fields like {{name}}, not numbered fields.");
      if (variables.some((key) => ![...variablesFor(def).map((v) => v.key), "date", "time"].includes(key))) throw new Error("Use fields from the Insert field menu so sample values match your message.");
      if (variables.length > 10 || /\{\{|\}\}/.test(body.replace(/\{\{[a-zA-Z][\w]*\}\}/g, ""))) throw new Error("Use up to 10 correctly closed fields from the Insert field menu.");
      if (built.category !== "AUTHENTICATION" && (/^\{\{/.test(body) || /\}\}$/.test(body) || /\}\}\s*\{\{/.test(body))) throw new Error("Add descriptive text around fields; Meta may reject messages that start, end, or stack fields together.");
      if (built.category === "AUTHENTICATION" && (current.imageUrl || current.buttons.length || header || footer)) throw new Error("Verification templates use Meta's built-in message and Copy Code button.");
      const samples = sampleValuesFor(def);
      const examples = variables.map((key) => samples[key] || variablesFor(def).find((v) => v.key === key)?.sample || "Sample");
      const metaBody = built.category === "AUTHENTICATION" ? "Your Workly India verification code is {{1}}." : toMetaVariables(body, variables);
      let imageHandle: string | undefined;
      if (current.imageUrl && built.category !== "AUTHENTICATION") {
        const { data: media, error: mediaError } = await waInvoke("whatsapp-cloud-api", { body: { action: "upload_template_image", image_url: current.imageUrl } });
        if (mediaError || !media?.handle) throw new Error(media?.error || mediaError?.message || "Image could not be prepared for Meta.");
        imageHandle = media.handle;
      }
      // Keep Meta's category once Meta has assigned one, so edits never trigger a recategorisation.
      const category = metaCategory(existing) || built.category;
      const payload = {
        action: existing?.msg91_template_id ? "edit_template" : "create_template",
        template_id: existing?.msg91_template_id || undefined,
        template_name: built.name,
        language: built.language,
        category,
        content: metaBody,
        header_type: current.imageUrl ? "IMAGE" : header ? "TEXT" : null,
        header_content: current.imageUrl || header || null,
        header_handle: imageHandle,
        footer,
        examples,
        buttons: current.buttons,
      };
      const { data, error } = await waInvoke("whatsapp-cloud-api", { body: payload });
      if (error) throw error;
      if (data?.success === false || data?.error) throw new Error(data?.error || "Template could not be submitted.");

      const status = String(data?.status || data?.data?.status || "PENDING").toUpperCase();
      const templateId = data?.template_id || existing?.msg91_template_id || null;
      const { error: saveError } = await supabase.from("whatsapp_templates").upsert(
        {
          name: built.name,
          display_name: built.displayName,
          category: category.toLowerCase(),
          language: built.language,
          content_preview: metaBody,
          variables,
        is_active: status === "APPROVED",
          status,
          rejection_reason: null,
          header_type: current.imageUrl ? "IMAGE" : header ? "TEXT" : null,
          header_content: current.imageUrl || header || null,
          footer,
          buttons: current.buttons,
          msg91_template_id: templateId,
          last_synced_at: new Date().toISOString(),
        } as any,
        { onConflict: "name" },
      );
      if (saveError) throw saveError;
      setDrafts((prev) => { const next = { ...prev }; delete next[built.name]; return next; });
      return built;
    },
    onSuccess: (built) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-ready-templates", audience] });
      toast.success(`${built.displayName} was sent for Meta approval.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Template could not be submitted.");
    },
  });

  const testMutation = useMutation({
    mutationFn: async (p: { def: PushTemplateDef; name: string; variables: string[]; body: string }) => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sign in again to send a test.");

      const table = audience === "employer" ? "companies" : "profiles";
      const { data: owner, error: ownerError } = await supabase
        .from(table)
        .select("whatsapp_number, phone")
        .eq("user_id", userId)
        .maybeSingle();
      if (ownerError) throw new Error(ownerError.message);
      const digits = String(owner?.whatsapp_number || owner?.phone || "").replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) throw new Error("Add a valid WhatsApp number to your profile first.");
      const samples = sampleValuesFor(p.def);
      const isAuth = metaCategory(rowByName.get(p.name)) === "AUTHENTICATION";
      const values = isAuth ? ["482913"] : p.variables.map((key) => samples[key] || variablesFor(p.def).find((v) => v.key === key)?.sample || "Sample");
      const { data, error } = await waInvoke("whatsapp-cloud-api", { body: { action: "send_template", audience, to: digits.length === 10 ? `91${digits}` : digits, template_name: p.name, variables: values } });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Test message could not be sent.");
      if (!data?.message_id) throw new Error("Meta did not accept the test message.");
      return data;
    },
    onSuccess: () => toast.success("Meta accepted the test. Check your profile WhatsApp number."),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Test message could not be sent."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: WhatsAppTemplateRow) => {
      const { data, error } = await waInvoke("whatsapp-cloud-api", { body: { action: "delete_template", template_name: row.name, msg91_template_id: row.msg91_template_id || undefined } });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Template could not be deleted.");
      await supabase.from("whatsapp_templates").delete().eq("name", row.name);
    },
    onSuccess: () => {
      if (selectedBuilt) setDrafts((prev) => { const next = { ...prev }; delete next[selectedBuilt.name]; return next; });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-ready-templates", audience] });
      toast.success("Template deleted. You can edit and submit it again.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Template could not be deleted."),
  });

  const wrapSelection = (marker: string) => {
    const el = bodyRef.current;
    if (!el || !draft) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = draft.body.slice(s, e) || "text";
    const next = draft.body.slice(0, s) + marker + selected + marker + draft.body.slice(e);
    setDraft({ body: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + marker.length, s + marker.length + selected.length); });
  };

  const insertField = (key: string) => {
    const el = bodyRef.current;
    if (!draft) return;
    const pos = el?.selectionStart ?? draft.body.length;
    setDraft({ body: draft.body.slice(0, pos) + `{{${key}}}` + draft.body.slice(pos) });
  };

  const handleCropComplete = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await uploadToR2(file, "template-whatsapp");
      setDraft({ imageUrl: `${url}?t=${Date.now()}`, header: "" });
      toast.success("Image added. Submit for approval to use it.");
      setCropFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  if (selectedDef && selectedBuilt && draft) {
    const status = normalizedStatus(selectedRow);
    const isPending = status === "PENDING";
    const isApproved = status === "APPROVED";
    const submitText = selectedRow ? "Submit Changes for Approval" : "Submit for Approval";
    const variables = orderedVariableKeys(draft.body);
     const sampleValues = sampleValuesFor(selectedDef);
     const preview = draft.body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => sampleValues[key] || variablesFor(selectedDef).find((v) => v.key === key)?.sample || `{{${key}}}`);
    const dirty = !!drafts[selectedBuilt.name];

    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-2 sm:px-4">
            <Button variant="ghost" size="icon" onClick={() => setSelectedTemplate(null)} aria-label="Back to WhatsApp templates">
              <ArrowLeft className="h-5 w-5" />
            </Button>
             <h1 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-lg">{removeEmoji(selectedDef.label).trim()}</h1>
            <StatusBadge row={selectedRow} />
          </div>
        </header>

        <main className="mx-auto max-w-4xl space-y-4 p-4 pb-8 sm:p-6">
          {isApproved && selectedRow && (
            <Card>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium">WhatsApp notification enabled</p>
                  <p className="text-sm text-muted-foreground">Turn this off to stop sending this WhatsApp message.</p>
                </div>
                <Switch
                  checked={selectedRow.notify_enabled !== false}
                  disabled={notifyMutation.isPending}
                  onCheckedChange={(enabled) => notifyMutation.mutate({ id: selectedRow.id, enabled })}
                  aria-label="WhatsApp notification enabled"
                />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">Edit template <Badge variant="outline" className="uppercase">{metaCategory(selectedRow) || selectedBuilt.category}</Badge></CardTitle>
              {metaCategory(selectedRow) && metaCategory(selectedRow) !== selectedBuilt.category && (
                <Alert><AlertTitle>Meta set this as {metaCategory(selectedRow)}</AlertTitle><AlertDescription>The category now matches Meta. Future edits keep Meta's category, so no mismatch emails.</AlertDescription></Alert>
              )}
               <CardDescription>{removeEmoji(selectedDef.description).trim()}</CardDescription>
            </CardHeader>
             <CardContent className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
              <WhatsAppPreview
                header={draft.imageUrl ? { type: "IMAGE", content: draft.imageUrl } : draft.header ? { type: "TEXT", content: removeEmoji(draft.header) } : undefined}
                 body={selectedBuilt.category === "AUTHENTICATION" ? "Your Workly India verification code is 482913." : preview}
                 footer={selectedBuilt.category === "AUTHENTICATION" ? "For your security, do not share this code." : removeEmoji(draft.footer)}
                buttons={selectedBuilt.category === "AUTHENTICATION" ? [{ type: "OTP", text: "Copy code" }] : draft.buttons}
              />

              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Meta template name</p>
                  <code className="block rounded-md bg-muted px-3 py-2 text-xs break-all">{selectedBuilt.name}</code>
                </div>

                {selectedBuilt.category === "AUTHENTICATION" && (
                  <Alert>
                    <AlertTitle>Copy code button included</AlertTitle>
                    <AlertDescription>Meta adds a "Copy code" button to this verification message, so users can copy the OTP with one tap.</AlertDescription>
                  </Alert>
                )}

                {selectedBuilt.category !== "AUTHENTICATION" && <div className="space-y-2">
                  <Label htmlFor="wa-header">Header</Label>
                  <Input id="wa-header" value={draft.header} maxLength={60} disabled={!!draft.imageUrl} onChange={(e) => setDraft({ header: removeEmoji(e.target.value) })} placeholder="Optional text header" />
                  <Label>Message image (1024 × 512)</Label>
                  {draft.imageUrl ? (
                    <div className="relative w-full max-w-sm">
                      <img src={draft.imageUrl} alt="Template image" className="max-h-64 w-full rounded-md object-contain" />
                      <Button type="button" variant="destructive" size="icon" className="absolute right-2 top-2 h-8 w-8" aria-label="Remove image" onClick={() => setDraft({ imageUrl: "" })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No image added yet.</p>}
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (!/^image\/(jpeg|png)$/.test(file.type)) { toast.error("Please choose a JPG or PNG image."); return; }
                    if (file.size > 5 * 1024 * 1024) { toast.error("The image must be smaller than 5 MB."); return; }
                    setCropFile(file);
                  }} />
                  <Button type="button" variant="outline" className="w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="mr-2 h-4 w-4" />{uploading ? "Uploading…" : draft.imageUrl ? "Change image" : "Upload image"}
                  </Button>
                </div>}

                <div className="space-y-2">
                  <Label htmlFor="wa-body">Message</Label>
                  {selectedBuilt.category !== "AUTHENTICATION" && (
                    <div className="flex flex-wrap items-center gap-1 rounded-md border p-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Bold" onClick={() => wrapSelection("*")}><Bold className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Italic" onClick={() => wrapSelection("_")}><Italic className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Strikethrough" onClick={() => wrapSelection("~")}><Strikethrough className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Monospace" onClick={() => wrapSelection("```")}><Code className="h-4 w-4" /></Button>
                      {variablesFor(selectedDef).length > 0 && (
                        <Select value="" onValueChange={insertField}>
                          <SelectTrigger className="ml-auto h-8 w-auto gap-1 text-xs" aria-label="Insert field"><SelectValue placeholder="Insert field" /></SelectTrigger>
                          <SelectContent>{variablesFor(selectedDef).map((v: any) => { const key = typeof v === "string" ? v : v.key; return <SelectItem key={key} value={key}>{key}</SelectItem>; })}</SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                   <Textarea ref={bodyRef} id="wa-body" rows={8} value={draft.body} onChange={(e) => setDraft({ body: e.target.value })} maxLength={1024} disabled={selectedBuilt.category === "AUTHENTICATION"} />
                  {selectedBuilt.category === "AUTHENTICATION" ? (
                    <p className="text-xs text-muted-foreground">Meta controls the verification message. The preview shows how your code will appear.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{draft.body.length}/1024 · Select text to format it. Fields need descriptive text around them.</p>
                  )}
                </div>

                {selectedBuilt.category !== "AUTHENTICATION" && <>
                  <div className="space-y-2"><Label htmlFor="wa-footer">Footer</Label><Input id="wa-footer" maxLength={60} value={draft.footer} onChange={(e) => setDraft({ footer: removeEmoji(e.target.value) })} placeholder="Optional footer" /></div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><Label>Buttons and links</Label><Button variant="outline" size="sm" disabled={draft.buttons.length >= 3} onClick={() => setDraft({ buttons: [...draft.buttons, { type: "QUICK_REPLY", text: "" }] })}><Plus className="mr-1 h-4 w-4" /> Add</Button></div>
                    {draft.buttons.map((button, index) => <div key={index} className="space-y-2 border-t pt-3">
                      <div className="flex items-center gap-2"><Select value={button.type} onValueChange={(type: TemplateButton["type"]) => setDraft({ buttons: draft.buttons.map((b, i) => i === index ? { type, text: b.text } : b) })}><SelectTrigger aria-label={`Button ${index + 1} type`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="QUICK_REPLY">Quick reply</SelectItem><SelectItem value="URL">Website link</SelectItem><SelectItem value="PHONE_NUMBER">Call number</SelectItem></SelectContent></Select><Button variant="ghost" size="icon" aria-label={`Remove button ${index + 1}`} onClick={() => setDraft({ buttons: draft.buttons.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button></div>
                      <Input aria-label={`Button ${index + 1} label`} placeholder="Button label" maxLength={25} value={button.text} onChange={(e) => setDraft({ buttons: draft.buttons.map((b, i) => i === index ? { ...b, text: removeEmoji(e.target.value) } : b) })} />
                      {button.type !== "QUICK_REPLY" && <Input aria-label={`Button ${index + 1} destination`} placeholder={button.type === "URL" ? "https://example.com" : "+919876543210"} value={button.type === "URL" ? button.url || "" : button.phone_number || ""} onChange={(e) => setDraft({ buttons: draft.buttons.map((b, i) => i === index ? { ...b, [button.type === "URL" ? "url" : "phone_number"]: e.target.value } : b) })} />}
                    </div>)}
                  </div>
                </>}

                {variables.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Fields</p>
                    <div className="flex flex-wrap gap-2">
                      {variables.map((key, index) => (
                        <Badge key={key} variant="secondary">{`{{${index + 1}}} ${key}`}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(!isApproved || dirty) && <div className="flex flex-col gap-2 sm:flex-row">
                  {isPending && !dirty ? (
                    <Button className="w-full" disabled>
                      <Clock className="mr-2 h-4 w-4" /> Waiting for Approval
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={() => approvalMutation.mutate(selectedDef)} disabled={approvalMutation.isPending || uploading}>
                      {approvalMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {submitText}
                    </Button>
                  )}
                </div>}
                <div className="space-y-1">
                  <Button variant="outline" className="w-full" disabled={!isApproved || testMutation.isPending} onClick={() => testMutation.mutate({ def: selectedDef, name: selectedBuilt.name, variables, body: draft.body })}>
                    {testMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {testMutation.isPending ? "Sending test…" : "Send test to me"}
                  </Button>
                  <p className="text-xs text-muted-foreground">{isApproved ? "Sends to the WhatsApp number saved in your profile." : "Testing works after Meta approves this template."}</p>
                </div>
                {selectedRow && (
                  <Button variant="destructive" className="w-full" disabled={deleteMutation.isPending} onClick={async () => {
                    if (await confirmDialog("Delete this template from Meta? You can submit it again later.")) deleteMutation.mutate(selectedRow);
                  }}>
                    {deleteMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete Template
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
        <ImageCropDialog
          open={Boolean(cropFile)}
          onOpenChange={(open) => { if (!open) setCropFile(null); }}
          imageFile={cropFile}
          onCropComplete={handleCropComplete}
          aspectRatio={2}
          outputSize={{ width: 1024, height: 512 }}
          title="Crop message image"
          hideHeader
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 pb-24 sm:p-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">WhatsApp Templates</h1>
          {lastSyncTime && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> Last synced: {format(new Date(lastSyncTime), "dd MMMM yyyy, hh:mm a")}
            </p>
          )}
        </div>
        <Button variant="outline" size="icon" aria-label="WhatsApp settings" onClick={() => navigate("/owner-portal/whatsapp/settings")}>
          <Settings className="h-5 w-5" />
        </Button>
      </div>

       <Tabs value={audience} onValueChange={(value) => { setSelectedTemplate(null); setAudience(value as WhatsAppAudience); }}>
         <TabsList className="grid w-full grid-cols-2">
           <TabsTrigger value="job_seeker">Job seekers</TabsTrigger>
           <TabsTrigger value="employer">Employers</TabsTrigger>
         </TabsList>
       </Tabs>

      {syncError && (
        <Alert variant="destructive">
          <RefreshCw className="h-4 w-4" />
          <AlertTitle>WhatsApp connection needs attention</AlertTitle>
          <AlertDescription>{syncError}</AlertDescription>
        </Alert>
      )}


      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <Card key={item}>
              <CardHeader>
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent><Skeleton className="h-16 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Send className="h-5 w-5 text-primary" />
                   {removeEmoji(group.label).trim()}
                </CardTitle>
                <CardDescription>{group.events.length} messages</CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
                <div className="divide-y">
                  {group.events.map((def) => {
                    const built = buildWhatsAppTemplate(def, audience);
                    const row = rowByName.get(built.name);
                    return (
                      <Button
                        key={def.key}
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start rounded-none px-1 py-4 text-left hover:bg-muted/50"
                        onClick={() => setSelectedTemplate(def.key)}
                      >
                        <div className="min-w-0 flex-1 whitespace-normal">
                          <div className="flex flex-wrap items-center gap-2">
                             <p className="font-medium">{removeEmoji(def.label).trim()}</p>
                            <StatusBadge row={row} />
                            <Badge variant="outline" className="text-[10px] uppercase">{built.category}</Badge>
                            {normalizedStatus(row) === "APPROVED" && row?.notify_enabled === false && <Badge variant="secondary">Off</Badge>}
                          </div>
                           <p className="mt-1 text-xs font-normal text-muted-foreground">{removeEmoji(def.description).trim()}</p>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">{statusText(row)}</p>
                        </div>
                        <ChevronRight className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
