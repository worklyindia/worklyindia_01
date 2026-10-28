import { waInvoke, CHAT_AUDIENCE, type WhatsAppAudience } from "@/lib/whatsappAudience";
import { isAnySupportTemplate, prepareApprovedChatTemplates } from "@/lib/whatsappSupportTemplate";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, FileText, Send, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppPreview } from "@/components/owner-portal/whatsapp/WhatsAppPreview";

interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components?: Array<{
    type: string;
    text?: string;
    format?: string;
    example?: { body_text?: string[][] };
    buttons?: Array<{ type: string; text: string; url?: string }>;
  }>;
  variables?: string[];
  audience?: WhatsAppAudience;
}

export default function TemplatePickerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { phoneNumber } = useParams<{ phoneNumber: string }>();
  const [searchParams] = useSearchParams();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const requestedAudience = searchParams.get("audience");

  // Get conversation ID from phone number (stored with or without +)
  const { data: conversation, isLoading: loadingConversation, error: conversationError } = useQuery({
    queryKey: ['whatsapp-conversation-by-phone', phoneNumber],
    queryFn: async () => {
      if (!phoneNumber) return null;
      const cleanPhone = decodeURIComponent(phoneNumber).replace(/\D/g, '');
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('id, audience, contact_type')
        .in('phone_number', [cleanPhone, `+${cleanPhone}`])
        .eq('audience', CHAT_AUDIENCE)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!phoneNumber,
  });

  const toAudience = (v?: string | null): WhatsAppAudience | null => {
    const s = String(v || '').toLowerCase().replace(/[^a-z_]/g, '');
    if (s === 'employer' || s === 'company' || s === 'recruiter' || s === 'business') return 'employer';
    if (s === 'job_seeker' || s === 'jobseeker' || s === 'candidate') return 'job_seeker';
    return null;
  };
  const audience: WhatsAppAudience | null =
    toAudience(requestedAudience) || toAudience(conversation?.audience) || toAudience(conversation?.contact_type);

  // Show one Customer Service chat opener first, followed by every other approved template.
  const audiencesToLoad: WhatsAppAudience[] = [CHAT_AUDIENCE];
  const { data: templates = [], isLoading, error: templatesError } = useQuery({
    queryKey: ['whatsapp-chat-support-templates', audiencesToLoad.join(',')],
    queryFn: async () => {
      const results = await Promise.all(audiencesToLoad.map(async (a) => {
        const response = await waInvoke('whatsapp-cloud-api', { body: { action: 'get_templates', audience: a, status: 'approved' } });
        if (response.error) throw response.error;
        if (!response.data?.success) throw new Error(response.data?.error || 'Failed to fetch templates');
        return prepareApprovedChatTemplates(
          ((response.data.data || []) as Template[]).map(t => ({ ...t, audience: a })),
        );
      }));
      return results.flat();
    },
    enabled: !loadingConversation,
  });

  // Send template mutation
  const sendTemplateMutation = useMutation({
    mutationFn: async () => {
      const sendAudience = selectedTemplate?.audience;
      if (!selectedTemplate || !phoneNumber || !sendAudience) throw new Error('No approved template selected');
      
      const normalizedPhone = decodeURIComponent(phoneNumber).replace(/^\+/, '').replace(/\D/g, '');
      const templateBody = getTemplateBodyText(selectedTemplate);
      const templateComponents = selectedTemplate.components || [];
      
      const response = await waInvoke('whatsapp-cloud-api', {
        body: {
          action: 'send_template',
          audience: sendAudience,
          to: normalizedPhone,
          template_name: selectedTemplate.name,
          template_language: selectedTemplate.language,
          variables: Object.keys(variables).length > 0 ? variables : undefined,
          conversation_id: conversation?.id,
          template_body: templateBody,
          template_components: templateComponents,
        }
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to send template');
      
      return response.data;
    },
    onSuccess: () => {
      toast.success("Template message sent!");
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      navigate(`/owner-portal/whatsapp/chat/${phoneNumber}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to send template");
    },
  });

  const getTemplateBodyText = (template: Template) => {
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    return bodyComponent?.text || 'No body text';
  };

  const extractVariables = (template: Template) => {
    return template.variables || [];
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    const vars = extractVariables(template);
    const initialVars: Record<string, string> = {};
    vars.forEach(v => { initialVars[v] = ''; });
    setVariables(initialVars);
  };

  const handleBack = () => {
    if (selectedTemplate) {
      setSelectedTemplate(null);
      setVariables({});
    } else {
      navigate(`/owner-portal/whatsapp/chat/${phoneNumber}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card safe-area-inset-top">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
           <FileText className="h-5 w-5 text-primary" />
          <h1 className="font-semibold">
             {selectedTemplate ? 'Send Template' : 'Approved Templates'}
          </h1>
        </div>
      </div>

      {!selectedTemplate ? (
        <>
          {/* Templates List */}
          <div className="flex-1 overflow-y-auto p-4 pb-20">
            {isLoading || loadingConversation ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : templatesError || conversationError ? (
              <p role="alert" className="text-center text-destructive py-12">{(templatesError || conversationError) instanceof Error ? (templatesError || conversationError)?.message : 'Could not load this chat.'}</p>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No approved templates yet</p>
                <p className="text-sm mt-1">Templates must be approved by Meta before sending.</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/owner-portal/whatsapp/support-templates')}>Chat Templates</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approved by Meta</p>
                {templates.map((template: Template) => (
                  <Button
                    key={`${template.audience}-${template.id}`}
                    onClick={() => handleSelectTemplate(template)}
                    variant="outline"
                    className="h-auto w-full whitespace-normal p-4 text-left justify-start"
                  >
                    <div className="flex w-full flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-base">
                          {isAnySupportTemplate(template.name) ? "Chat Start Template" : template.name.replace(/_/g, " ")}
                        </p>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {isAnySupportTemplate(template.name) && <Badge>Chat Start Template</Badge>}
                        <Badge variant="secondary">{template.category}</Badge>
                        <Badge variant="outline">{template.language}</Badge>
                        <Badge variant="outline">Approved</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {getTemplateBodyText(template)}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 pb-20">
           <div className="mb-6"><WhatsAppPreview body={getTemplateBodyText(selectedTemplate).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => variables[`body_${k}`]?.trim() || m)} /></div>

          {/* Variables Input */}
          {Object.keys(variables).length > 0 && (
            <div className="space-y-4 mb-6">
              <p className="text-sm font-medium">Fill Variables</p>
              {Object.keys(variables).map((varKey) => (
                <div key={varKey} className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    {`{{${varKey.replace(/^body_/, '')}}}`}
                  </Label>
                  <Input
                    placeholder={`Enter value for {{${varKey.replace(/^body_/, '')}}}`}
                    value={variables[varKey]}
                    onChange={(e) => setVariables(prev => ({
                      ...prev,
                      [varKey]: e.target.value
                    }))}
                    className="text-base"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Send Button */}
          <Button 
            onClick={() => sendTemplateMutation.mutate()}
             disabled={sendTemplateMutation.isPending || Object.values(variables).some(value => !value.trim())}
             className="w-full h-12 text-base"
          >
            {sendTemplateMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                 Send Template
              </>
            )}
          </Button>

          {/* Info */}
          <p className="text-xs text-center text-muted-foreground mt-4">
            Template messages are sent outside the 24-hour session window
          </p>
        </div>
      )}
    </div>
  );
}
