import { employerScope } from "@/components/employer/whatsapp/selectedNumber";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { CHAT_AUDIENCE } from "@/lib/whatsappAudience";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { validWhatsAppPin } from "@/lib/whatsappSetup";

interface WhatsAppSecuritySettingsProps {
  scope?: "owner" | "employer";
  setup?: boolean;
  registration?: boolean;
  onSaved?: () => void | Promise<void>;
}

export default function WhatsAppSecuritySettings({ scope = "owner", setup = false, registration = false, onSaved }: WhatsAppSecuritySettingsProps) {
  const audience = CHAT_AUDIENCE;
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);

  const updatePin = async () => {
    if (!validWhatsAppPin(pin, confirmation)) { toast.error("Enter a matching six-digit PIN and confirmation."); return; }
    setSaving(true);
    try {
    const action = registration ? "register_number" : "set_pin";
    const { data, error } = await supabase.functions.invoke(scope === "employer" ? "workly-india" : "whatsapp-cloud-api", {
      body: scope === "employer" ? { ...employerScope(), action, pin } : { action, audience, pin },
    });
    if (error) {
      const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
      let message = details;
      try { message = JSON.parse(details).error || details; } catch { /* plain provider error */ }
      throw new Error(message);
    }
    if (!data?.success) throw new Error(data?.error || "Could not complete PIN setup.");
    setPin(""); setConfirmation("");
    toast.success(registration ? "WhatsApp number activated" : "Two-step verification PIN updated");
    await onSaved?.();
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <section className="w-full bg-background">
      <div className="space-y-1 px-4 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 text-base font-semibold"><KeyRound className="h-4 w-4" />Two-step verification</h2>
        <p className="text-sm text-muted-foreground">{setup ? "Keep your PIN safe. It cannot be viewed here, and it is not the SMS verification code." : "Set or change the 6-digit Meta registration PIN. The current PIN cannot be viewed or turned off here."}</p>
      </div>
      <div className="space-y-4 px-4 pb-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="wa-pin">New PIN</Label><Input id="wa-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 digits" /></div>
          <div className="space-y-1.5"><Label htmlFor="wa-pin-confirm">Confirm PIN</Label><Input id="wa-pin-confirm" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Repeat PIN" /></div>
        </div>
        <Button className="w-full" onClick={() => void updatePin()} disabled={saving || !validWhatsAppPin(pin, confirmation)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{registration ? "Activate number and continue" : setup ? "Set PIN and continue" : "Set or change PIN"}</Button>
      </div>
    </section>
  );
}