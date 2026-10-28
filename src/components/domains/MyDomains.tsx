import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RefreshCw, Settings2, Globe, ShieldCheck, Search, BellRing } from "lucide-react";
import { callDomainApi } from "@/hooks/useGoDaddy";
import { callDomainMarket } from "@/hooks/useDomainMarket";
import RenewDomainDialog from "./RenewDomainDialog";

export interface OwnedDomain {
  domain: string;
  status?: string;
  expires?: string;
  renewAuto?: boolean;
  privacy?: boolean;
  exposeWhois?: boolean;
  locked?: boolean;
  nameServers?: string[];
}

const statusVariant = (status?: string) => {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return "bg-emerald-600 hover:bg-emerald-600";
  if (s.includes("EXPIR")) return "bg-destructive hover:bg-destructive";
  return "bg-amber-500 hover:bg-amber-500";
};

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
};

const MyDomains = ({ onManage }: { onManage: (domain: OwnedDomain) => void }) => {
  const [domains, setDomains] = useState<OwnedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [savingDomain, setSavingDomain] = useState<string | null>(null);
  const [renewDomain, setRenewDomain] = useState<string | null>(null);

  // ---------- renewal reminder preferences ----------
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const [reminderBusy, setReminderBusy] = useState<string | null>(null);

  const patch = useCallback(
    async (domain: string, body: Record<string, unknown>, patchLocal: Partial<OwnedDomain>, successMsg: string) => {
      setSavingDomain(domain);
      try {
        await callDomainApi("update_domain", { domain, ...body });
        setDomains((prev) => prev.map((d) => (d.domain === domain ? { ...d, ...patchLocal } : d)));
        toast.success(successMsg);
      } catch (e: any) {
        toast.error(e?.message || "Update failed.");
      } finally {
        setSavingDomain(null);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await callDomainApi<{ domains: OwnedDomain[] }>("list_domains");
      setDomains(Array.isArray(res.domains) ? res.domains : []);
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not load your domains.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReminders = useCallback(async () => {
    try {
      const res = await callDomainMarket<{ preferences: { domain: string; renewal_reminders_enabled: boolean | null }[] }>(
        "renewal_reminder_status",
      );
      const map: Record<string, boolean> = {};
      for (const p of res?.preferences ?? []) map[p.domain] = p.renewal_reminders_enabled !== false;
      setReminders(map);
    } catch {
      /* reminders are optional — a failure just hides the toggle state */
    }
  }, []);

  useEffect(() => {
    load();
    loadReminders();
  }, [load, loadReminders]);

  const toggleReminder = async (domain: string, enabled: boolean) => {
    setReminderBusy(domain);
    setReminders((r) => ({ ...r, [domain]: enabled }));
    try {
      await callDomainMarket("set_renewal_reminders", { domain, enabled });
      toast.success(`Renewal reminders ${enabled ? "on" : "off"} for ${domain}.`);
    } catch (e: any) {
      setReminders((r) => ({ ...r, [domain]: !enabled }));
      toast.error(e?.message || "Could not save the reminder preference.");
    } finally {
      setReminderBusy(null);
    }
  };

  const visible = domains.filter((d) => d.domain?.toLowerCase().includes(filter.trim().toLowerCase()));
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (errorMsg) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter your domains"
          className="h-11 pl-9"
        />
      </div>


      {visible.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No domains found in your account.
          </CardContent>
        </Card>
      ) : (
        visible.map((d) => (
          <Card key={d.domain}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-semibold">{d.domain}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <div>
                  <p className="font-medium text-foreground">Expires</p>
                  <p>{formatDate(d.expires)}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Renewal</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-0.5 h-7 gap-1 px-2 text-[11px]"
                    onClick={() => setRenewDomain(d.domain)}
                  >
                    <RefreshCw className="h-3 w-3" /> Renew
                  </Button>
                </div>

                <div>
                  <p className="font-medium text-foreground">Status</p>
                  <Badge className={`${statusVariant(d.status)} mt-0.5 h-5 px-2 text-[10px]`}>
                    {d.status || "UNKNOWN"}
                  </Badge>
                </div>
                <div>
                  <p className="font-medium text-foreground">Privacy</p>
                  <p className="flex items-center gap-1">
                    {d.privacy || d.exposeWhois === false ? (
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    ) : null}
                    {d.privacy || d.exposeWhois === false ? "Protected" : "Not enabled"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs font-medium" htmlFor={`whois-${d.domain}`}>
                    WHOIS privacy
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      Hides your contact details from public WHOIS lookups.
                    </span>
                  </Label>
                  <Switch
                    id={`whois-${d.domain}`}
                    checked={d.privacy === true || d.exposeWhois === false}
                    disabled={savingDomain === d.domain}
                    onCheckedChange={(v) =>
                      patch(
                        d.domain,
                        { exposeWhois: !v },
                        { exposeWhois: !v, privacy: v },
                        `WHOIS privacy ${v ? "enabled" : "disabled"} for ${d.domain}.`,
                      )
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs font-medium" htmlFor={`lock-${d.domain}`}>
                    Transfer lock
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      Blocks unauthorised transfers to another registrar.
                    </span>
                  </Label>
                  <Switch
                    id={`lock-${d.domain}`}
                    checked={d.locked === true}
                    disabled={savingDomain === d.domain}
                    onCheckedChange={(v) =>
                      patch(
                        d.domain,
                        { locked: v },
                        { locked: v },
                        `Transfer lock ${v ? "enabled" : "disabled"} for ${d.domain}.`,
                      )
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label className="flex items-start gap-2 text-xs font-medium" htmlFor={`reminder-${d.domain}`}>
                    <BellRing className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      Renewal reminders
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        Email and in-app alerts before this domain expires.
                      </span>
                    </span>
                  </Label>
                  <Switch
                    id={`reminder-${d.domain}`}
                    checked={reminders[d.domain] !== false}
                    disabled={reminderBusy === d.domain}
                    onCheckedChange={(v) => toggleReminder(d.domain, v)}
                  />
                </div>
              </div>

              <Button className="h-11 w-full sm:w-auto" onClick={() => onManage(d)}>
                <Settings2 className="mr-2 h-4 w-4" /> Manage
              </Button>
            </CardContent>
          </Card>
        ))
      )}

      <RenewDomainDialog
        domain={renewDomain}
        open={renewDomain !== null}
        onOpenChange={(o) => !o && setRenewDomain(null)}
        onRenewed={(dom, newExpiry) =>
          setDomains((prev) => prev.map((x) => (x.domain === dom ? { ...x, expires: newExpiry ?? x.expires } : x)))
        }
      />
    </div>
  );
};

export default MyDomains;
