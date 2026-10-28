import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { employerWhatsAppAction, type EmployerWhatsAppAccount } from "./useEmployerWhatsApp";

type Settings = {
  ai_auto_reply: boolean;
  ai_tone: string;
  ai_language: string;
  ai_reply_length: string;
  ai_business_info: string;
  ai_custom_instructions: string;
  ai_signature: string;
};

const fromAccount = (account: EmployerWhatsAppAccount): Settings => ({
  ai_auto_reply: !!account.ai_auto_reply,
  ai_tone: account.ai_tone || "friendly",
  ai_language: account.ai_language || "auto",
  ai_reply_length: account.ai_reply_length || "short",
  ai_business_info: account.ai_business_info || "",
  ai_custom_instructions: account.ai_custom_instructions || "",
  ai_signature: account.ai_signature || "",
});

/** Per-number AI reply controls for employer WhatsApp. */
export default function EmployerWhatsAppAISettings({ account, reload }: { account: EmployerWhatsAppAccount; reload: () => Promise<void> | void }) {
  const [settings, setSettings] = useState(() => fromAccount(account));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSettings(fromAccount(account)); }, [account]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!account.phone_number_id) return;
    setSaving(true);
    try {
      await employerWhatsAppAction({ action: "update_ai_settings", phone_number_id: account.phone_number_id, settings });
      await reload();
      toast.success(`AI settings saved for ${account.display_phone || "this number"}`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base">AI auto reply</CardTitle>
            <CardDescription>{account.display_phone || account.verified_name || "Selected WhatsApp number"}</CardDescription>
          </div>
          <Switch checked={settings.ai_auto_reply} onCheckedChange={(value) => set("ai_auto_reply", value)} aria-label="AI auto reply for this number" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Tone</Label>
            <Select value={settings.ai_tone} onValueChange={(value) => set("ai_tone", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="supportive">Supportive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Select value={settings.ai_language} onValueChange={(value) => set("ai_language", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Same as customer</SelectItem>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Hindi">Hindi</SelectItem>
                <SelectItem value="Hinglish">Hinglish</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reply length</Label>
            <Select value={settings.ai_reply_length} onValueChange={(value) => set("ai_reply_length", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="long">Long</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-business-info">Business information</Label>
          <Textarea id="wa-business-info" rows={5} maxLength={3000} placeholder="Services, prices, opening times, locations and useful links for this number" value={settings.ai_business_info} onChange={(event) => set("ai_business_info", event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-custom-instructions">Reply instructions</Label>
          <Textarea id="wa-custom-instructions" rows={4} maxLength={1500} placeholder="How this number should answer customers" value={settings.ai_custom_instructions} onChange={(event) => set("ai_custom_instructions", event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-signature">Signature (optional)</Label>
          <Input id="wa-signature" maxLength={200} placeholder="Team or agent name" value={settings.ai_signature} onChange={(event) => set("ai_signature", event.target.value)} />
        </div>
        <Button className="w-full" onClick={save} disabled={saving || !account.phone_number_id}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save for this number
        </Button>
      </CardContent>
    </Card>
  );
}