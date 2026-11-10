import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Fingerprint, Loader2, Save } from "lucide-react";
import { getPasskeyRpId, loadPasskeyRpId } from "@/lib/nativePasskey";

const SETTING_KEY = "passkey_rp_id";

/**
 * Lets an owner/admin change the domain passkeys are registered on, without
 * any code change. Must match "Relying Party ID" in Supabase Auth → Passkeys.
 */
export const PasskeyDomainSettings = () => {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentHost = typeof window !== "undefined" ? window.location.hostname : "";

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", SETTING_KEY)
        .maybeSingle();

      const raw = data?.value as unknown;
      const stored = typeof raw === "string" ? raw : "";
      setValue(stored || getPasskeyRpId());
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    const cleaned = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");

    if (!cleaned || !cleaned.includes(".")) {
      toast.error("Please enter a valid domain, e.g. example.com");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: SETTING_KEY, value: cleaned as unknown as never }, { onConflict: "key" });
    setSaving(false);

    if (error) {
      toast.error("Could not save the passkey domain");
      return;
    }

    try {
      localStorage.removeItem(SETTING_KEY);
    } catch {
      /* ignore */
    }
    await loadPasskeyRpId();
    setValue(cleaned);
    toast.success("Passkey domain saved");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="w-5 h-5" />
          Passkey Domain
        </CardTitle>
        <CardDescription>
          The domain where fingerprint / face login (passkeys) works. Set the same value here and in
          Supabase Auth → Passkeys (Relying Party ID and Origins). No code change is needed when your
          domain changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="passkey-rp-id">Domain</Label>
          <Input
            id="passkey-rp-id"
            value={loading ? "" : value}
            placeholder="example.com"
            onChange={(e) => setValue(e.target.value)}
            disabled={loading || saving}
          />
          <p className="text-xs text-muted-foreground">
            Enter the domain only — no https:// and no trailing slash.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>You are currently on</span>
          <Badge variant="secondary">{currentHost || "unknown"}</Badge>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Passkey Domain
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PasskeyDomainSettings;
