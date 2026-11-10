import { waInvoke } from "@/lib/whatsappAudience";
import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Image, Video, FileText, Type, Eye, Edit } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { RichTextEditor } from "./RichTextEditor";
import { ButtonBuilder, TemplateButton } from "./ButtonBuilder";
import { LanguageSelector } from "./LanguageSelector";

interface Template {
  id: string;
  name: string;
  display_name?: string;
  category: string;
  language: string;
  content_preview: string;
  variables: string[];
  is_active: boolean;
  status: string;
  header_type?: string;
  header_content?: string;
  footer?: string;
  buttons?: TemplateButton[];
  msg91_template_id?: string;
}

interface EditTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
}

const CATEGORIES = [
  { value: "marketing", label: "Marketing", description: "Promotional messages" },
  { value: "utility", label: "Utility", description: "Transactional updates" },
  { value: "authentication", label: "Authentication", description: "OTP & verification" },
  { value: "transactional", label: "Transactional", description: "Order updates" },
];

const HEADER_TYPES = [
  { value: "none", label: "None", icon: null },
  { value: "TEXT", label: "Text", icon: Type },
  { value: "IMAGE", label: "Image", icon: Image },
  { value: "VIDEO", label: "Video", icon: Video },
  { value: "DOCUMENT", label: "Doc", icon: FileText },
];

export function EditTemplateDialog({ open, onOpenChange, template }: EditTemplateDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState("utility");
  const [language, setLanguage] = useState("en");
  const [content, setContent] = useState("");
  const [headerType, setHeaderType] = useState<string>("none");
  const [headerContent, setHeaderContent] = useState("");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [activeTab, setActiveTab] = useState("form");

  const queryClient = useQueryClient();

  useEffect(() => {
    if (template && open) {
      setDisplayName(template.display_name || template.name);
      setCategory(template.category || "utility");
      setLanguage(template.language || "en");
      setContent(template.content_preview || "");
      setHeaderType(template.header_type || "none");
      setHeaderContent(template.header_content || "");
      setFooter(template.footer || "");
      setButtons(template.buttons || []);
      setActiveTab("form");
    }
  }, [template, open]);

  const parseMsg91Error = useCallback((error: string): string => {
    if (!error) return "Template update में विफल";
    
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes("auth") || lowerError.includes("unauthorized") || lowerError.includes("invalid key")) {
      return "Cloud API access token गलत है। कृपया Settings में सही API Key डालें।";
    }
    if (lowerError.includes("phone") || lowerError.includes("number") || lowerError.includes("integrated")) {
      return "WhatsApp Business Number गलत है। Format: 919876543210 (country code के साथ)";
    }
    if (lowerError.includes("duplicate") || lowerError.includes("already exists")) {
      return "इस नाम का Template पहले से मौजूद है।";
    }
    if (lowerError.includes("variable") || lowerError.includes("placeholder")) {
      return "Variables का format गलत है। सही format: {{1}}, {{2}} आदि";
    }
    if (lowerError.includes("button")) {
      return "Button configuration गलत है। कृपया button settings चेक करें।";
    }
    
    return error;
  }, []);

  const updateTemplate = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("No template selected");

      // Check if template has Meta template ID
      if (!template.msg91_template_id) {
        throw new Error("इस template में Meta template ID नहीं है। कृपया पहले Templates को Sync करें।");
      }

      const variables = extractVariables(content);

      const { error: dbError } = await supabase
        .from("whatsapp_templates")
        .update({
          display_name: displayName,
          category,
          language,
          content_preview: content,
          variables,
          header_type: headerType !== "none" ? headerType : null,
          header_content: headerContent || null,
          footer: footer || null,
          buttons: buttons.length > 0 ? JSON.parse(JSON.stringify(buttons)) : null,
        })
        .eq("id", template.id);

      if (dbError) throw dbError;

      // Submit to Meta for re-approval using template_id
      const { data, error } = await waInvoke("whatsapp-cloud-api", {
        body: {
          action: 'edit_template',
          template_id: template.msg91_template_id,
          template_name: template.name,
          category: template.category,
          content,
          header_type: headerType !== "none" ? headerType : null,
          header_content: headerContent || null,
          footer: footer || null,
          buttons: buttons.length > 0 ? buttons : [],
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(parseMsg91Error(data.error));
    },
    onSuccess: () => {
      toast.success("Template submitted for re-approval!");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update template");
    },
  });

  const extractVariables = (text: string): string[] => {
    if (!text) return [];
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables;
  };

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  const handleFooterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFooter(e.target.value);
  }, []);

  const handleHeaderContentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHeaderContent(e.target.value);
  }, []);

  const handleDisplayNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  }, []);

  const isApproved = template?.status === "APPROVED";

  const isAuthTemplate = template?.category?.toLowerCase() === 'authentication';

  // Inline form content JSX to prevent keyboard closing issue
  const formContentJSX = (
    <div className="space-y-4">
      {isAuthTemplate && (
        <Alert className="py-2 border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-xs sm:text-sm">
            Authentication templates have a fixed OTP format. Only security settings can be changed.
          </AlertDescription>
        </Alert>
      )}
      
      {isApproved && !isAuthTemplate && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs sm:text-sm">
            Approved template. Changes will be submitted for re-approval.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm">Template Name</Label>
        <Input
          value={template?.name || ""}
          disabled
          className="font-mono bg-muted h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="editDisplayName" className="text-sm">Display Name</Label>
        <Input
          id="editDisplayName"
          value={displayName}
          onChange={handleDisplayNameChange}
          placeholder="Order Confirmation"
          className="h-9"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Language</Label>
          <LanguageSelector value={language} onChange={setLanguage} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Header (Optional)</Label>
        <div className="grid grid-cols-5 gap-1.5">
          {HEADER_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <Button
                key={type.value}
                type="button"
                variant={headerType === type.value ? "default" : "outline"}
                size="sm"
                className="flex-col h-auto py-1.5 gap-0.5 text-xs"
                onClick={() => {
                  setHeaderType(type.value);
                  if (type.value === "none") setHeaderContent("");
                }}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{type.label}</span>
              </Button>
            );
          })}
        </div>
        {headerType && headerType !== "none" && (
          <Input
            value={headerContent}
            onChange={handleHeaderContentChange}
            placeholder={headerType === "TEXT" ? "Header text..." : "Enter URL..."}
            className="mt-2 h-9"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Message Body *</Label>
        <RichTextEditor
          value={content}
          onChange={handleContentChange}
          placeholder="Hello {{1}}! Your order #{{2}} has been confirmed."
          maxLength={1024}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="editFooter" className="text-sm">Footer (Optional)</Label>
        <Input
          id="editFooter"
          value={footer}
          onChange={handleFooterChange}
          placeholder="Thank you for choosing us!"
          maxLength={60}
          className="h-9"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">Max 60 characters</p>
      </div>

      <ButtonBuilder buttons={buttons} onChange={setButtons} category={category} />
    </div>
  );

  // Inline preview content JSX
  const previewContentJSX = (
    <WhatsAppPreview
      header={headerType !== "none" ? { type: headerType, content: headerContent } : undefined}
      body={content}
      footer={footer}
      buttons={buttons.map(b => ({ type: b.type, text: b.text, url: b.url, phone_number: b.phone_number }))}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] sm:h-auto sm:max-h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-lg">Edit Template</DialogTitle>
          <DialogDescription className="text-sm">
            Update template details. Name cannot be changed.
          </DialogDescription>
        </DialogHeader>

        {/* Mobile: Tabs View */}
        <div className="lg:hidden flex-1 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 mx-4 mt-2 flex-shrink-0" style={{ width: 'calc(100% - 32px)' }}>
              <TabsTrigger value="form" className="gap-2">
                <Edit className="h-4 w-4" />
                Form
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="form" className="flex-1 overflow-y-auto p-4 mt-0" data-state={activeTab === 'form' ? 'active' : 'inactive'}>
              {formContentJSX}
            </TabsContent>
            <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 mt-0" data-state={activeTab === 'preview' ? 'active' : 'inactive'}>
              {previewContentJSX}
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop: Side by Side View */}
        <div className="hidden lg:grid lg:grid-cols-[1fr,300px] flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto">
            {formContentJSX}
          </div>
          <div className="border-l bg-muted/20 p-3 overflow-y-auto">
            {previewContentJSX}
          </div>
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => updateTemplate.mutate()}
            disabled={updateTemplate.isPending || !content}
            size="sm"
          >
            {updateTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for Re-approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
