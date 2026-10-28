import { useState, useCallback, memo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Info, Image, Video, FileText, Type, Eye, Edit } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { RichTextEditor } from "./RichTextEditor";
import { ButtonBuilder, TemplateButton } from "./ButtonBuilder";
import { LanguageSelector } from "./LanguageSelector";

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  { value: "marketing", label: "Marketing", description: "Promotional messages" },
  { value: "utility", label: "Utility", description: "Transactional updates" },
  { value: "authentication", label: "Authentication", description: "OTP & verification" },
];

const HEADER_TYPES = [
  { value: "none", label: "None", icon: null },
  { value: "TEXT", label: "Text", icon: Type },
  { value: "IMAGE", label: "Image", icon: Image },
  { value: "VIDEO", label: "Video", icon: Video },
  { value: "DOCUMENT", label: "Doc", icon: FileText },
];

interface FormContentProps {
  name: string;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
  headerType: string;
  onHeaderTypeChange: (value: string) => void;
  headerContent: string;
  onHeaderContentChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  content: string;
  onContentChange: (value: string) => void;
  footer: string;
  onFooterChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  buttons: TemplateButton[];
  onButtonsChange: (buttons: TemplateButton[]) => void;
}

// FormContent extracted OUTSIDE main component to prevent re-renders
const FormContent = memo(function FormContent({
  name,
  onNameChange,
  category,
  onCategoryChange,
  language,
  onLanguageChange,
  headerType,
  onHeaderTypeChange,
  headerContent,
  onHeaderContentChange,
  content,
  onContentChange,
  footer,
  onFooterChange,
  buttons,
  onButtonsChange,
}: FormContentProps) {
  return (
    <div className="space-y-4">
      <Alert className="py-2">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs sm:text-sm">
          Templates must be approved by Meta (24-48 hours) before use.
        </AlertDescription>
      </Alert>

      <div className="space-y-1.5">
        <Label htmlFor="create-name" className="text-sm">Template Name *</Label>
        <Input
          id="create-name"
          value={name}
          onChange={onNameChange}
          placeholder="order_confirmation"
          className="font-mono h-9"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and underscores only
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Category *</Label>
          <Select value={category} onValueChange={onCategoryChange}>
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
          <Label className="text-sm">Language *</Label>
          <LanguageSelector value={language} onChange={onLanguageChange} />
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
                onClick={() => onHeaderTypeChange(type.value)}
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
            onChange={onHeaderContentChange}
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
          onChange={onContentChange}
          placeholder="Hello {{1}}! Your order #{{2}} has been confirmed."
          maxLength={1024}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="create-footer" className="text-sm">Footer (Optional)</Label>
        <Input
          id="create-footer"
          value={footer}
          onChange={onFooterChange}
          placeholder="Thank you for choosing us!"
          maxLength={60}
          className="h-9"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">Max 60 characters</p>
      </div>

      <ButtonBuilder buttons={buttons} onChange={onButtonsChange} category={category} />
    </div>
  );
});

export function CreateTemplateDialog({ open, onOpenChange }: CreateTemplateDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("utility");
  const [language, setLanguage] = useState("en");
  const [content, setContent] = useState("");
  const [headerType, setHeaderType] = useState<string>("none");
  const [headerContent, setHeaderContent] = useState("");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [activeTab, setActiveTab] = useState("form");

  const queryClient = useQueryClient();

  const createTemplate = useMutation({
    mutationFn: async () => {
      const formattedButtons = buttons.map(btn => {
        if (btn.type === "URL") {
          return { type: "URL", text: btn.text, url: btn.url };
        } else if (btn.type === "PHONE_NUMBER") {
          return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phone_number };
        } else if (btn.type === "QUICK_REPLY") {
          return { type: "QUICK_REPLY", text: btn.text };
        } else if (btn.type === "OTP") {
          return { type: "COPY_CODE", example: btn.text || "123456" };
        }
        return btn;
      });

      // Use create-auto-templates with create_single action
      const { data, error } = await supabase.functions.invoke("create-auto-templates", {
        body: {
          action: "create_single",
          template: {
            name,
            category: category.toUpperCase(),
            content: content,
            header: headerType !== "none" ? { type: headerType, text: headerContent } : null,
            footer: footer || null,
            buttons: formattedButtons,
            variables: extractVariables(content),
          },
          language,
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error("सर्वर से कनेक्ट नहीं हो पाया। कृपया बाद में पुनः प्रयास करें।");
      }
      
      if (!data.success) {
        const errorMsg = parseMsg91Error(data.error);
        throw new Error(errorMsg);
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Template submitted for approval!");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Template बनाने में विफल");
    },
  });

  const parseMsg91Error = (error: string): string => {
    if (!error) return "Template बनाने में विफल";
    
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes("auth") || lowerError.includes("unauthorized") || lowerError.includes("invalid key")) {
      return "Cloud API access token गलत है। कृपया Settings में सही API Key डालें।";
    }
    if (lowerError.includes("phone") || lowerError.includes("number") || lowerError.includes("integrated")) {
      return "WhatsApp Business Number गलत है। Format: 919876543210 (country code के साथ)";
    }
    if (lowerError.includes("duplicate") || lowerError.includes("already exists")) {
      return "इस नाम का Template पहले से मौजूद है। कृपया दूसरा नाम चुनें।";
    }
    if (lowerError.includes("variable") || lowerError.includes("placeholder")) {
      return "Variables का format गलत है। सही format: {{1}}, {{2}} आदि";
    }
    if (lowerError.includes("button")) {
      return "Button configuration गलत है। कृपया button settings चेक करें।";
    }
    if (lowerError.includes("category")) {
      return "Category चुनने में error। कृपया Marketing, Utility या Authentication चुनें।";
    }
    
    return error;
  };

  // Extract variables from template text
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

  const resetForm = () => {
    setName("");
    setCategory("utility");
    setLanguage("en");
    setContent("");
    setHeaderType("none");
    setHeaderContent("");
    setFooter("");
    setButtons([]);
    setActiveTab("form");
  };

  // Stable handlers using useCallback
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    setName(formatted);
  }, []);

  const handleCategoryChange = useCallback((value: string) => setCategory(value), []);
  const handleLanguageChange = useCallback((value: string) => setLanguage(value), []);
  const handleHeaderTypeChange = useCallback((value: string) => {
    setHeaderType(value);
    if (value === "none") setHeaderContent("");
  }, []);
  const handleHeaderContentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setHeaderContent(e.target.value), []);
  const handleContentChange = useCallback((value: string) => setContent(value), []);
  const handleFooterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFooter(e.target.value), []);
  const handleButtonsChange = useCallback((newButtons: TemplateButton[]) => setButtons(newButtons), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-lg">Create WhatsApp Template</DialogTitle>
          <DialogDescription className="text-sm">
            Create a new template for WhatsApp Cloud API
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
              <FormContent
                name={name}
                onNameChange={handleNameChange}
                category={category}
                onCategoryChange={handleCategoryChange}
                language={language}
                onLanguageChange={handleLanguageChange}
                headerType={headerType}
                onHeaderTypeChange={handleHeaderTypeChange}
                headerContent={headerContent}
                onHeaderContentChange={handleHeaderContentChange}
                content={content}
                onContentChange={handleContentChange}
                footer={footer}
                onFooterChange={handleFooterChange}
                buttons={buttons}
                onButtonsChange={handleButtonsChange}
              />
            </TabsContent>
            <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 mt-0" data-state={activeTab === 'preview' ? 'active' : 'inactive'}>
              <WhatsAppPreview
                header={headerType !== "none" ? { type: headerType, content: headerContent } : undefined}
                body={content}
                footer={footer}
                buttons={buttons.map(b => ({ type: b.type, text: b.text, url: b.url, phone_number: b.phone_number }))}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop: Side by Side View */}
        <div className="hidden lg:grid lg:grid-cols-[1fr,300px] flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto">
            <FormContent
              name={name}
              onNameChange={handleNameChange}
              category={category}
              onCategoryChange={handleCategoryChange}
              language={language}
              onLanguageChange={handleLanguageChange}
              headerType={headerType}
              onHeaderTypeChange={handleHeaderTypeChange}
              headerContent={headerContent}
              onHeaderContentChange={handleHeaderContentChange}
              content={content}
              onContentChange={handleContentChange}
              footer={footer}
              onFooterChange={handleFooterChange}
              buttons={buttons}
              onButtonsChange={handleButtonsChange}
            />
          </div>
          <div className="border-l bg-muted/20 p-3 overflow-y-auto">
            <WhatsAppPreview
              header={headerType !== "none" ? { type: headerType, content: headerContent } : undefined}
              body={content}
              footer={footer}
              buttons={buttons.map(b => ({ type: b.type, text: b.text, url: b.url, phone_number: b.phone_number }))}
            />
          </div>
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => createTemplate.mutate()}
            disabled={!name || !content || createTemplate.isPending}
            size="sm"
          >
            {createTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
