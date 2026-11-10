import { employerScope } from "@/components/employer/whatsapp/selectedNumber";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { CHAT_AUDIENCE } from "@/lib/whatsappAudience";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
type Weekly = { day_of_week: string; open_time: string; close_time: string };
type Holiday = { date: string; start_time: string; end_time: string };

const toInput = (v: string) => (/^\d{4}$/.test(v) ? `${v.slice(0, 2)}:${v.slice(2)}` : "09:00");
const fromInput = (v: string) => v.replace(":", "");

interface WhatsAppCallingSettingsProps {
  scope?: "owner" | "employer";
}

export default function WhatsAppCallingSettings({ scope = "owner" }: WhatsAppCallingSettingsProps) {
  const audience = CHAT_AUDIENCE;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [iconVisible, setIconVisible] = useState(true);
  const [callback, setCallback] = useState(false);
  const [countries, setCountries] = useState("");
  const [hoursOn, setHoursOn] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [weekly, setWeekly] = useState<Weekly[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [pcma, setPcma] = useState(false);
  const [pcmu, setPcmu] = useState(false);
  const [sipStatus, setSipStatus] = useState<string | null>(null);

  const invokeCallingAction = useCallback((body: Record<string, unknown>) =>
    supabase.functions.invoke(scope === "employer" ? "workly-india" : "whatsapp-cloud-api", {
      body: scope === "employer" ? { ...employerScope(), ...body } : { audience, ...body },
    }), [audience, scope]);

  const apply = (c: any) => {
    setEnabled(c?.status === "ENABLED");
    setIconVisible(c?.call_icon_visibility !== "DISABLE_ALL");
    setCallback(c?.callback_permission_status === "ENABLED");
    setCountries((c?.call_icons?.restrict_to_user_countries || []).join(", "));
    setHoursOn(c?.call_hours?.status === "ENABLED");
    setTimezone(c?.call_hours?.timezone_id || "Asia/Kolkata");
    setWeekly(c?.call_hours?.weekly_operating_hours || []);
    setHolidays(c?.call_hours?.holiday_schedule || []);
    const codecs: string[] = c?.audio?.additional_codecs || [];
    setPcma(codecs.includes("PCMA")); setPcmu(codecs.includes("PCMU"));
    setSipStatus(c?.sip?.status || null);
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await invokeCallingAction({ action: "get_calling_settings" });
    setLoading(false);
    if (error || !data?.success) { setError(data?.error || error?.message || "Could not load calling settings."); return; }
    apply(data.calling || {});
  }, [invokeCallingAction]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const list = countries.split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (list.some((c) => !/^[A-Z]{2}$/.test(c))) { toast.error("Use two-letter country codes, e.g. IN, US."); return; }
    if (hoursOn && !timezone.trim()) { toast.error("Timezone is required for call hours."); return; }
    if (weekly.some((w) => w.open_time >= w.close_time)) { toast.error("Closing time must be after opening time."); return; }
    if (holidays.some((h) => !h.date || h.start_time >= h.end_time)) { toast.error("Check holiday dates and times."); return; }
    setSaving(true);
    const calling = {
      status: enabled ? "ENABLED" : "DISABLED",
      call_icon_visibility: iconVisible ? "DEFAULT" : "DISABLE_ALL",
      callback_permission_status: callback ? "ENABLED" : "DISABLED",
      call_icons: { restrict_to_user_countries: list },
      call_hours: { status: hoursOn ? "ENABLED" : "DISABLED", timezone_id: timezone.trim(), weekly_operating_hours: weekly, holiday_schedule: holidays },
      audio: { additional_codecs: [pcma && "PCMA", pcmu && "PCMU"].filter(Boolean) },
    };
    const { data, error } = await invokeCallingAction({ action: "update_calling_settings", calling });
    setSaving(false);
    if (error || !data?.success) { toast.error(data?.error || error?.message || "Meta rejected the calling settings."); return; }
    apply(data.calling || calling);
    toast.success("Calling settings saved. Meta may take time to apply them on phones.");
  };

  const row = (label: string, hint: string, checked: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{hint}</p></div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );

  return (
    <section className="w-full bg-background">
      <div className="space-y-1 px-4 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 text-base font-semibold"><Phone className="h-4 w-4" />Calling</h2>
        <p className="text-sm text-muted-foreground">Turning calling on needs a messaging limit of at least 2,000 customers per day.</p>
      </div>
      <div className="space-y-5 px-4 pb-6 sm:px-6">
        <fieldset disabled={loading || saving} className="space-y-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading calling settings…
            </div>
          )}
          {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {row("Calling", "Allow customers to call this number on WhatsApp", enabled, setEnabled)}
            {row("Show call button", "Show the call icon in customers' chats", iconVisible, setIconVisible)}
            {row("Callback permission", "Ask customers for permission to call them back", callback, setCallback)}

            <div className="space-y-1.5">
              <Label htmlFor="wa-call-countries">Show call button only in these countries</Label>
              <Input id="wa-call-countries" value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="Empty = all countries, e.g. IN, AE" />
            </div>

            <div className="space-y-3 border-y border-border py-4">
              {row("Call hours", "Accept calls only during set hours", hoursOn, setHoursOn)}
              {hoursOn && (
                <>
                  <div className="space-y-1.5"><Label htmlFor="wa-tz">Timezone</Label><Input id="wa-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Kolkata" /></div>
                  {weekly.map((w, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={w.day_of_week} onChange={(e) => setWeekly(weekly.map((x, j) => j === i ? { ...x, day_of_week: e.target.value } : x))}>
                        {DAYS.map((d) => <option key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</option>)}
                      </select>
                      <Input type="time" className="w-28" value={toInput(w.open_time)} onChange={(e) => setWeekly(weekly.map((x, j) => j === i ? { ...x, open_time: fromInput(e.target.value) } : x))} />
                      <Input type="time" className="w-28" value={toInput(w.close_time)} onChange={(e) => setWeekly(weekly.map((x, j) => j === i ? { ...x, close_time: fromInput(e.target.value) } : x))} />
                      <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setWeekly(weekly.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" disabled={weekly.length >= 14} onClick={() => setWeekly([...weekly, { day_of_week: "MONDAY", open_time: "0900", close_time: "1800" }])}><Plus className="mr-1 h-4 w-4" />Add weekly hours</Button>
                  {holidays.map((h, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <Input type="date" className="w-40" value={h.date} onChange={(e) => setHolidays(holidays.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                      <Input type="time" className="w-28" value={toInput(h.start_time)} onChange={(e) => setHolidays(holidays.map((x, j) => j === i ? { ...x, start_time: fromInput(e.target.value) } : x))} />
                      <Input type="time" className="w-28" value={toInput(h.end_time)} onChange={(e) => setHolidays(holidays.map((x, j) => j === i ? { ...x, end_time: fromInput(e.target.value) } : x))} />
                      <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setHolidays(holidays.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" disabled={holidays.length >= 50} onClick={() => setHolidays([...holidays, { date: "", start_time: "0000", end_time: "2359" }])}><Plus className="mr-1 h-4 w-4" />Add holiday closure</Button>
                </>
              )}
            </div>

            <div className="space-y-3 border-y border-border py-4">
              <p className="text-sm font-medium">Extra audio formats</p>
              {row("PCMA", "Additional call audio format", pcma, setPcma)}
              {row("PCMU", "Additional call audio format", pcmu, setPcmu)}
            </div>

            {sipStatus && <p className="text-xs text-muted-foreground">SIP: {sipStatus} (view only)</p>}

            <Button className="w-full" onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save calling settings</Button>
        </fieldset>
      </div>
    </section>
  );
}
