import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { goBack } from "@/lib/goBack";
import { SITE_CONFIG } from "@/config/siteConfig";
import { supabase } from "@/integrations/supabase/client";

const siteUrl = () => SITE_CONFIG.PRODUCTION_DOMAIN.replace(/\/$/, "");
export const widgetSnippet = (id?: string, position = "right", app: "chat" | "email" = "chat") =>
  `<script src="${siteUrl()}/widget/workly-chat.js" data-widget-id="${id ?? ""}"${app === "email" ? ' data-app="email"' : ""} data-position="${position === "left" ? "left" : "right"}" async></script>`;

async function copy(text: string, ok: string) {
  try { await navigator.clipboard.writeText(text); toast.success(ok); } catch { toast.error("Could not copy"); }
}

export default function DeveloperChatWidget() {
  const navigate = useNavigate();
  const [position, setPosition] = useState("right");
  const [widgetId, setWidgetId] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.functions.invoke("workly-india", { body: { scope: "widget_manage", action: "get" } }).then(({ data }) => {
      if (data?.success) { setWidgetId(data.widget_id); setHasPin(data.has_pin); }
      else toast.error(data?.error || "Could not load widget");
    });
  }, []);

  const savePin = async () => {
    if (!/^\d{6}$/.test(pin)) return toast.error("PIN must be exactly 6 digits");
    setSaving(true);
    const { data } = await supabase.functions.invoke("workly-india", { body: { scope: "widget_manage", action: "set_pin", pin } });
    setSaving(false);
    if (data?.success) { setHasPin(true); setPin(""); toast.success("PIN saved"); } else toast.error(data?.error || "Could not save PIN");
  };

  const snippet = widgetSnippet(widgetId, position);
  const emailSnippet = widgetSnippet(widgetId, position, "email");
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, "/developers")} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="flex-1 text-lg font-semibold">Chat Widget</h1>
        <Button variant="outline" size="sm" onClick={() => navigate("/developers/widget-docs")}>Widget Guide</Button>
      </header>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-12 pt-6 sm:px-6">
        <section className="space-y-3">
          <Label htmlFor="widget-id">Widget ID</Label>
          <Input id="widget-id" value={widgetId || "Loading…"} readOnly className="font-mono" />
          <Button variant="outline" className="h-12 w-full" disabled={!widgetId} onClick={() => copy(widgetId, "Widget ID copied")}><Copy className="mr-2 h-4 w-4" />Copy Widget ID</Button>
        </section>
        <section className="space-y-3">
          <Label>Widget PIN</Label>
          <p className="text-sm text-muted-foreground">{hasPin ? "Your PIN is set. Enter a new 6-digit PIN to update it." : "PIN is not set. The widget will not work until you set a 6-digit PIN."}</p>
          <InputOTP maxLength={6} value={pin} onChange={(v) => setPin(v.replace(/\D/g, ""))} pattern="^[0-9]*$" inputMode="numeric">
            <InputOTPGroup className="w-full justify-between gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="h-12 flex-1 rounded-md border text-lg" />)}
            </InputOTPGroup>
          </InputOTP>
          <Button className="h-12 w-full" onClick={savePin} disabled={saving || !widgetId}>{saving ? "Saving…" : hasPin ? "Update PIN" : "Save PIN"}</Button>
        </section>
        <section className="space-y-3">
          <Label>Position</Label>
          <div className="grid grid-cols-2 gap-3">{["left", "right"].map((p) => <Button key={p} variant={position === p ? "default" : "outline"} onClick={() => setPosition(p)} className="h-12 w-full capitalize">{p}</Button>)}</div>
        </section>
        <section className="space-y-3">
          <Label htmlFor="install-code">Install code Workly Chat</Label>
          <Textarea id="install-code" value={snippet} readOnly rows={4} className="font-mono text-xs" />
          <Button variant="outline" className="h-12 w-full" disabled={!widgetId} onClick={() => copy(snippet, "Workly Chat code copied")}><Copy className="mr-2 h-4 w-4" />Copy code</Button>
        </section>
        <section className="space-y-3">
          <Label htmlFor="install-code-email">Install code Workly Email</Label>
          <Textarea id="install-code-email" value={emailSnippet} readOnly rows={4} className="font-mono text-xs" />
          <Button variant="outline" className="h-12 w-full" disabled={!widgetId} onClick={() => copy(emailSnippet, "Workly Email code copied")}><Copy className="mr-2 h-4 w-4" />Copy code</Button>
        </section>
        <Button className="h-12 w-full" onClick={() => navigate("/developers/subscription")}><CreditCard className="mr-2 h-4 w-4" />Subscription</Button>
      </main>
    </div>
  );
}
