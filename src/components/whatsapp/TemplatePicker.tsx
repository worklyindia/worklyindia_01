import { waInvoke } from "@/lib/whatsappAudience";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, FileText, Send, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import LottieSearchIcon from "@/components/LottieSearchIcon";

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
}

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  conversationId?: string;
  onSent: () => void;
}

export function TemplatePicker({ 
  open, 
  onOpenChange, 
  phoneNumber, 
  conversationId,
  onSent 
}: TemplatePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['msg91-templates'],
    queryFn: async () => {
      const response = await waInvoke('whatsapp-cloud-api', {
        body: { action: 'get_templates', status: 'approved' }
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to fetch templates');
      
      // Edge function now returns flat array directly
      return response.data.data || [];
    },
    enabled: open,
  });

  // Send template mutation
  const sendTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error('No template selected');
      
      // Normalize phone number (remove + and non-digits)
      const normalizedPhone = phoneNumber.replace(/^\+/, '').replace(/\D/g, '');
      
      // Get template body text for proper display
      const templateBody = getTemplateBodyText(selectedTemplate);
      
      // Get template components for rendering
      const templateComponents = selectedTemplate.components || [];
      
      const response = await waInvoke('whatsapp-cloud-api', {
        body: {
          action: 'send_template',
          to: normalizedPhone,
          template_name: selectedTemplate.name,
          template_language: selectedTemplate.language,
          variables: Object.keys(variables).length > 0 ? variables : undefined,
          conversation_id: conversationId,
          template_body: templateBody, // Pass template body for proper storage
          template_components: templateComponents, // Pass components for WhatsApp-style rendering
        }
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to send template');
      
      return response.data;
    },
    onSuccess: () => {
      toast.success("Template message sent!");
      onOpenChange(false);
      setSelectedTemplate(null);
      setVariables({});
      onSent();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send template");
    },
  });

  const filteredTemplates = templates.filter((t: Template) =>
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTemplateBodyText = (template: Template) => {
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    return bodyComponent?.text || 'No body text';
  };

  const extractVariables = (template: Template) => {
    // Use the variables array from Meta directly (includes body_1, button_1, etc.)
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
    setSelectedTemplate(null);
    setVariables({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            {selectedTemplate ? 'Send Template' : 'Select Template'}
          </DialogTitle>
        </DialogHeader>

        {!selectedTemplate ? (
          <>
            {/* Search */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Templates List */}
            <ScrollArea className="h-[350px] sm:h-[400px] -mx-6 px-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No templates found</p>
                  <p className="text-xs mt-1">Create templates in Meta Business Manager</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map((template: Template) => (
                    <div
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm break-words flex-1">{template.name}</p>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        </div>
                        <p className="text-sm text-muted-foreground break-words line-clamp-3">
                          {getTemplateBodyText(template)}
                        </p>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="secondary" className="text-xs">{template.language}</Badge>
                          <Badge variant="outline" className="text-xs">{template.category}</Badge>
                          <Badge 
                            variant={template.status?.toLowerCase() === 'approved' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {template.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <>
            {/* Template Preview */}
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-medium">{selectedTemplate.name}</p>
                  <Badge variant="outline" className="text-xs">{selectedTemplate.category}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {getTemplateBodyText(selectedTemplate)}
                </p>
              </div>

              {/* Variables Input */}
              {Object.keys(variables).length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Template Variables</Label>
                  {Object.keys(variables).map((varKey) => (
                    <div key={varKey} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Variable {`{{${varKey}}}`}
                      </Label>
                      <Input
                        placeholder={`Enter value for {{${varKey}}}`}
                        value={variables[varKey]}
                        onChange={(e) => setVariables(prev => ({
                          ...prev,
                          [varKey]: e.target.value
                        }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={() => sendTemplateMutation.mutate()}
                  disabled={sendTemplateMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {sendTemplateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
