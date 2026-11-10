import { confirmDialog } from '@/lib/confirmDialog';
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { WhatsAppPreview } from "@/components/owner-portal/whatsapp/WhatsAppPreview";
import { waInvoke, type WhatsAppAudience } from "@/lib/whatsappAudience";
import { SUPPORT_TEMPLATE_BODY, supportTemplateName } from "@/lib/whatsappSupportTemplate";

type MetaTemplate = { id: string; name: string; status: string; language: string; category: string; components?: Array<{ type: string; text?: string }> };

export function SupportTemplateManager({ audience }: { audience: WhatsAppAudience }) {
  const queryClient = useQueryClient();
  const name = supportTemplateName(audience);
  const [body, setBody] = useState(SUPPORT_TEMPLATE_BODY);
  const [dirty, setDirty] = useState(false);

  const { data: template, isLoading, error } = useQuery({
    queryKey: ["whatsapp-support-template", audience],
    queryFn: async (): Promise<MetaTemplate | null> => {
      const { data, error } = await waInvoke("whatsapp-cloud-api", { body: { action: "get_templates", audience } });
      if (error || data?.success === false) throw new Error(data?.error || error?.message || "Could not check Meta approval.");
      return (data.data as MetaTemplate[]).find((item) => item.name === name) ?? null;
    },
    refetchInterval: 60_000,
  });

  const savedBody = template?.components?.find((component) => component.type === "BODY")?.text;
  useEffect(() => {
    if (!dirty) setBody(savedBody || SUPPORT_TEMPLATE_BODY);
  }, [savedBody, dirty]);

  const submit = useMutation({
    mutationFn: async () => {
      const content = body.trim();
      if (!content || content.length > 1024) throw new Error("Message must be 1–1024 characters.");
      if (/[{}]/.test(content)) throw new Error("This chat opener does not use variable fields.");
      const { data, error } = await waInvoke("whatsapp-cloud-api", {
        body: {
          audience,
          action: template ? "edit_template" : "create_template",
          template_id: template?.id,
          template_name: name,
          language: template?.language || "en_US",
          category: template?.category || "UTILITY",
          content,
        },
      });
      if (error || data?.success === false) throw new Error(data?.error || error?.message || "Meta could not accept this template.");
      return data;
    },
    onSuccess: async () => {
      const { data, error } = await waInvoke("whatsapp-cloud-api", { body: { action: "sync_templates", audience } });
      if (error || data?.success === false) toast.error("Meta accepted the submission, but approval status could not be refreshed yet.");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-support-template", audience] });
      toast.success("Customer support template submitted to Meta for approval.");
      setDirty(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Submission failed."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { data, error } = await waInvoke("whatsapp-cloud-api", { body: { action: "delete_template", audience, template_name: name } });
      if (error || data?.success === false) throw new Error(data?.error || error?.message || "Could not delete template.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-support-template", audience] });
      setDirty(false);
      toast.success("Template deleted.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Delete failed."),
  });

  const status = template?.status?.toUpperCase();
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{audience === "customer_service" ? "Customer Service" : audience === "employer" ? "Employers" : "Job Seekers"}</h2>
        <Badge variant={status === "APPROVED" ? "default" : "secondary"}>{status === "APPROVED" ? "Approved" : status === "PENDING" ? "Waiting for approval" : status === "REJECTED" ? "Rejected" : template ? status : "Not submitted"}</Badge>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : "Could not check Meta approval."}</p>}
      <p className="break-all text-xs text-muted-foreground">{name}</p>
      <WhatsAppPreview body={body} />
      <Label htmlFor={`support-message-${audience}`}>Message</Label>
      <Textarea id={`support-message-${audience}`} rows={6} maxLength={1024} value={body} disabled={isLoading} onChange={(event) => { setBody(event.target.value); setDirty(true); }} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="w-full sm:w-auto" disabled={isLoading || !!error || submit.isPending || (!!template && !dirty)} onClick={() => submit.mutate()}>
          {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {template ? "Update & resubmit" : "Submit for approval"}
        </Button>
        {template && (
          <Button variant="destructive" className="w-full sm:w-auto" disabled={remove.isPending} onClick={async () => { if (await confirmDialog("Delete this template from Meta?")) remove.mutate(); }}>
            {remove.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}