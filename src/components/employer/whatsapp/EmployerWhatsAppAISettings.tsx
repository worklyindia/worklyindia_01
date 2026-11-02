import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { employerWhatsAppAction, type EmployerWhatsAppAccount } from "./useEmployerWhatsApp";

/** Per-number AI auto-reply switch. Business details, tone and signature live in the AI identity form below. */
export default function EmployerWhatsAppAISettings({ account, reload }: { account: EmployerWhatsAppAccount; reload: () => Promise<void> | void }) {
  const [enabled, setEnabled] = useState(!!account.ai_auto_reply);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setEnabled(!!account.ai_auto_reply); }, [account]);

  const toggle = async (value: boolean) => {
    if (!account.phone_number_id) return;
    setEnabled(value);
    setSaving(true);
    try {
      await employerWhatsAppAction({
        action: "update_ai_settings",
        phone_number_id: account.phone_number_id,
        settings: {
          ai_auto_reply: value,
          ai_tone: account.ai_tone || "friendly",
          ai_language: account.ai_language || "auto",
          ai_reply_length: account.ai_reply_length || "short",
          ai_business_info: account.ai_business_info || "",
          ai_custom_instructions: account.ai_custom_instructions || "",
          ai_signature: account.ai_signature || "",
        },
      });
      await reload();
      toast.success(value ? "AI auto reply is on" : "AI auto reply is off");
    } catch (error) {
      setEnabled(!value);
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base">AI auto reply</CardTitle>
            <CardDescription>{account.display_phone || account.verified_name || "Selected WhatsApp number"}</CardDescription>
          </div>
          {saving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
            <Switch checked={enabled} onCheckedChange={toggle} disabled={!account.phone_number_id} aria-label="AI auto reply for this number" />
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
