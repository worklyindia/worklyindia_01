import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ExternalLink, Phone, MessageSquare, Key } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "OTP";
  text: string;
  url?: string;
  phone_number?: string;
}

interface ButtonBuilderProps {
  buttons: TemplateButton[];
  onChange: (buttons: TemplateButton[]) => void;
  maxButtons?: number;
  category?: string;
}

const BUTTON_TYPES = [
  { value: "QUICK_REPLY", label: "Quick Reply", icon: MessageSquare },
  { value: "URL", label: "Visit Website", icon: ExternalLink },
  { value: "PHONE_NUMBER", label: "Call Phone", icon: Phone },
  { value: "OTP", label: "Copy OTP Code", icon: Key },
];

export function ButtonBuilder({ buttons, onChange, maxButtons = 3, category }: ButtonBuilderProps) {
  const isAuthCategory = category === "authentication";

  const addButton = () => {
    if (buttons.length >= maxButtons) return;
    // For authentication, default to OTP button
    const defaultType = isAuthCategory ? "OTP" : "QUICK_REPLY";
    onChange([...buttons, { type: defaultType, text: isAuthCategory ? "123456" : "" }]);
  };

  const updateButton = (index: number, updates: Partial<TemplateButton>) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], ...updates };
    onChange(newButtons);
  };

  const removeButton = (index: number) => {
    onChange(buttons.filter((_, i) => i !== index));
  };

  const getButtonIcon = (type: string) => {
    const buttonType = BUTTON_TYPES.find(t => t.value === type);
    return buttonType ? buttonType.icon : MessageSquare;
  };

  // Filter button types based on category
  const availableButtonTypes = isAuthCategory 
    ? BUTTON_TYPES.filter(t => t.value === "OTP" || t.value === "URL")
    : BUTTON_TYPES;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Buttons (Optional)</Label>
        <span className="text-xs text-muted-foreground">{buttons.length}/{maxButtons}</span>
      </div>

      {isAuthCategory && (
        <Alert className="py-2">
          <Key className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Authentication templates require a "Copy OTP Code" button. Example code will be used for approval.
          </AlertDescription>
        </Alert>
      )}

      {buttons.length === 0 ? (
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          onClick={addButton}
        >
          <Plus className="h-4 w-4 mr-2" />
          {isAuthCategory ? "Add OTP Button" : "Add Button"}
        </Button>
      ) : (
        <div className="space-y-2">
          {buttons.map((button, index) => {
            const Icon = getButtonIcon(button.type);
            return (
              <Card key={index} className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={button.type}
                    onValueChange={(value) => updateButton(index, { 
                      type: value as TemplateButton["type"],
                      url: undefined,
                      phone_number: undefined,
                      text: value === "OTP" ? "123456" : button.text
                    })}
                  >
                    <SelectTrigger className="flex-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableButtonTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive"
                    onClick={() => removeButton(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {button.type === "OTP" ? (
                  <div className="space-y-1">
                    <Input
                      placeholder="Example OTP (e.g., 123456)"
                      value={button.text}
                      onChange={(e) => updateButton(index, { text: e.target.value })}
                      maxLength={10}
                      className="h-8 font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      This example code is for Meta approval only. Actual OTP will be sent dynamically.
                    </p>
                  </div>
                ) : (
                  <Input
                    placeholder="Button text"
                    value={button.text}
                    onChange={(e) => updateButton(index, { text: e.target.value })}
                    maxLength={25}
                    className="h-8"
                  />
                )}

                {button.type === "URL" && (
                  <Input
                    placeholder="https://example.com/{{1}}"
                    value={button.url || ""}
                    onChange={(e) => updateButton(index, { url: e.target.value })}
                    className="h-8"
                  />
                )}

                {button.type === "PHONE_NUMBER" && (
                  <Input
                    placeholder="+919876543210"
                    value={button.phone_number || ""}
                    onChange={(e) => updateButton(index, { phone_number: e.target.value })}
                    className="h-8"
                  />
                )}
              </Card>
            );
          })}

          {buttons.length < maxButtons && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={addButton}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Button
            </Button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {isAuthCategory 
          ? "Authentication templates: Use OTP button for one-tap code copy."
          : `Max ${maxButtons} buttons. Quick Reply for simple responses, URL for links, Phone for calls.`
        }
      </p>
    </div>
  );
}