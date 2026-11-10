import { employerScope } from "@/components/employer/whatsapp/selectedNumber";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, FileText, Send, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppPreview } from "@/components/owner-portal/whatsapp/WhatsAppPreview";
import { isAnySupportTemplate, prepareApprovedChatTemplates } from "@/lib/whatsappSupportTemplate";

interface TemplateComponent {
  type: string;
  text?: string;
  format?: string;
  buttons?: Array<{ type: string; text: string; url?: string }>;
}

interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components?: TemplateComponent[];
}

function bodyTextOf(template: Template) {
  return template.components?.find((c) => c.type?.toUpperCase() === "BODY")?.text || "";
}

function variableCountOf(template: Template) {
  const body = bodyTextOf(template);
  const found = new Set<number>();
  body.replace(/\{\{(\d+)\}\}/g, (_m, n) => { found.add(Number(n)); return _m; });
  return found.size;
}

export default function EmployerTemplatePickerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { phoneNumber } = useParams<{ phoneNumber: string }>();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [params, setParams] = useState<string[]>([]);

  const normalizedPhone = useMemo(
    () => decodeURIComponent(phoneNumber || "").replace(/\D/g, ""),
    [phoneNumber],
  );

  const { data: conversation } = useQuery({
    queryKey: ["employer-wa-conversation-by-phone", normalizedPhone],
    queryFn: async () => {
      if (!normalizedPhone) return null;
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .in("phone_number", [normalizedPhone, `+${normalizedPhone}`])
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!normalizedPhone,
  });

  const { data: templates = [], isLoading, error: templatesError } = useQuery({
    queryKey: ["employer-wa-approved-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("workly-india", {
        body: { ...employerScope(), action: "get_templates" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to fetch templates");
      return prepareApprovedChatTemplates((data.data || []) as Template[]);
    },
  });

  const sendTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate || !normalizedPhone) throw new Error("No template selected");
      const { data, error } = await supabase.functions.invoke("workly-india", {
        body: {
          ...employerScope(),
          action: "send_template",
          phone_number: normalizedPhone,
          template_name: selectedTemplate.name,
          template_language: selectedTemplate.language,
          conversation_id: conversation?.id ?? null,
          body_params: params,
          template_body: bodyTextOf(selectedTemplate),
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send template");
      return data;
    },
    onSuccess: () => {
      toast.success("Template message sent!");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      navigate(`/employer/workly-chat/chat/${phoneNumber}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to send template");
    },
  });

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setParams(Array.from({ length: variableCountOf(template) }, () => ""));
  };

  const handleBack = () => {
    if (selectedTemplate) {
      setSelectedTemplate(null);
      setParams([]);
    } else {
      navigate(`/employer/workly-chat/chat/${phoneNumber}`);
    }
  };

  const previewBody = selectedTemplate
    ? params.reduce((text, value, i) => text.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, "g"), value || `{{${i + 1}}}`), bodyTextOf(selectedTemplate))
    : "";

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="safe-area-inset-top flex items-center gap-3 border-b bg-card px-4 py-3">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-1 items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="font-semibold">{selectedTemplate ? "Send Template" : "Approved Templates"}</h1>
        </div>
      </div>

      {!selectedTemplate ? (
        <div className="flex-1 overflow-y-auto p-4 pb-20">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : templatesError ? (
            <p role="alert" className="py-12 text-center text-destructive">
              {templatesError instanceof Error ? templatesError.message : "Could not load templates."}
            </p>
          ) : templates.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-16 w-16 opacity-50" />
              <p className="font-medium">No approved templates yet</p>
              <p className="mt-1 text-sm">Templates must be approved by Meta before you can send them.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approved by Meta</p>
              {templates.map((template) => (
                <Button
                  key={template.id || template.name}
                  onClick={() => handleSelectTemplate(template)}
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal p-4 text-left"
                >
                  <div className="flex w-full flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-base font-medium">
                        {isAnySupportTemplate(template.name) ? "Chat Start Template" : template.name.replace(/_/g, " ")}
                      </p>
                      <ChevronRight className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {isAnySupportTemplate(template.name) && <Badge>Chat Start Template</Badge>}
                      <Badge variant="secondary">{template.category}</Badge>
                      <Badge variant="outline">{template.language}</Badge>
                      <Badge variant="outline">Approved</Badge>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{bodyTextOf(template)}</p>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 pb-20">
          <div className="mb-6"><WhatsAppPreview body={previewBody} /></div>

          {params.length > 0 && (
            <div className="mb-6 space-y-4">
              <p className="text-sm font-medium">Fill variables</p>
              {params.map((value, index) => (
                <div key={index} className="space-y-2">
                  <Label className="text-sm text-muted-foreground">{`{{${index + 1}}}`}</Label>
                  <Input
                    placeholder={`Enter value for {{${index + 1}}}`}
                    value={value}
                    onChange={(e) => setParams((prev) => prev.map((p, i) => (i === index ? e.target.value : p)))}
                    className="text-base"
                  />
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={() => sendTemplateMutation.mutate()}
            disabled={sendTemplateMutation.isPending || params.some((p) => !p.trim())}
            className="h-12 w-full text-base"
          >
            {sendTemplateMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Send Template
              </>
            )}
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Template messages can be sent outside the 24-hour session window
          </p>
        </div>
      )}
    </div>
  );
}
