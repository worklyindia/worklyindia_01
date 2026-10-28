import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

/**
 * Webhook events are stored as tokens:
 *   "<group>.*"            every event from every connected account of that group
 *   "<group>.*@<account>"  every event from one account (WhatsApp phone_number_id or mailbox email)
 */
type Group = "whatsapp" | "gmail" | "outlook" | "domain";
type Account = { id: string; label: string };

const GROUPS: { id: Group; label: string; empty: string }[] = [
  { id: "whatsapp", label: "All WhatsApp events", empty: "No WhatsApp number connected yet." },
  { id: "gmail", label: "All Gmail events", empty: "No Gmail account connected yet." },
  { id: "outlook", label: "All Outlook events", empty: "No Outlook account connected yet." },
  { id: "domain", label: "All domain email events", empty: "No domain email connected yet." },
];

const MAIL_TABLES: Record<Exclude<Group, "whatsapp">, string> = {
  gmail: "user_gmail_autoreply_settings",
  outlook: "user_outlook_autoreply_settings",
  domain: "user_custom_email_settings",
};

async function loadAccounts(): Promise<Record<Group, Account[]>> {
  const out: Record<Group, Account[]> = { whatsapp: [], gmail: [], outlook: [], domain: [] };
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return out;

  const { data: wa } = await supabase.from("employer_whatsapp_accounts" as any)
    .select("phone_number_id, display_phone, verified_name").eq("status", "connected");
  out.whatsapp = ((wa as any[]) ?? []).filter((r) => r.phone_number_id).map((r) => ({
    id: String(r.phone_number_id),
    label: [r.display_phone, r.verified_name].filter(Boolean).join(" · ") || String(r.phone_number_id),
  }));

  await Promise.all((Object.keys(MAIL_TABLES) as (keyof typeof MAIL_TABLES)[]).map(async (g) => {
    const { data } = await supabase.from(MAIL_TABLES[g] as any).select("account_id, account_email").eq("user_id", uid);
    const seen = new Set<string>();
    out[g] = ((data as any[]) ?? []).map((r) => String(r.account_email || (String(r.account_id || "").includes("@") ? r.account_id : "")).toLowerCase())
      .filter((e) => e && !seen.has(e) && seen.add(e))
      .map((e) => ({ id: e, label: e }));
  }));
  return out;
}

export function WebhookEventPicker({ value, onChange, idPrefix = "" }: { value: string[]; onChange: (events: string[]) => void; idPrefix?: string }) {
  const [accounts, setAccounts] = useState<Record<Group, Account[]> | null>(null);
  useEffect(() => { void loadAccounts().then(setAccounts).catch(() => setAccounts({ whatsapp: [], gmail: [], outlook: [], domain: [] })); }, []);

  const tokensOf = (g: Group) => value.filter((e) => e === `${g}.*` || e.startsWith(`${g}.*@`));
  const others = (g: Group) => value.filter((e) => !tokensOf(g).includes(e));

  const toggleGroup = (g: Group) => {
    onChange(tokensOf(g).length ? others(g) : [...others(g), `${g}.*`]);
  };

  const toggleAccount = (g: Group, id: string) => {
    const list = accounts?.[g] ?? [];
    const all = value.includes(`${g}.*`);
    const picked = new Set(all ? list.map((a) => a.id) : tokensOf(g).map((t) => t.slice(`${g}.*@`.length)));
    if (picked.has(id)) picked.delete(id); else picked.add(id);
    if (picked.size === 0) return onChange(others(g));
    if (list.length > 0 && list.every((a) => picked.has(a.id))) return onChange([...others(g), `${g}.*`]);
    onChange([...others(g), ...[...picked].map((a) => `${g}.*@${a}`)]);
  };

  return (
    <div className="space-y-3">
      {GROUPS.map((g) => {
        const on = tokensOf(g.id).length > 0;
        const all = value.includes(`${g.id}.*`);
        const list = accounts?.[g.id] ?? [];
        return (
          <div key={g.id} className="rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Checkbox id={`${idPrefix}${g.id}`} checked={on} onCheckedChange={() => toggleGroup(g.id)} />
              <Label htmlFor={`${idPrefix}${g.id}`} className="cursor-pointer font-medium">{g.label}</Label>
            </div>
            {on && (
              <div className="mt-3 space-y-2 border-t border-border pl-6 pt-3">
                {accounts === null ? (
                  <p className="text-sm text-muted-foreground">Loading accounts…</p>
                ) : list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{g.empty} Events from any account you connect later will be sent.</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">Choose which accounts send events to this webhook.</p>
                    {list.map((a) => {
                      const id = `${idPrefix}${g.id}-${a.id}`;
                      return (
                        <div key={a.id} className="flex min-w-0 items-center gap-2">
                          <Checkbox id={id} checked={all || value.includes(`${g.id}.*@${a.id}`)} onCheckedChange={() => toggleAccount(g.id, a.id)} />
                          <Label htmlFor={id} className="min-w-0 cursor-pointer break-all font-normal">{a.label}</Label>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
