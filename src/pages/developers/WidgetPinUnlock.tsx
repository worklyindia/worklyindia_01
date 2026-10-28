import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const inWidget = typeof window !== "undefined" && window.parent !== window;
const tellWidget = (msg: Record<string, unknown>) => {
  if (inWidget) window.parent.postMessage(msg, "*");
};

export default function WidgetPinUnlock() {
  const { widgetId = "" } = useParams();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  const isEmail = params.get("app") === "email";
  const label = isEmail ? "Workly Email" : "Workly Chat";
  const [status, setStatus] = useState<"loading" | "ok" | "nosub" | "error">("loading");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    tellWidget({ type: "workly-chat:header", show: false });
    return () => tellWidget({ type: "workly-chat:header", show: true });
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error: fnErr } = await supabase.functions.invoke("workly-india", { body: { scope: "widget", action: "status", widget_id: widgetId } });
      let res = data;
      if (fnErr && (fnErr as any).context?.json) res = await (fnErr as any).context.json().catch(() => null);
      if (!res?.success) { setStatusMsg(res?.error || "This widget is not available."); return setStatus("error"); }
      if (!res.subscription_active) { setStatusMsg(res.error || ""); return setStatus("nosub"); }
      setStatus("ok");
    })();
  }, [widgetId]);

  const openSubscription = () => window.open(`${window.location.origin}/developers/subscription`, "_blank", "noopener");

  const verify = async (value: string) => {
    setError("");
    if (!/^\d{6}$/.test(value)) return setError("PIN must be exactly 6 digits.");
    if (busy) return;
    setBusy(true);
    const { data, error: fnErr } = await supabase.functions.invoke("workly-india", { body: { scope: "widget", action: "unlock", widget_id: widgetId, pin: value } });
    let res = data;
    if (fnErr && (fnErr as any).context?.json) res = await (fnErr as any).context.json().catch(() => null);
    if (res?.subscription_required) { setBusy(false); setPin(""); setStatusMsg(res.error); return setStatus("nosub"); }
    if (!res?.success) { setBusy(false); setPin(""); return setError(res?.error || "Incorrect PIN. Please try again."); }
    const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: res.token_hash, type: "magiclink" });
    setBusy(false);
    if (vErr) return setError(`Could not open ${label}. Please try again.`);
    navigate(isEmail ? "/employer/workly-email" : "/employer/workly-chat", { replace: true });
  };

  const onChange = (v: string) => {
    const digits = v.replace(/\D/g, "");
    setPin(digits);
    if (digits.length === 6) verify(digits);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {inWidget && (
        <header className="flex h-14 items-center gap-2 border-b border-border px-2">
          <Button variant="ghost" size="icon" aria-label={`Close ${label}`} onClick={() => tellWidget({ type: "workly-chat:close" })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-base font-semibold">{label}</span>
        </header>
      )}
      <div className="flex flex-1 items-center justify-center px-4">
        {status === "loading" && <p className="text-sm text-muted-foreground">Checking widget…</p>}
        {(status === "nosub" || status === "error") && (
          <div role="alert" className="w-full max-w-sm space-y-4 rounded-xl border border-destructive/40 bg-card p-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
            <h1 className="text-xl font-semibold">{status === "nosub" ? "Subscription required" : "Widget unavailable"}</h1>
            <p className="text-sm text-muted-foreground">
              {status === "nosub"
                ? `${label} is available only with an active API subscription. Please subscribe from your developer account, then reopen this widget.`
                : statusMsg}
            </p>
            {status === "nosub" && <Button className="h-12 w-full" onClick={openSubscription}>View subscription plans</Button>}
          </div>
        )}
        {status === "ok" && <form onSubmit={(e) => { e.preventDefault(); verify(pin); }} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">{label}</h1>
          <p className="text-sm text-muted-foreground">Enter your 6-digit widget PIN {isEmail ? "to open your email inbox." : "to open your chats."}</p>
          <div className="space-y-2">
            <Label>PIN</Label>
            <InputOTP maxLength={6} value={pin} onChange={onChange} pattern="^[0-9]*$" inputMode="numeric" autoFocus disabled={busy}>
              <InputOTPGroup className="w-full justify-between gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="h-12 flex-1 rounded-md border text-lg" />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-12 w-full" disabled={busy}>{busy ? "Checking…" : "Verify PIN"}</Button>
        </form>}
      </div>
    </div>
  );
}
