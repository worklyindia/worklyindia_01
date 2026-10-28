import { useCallback, useEffect, useState } from 'react';
import PlatformCard from '@/components/social/PlatformCard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, MapPin, Star, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  useGoogleUserConnections,
} from '@/hooks/useGoogleUserConnections';

const GoogleBusinessLogo = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"
      fill="#4285F4"
    />
    <circle cx="12" cy="9" r="2.6" fill="#fff" />
  </svg>
);

interface GbpAccount {
  name: string;
  accountName?: string;
}

interface GbpLocation {
  name: string;
  title?: string;
}

interface GbpSettings {
  enabled: boolean;
  tone: string;
  language: string;
  reply_length: string;
  max_replies_per_run: number;
  custom_instructions: string;
  signature: string;
  skip_negative: boolean;
}

const DEFAULT_SETTINGS: GbpSettings = {
  enabled: false,
  tone: 'friendly',
  language: 'auto',
  reply_length: 'auto',
  max_replies_per_run: 0,
  custom_instructions: '',
  signature: '',
  skip_negative: false,
};

interface GbpLogItem {
  id: string;
  author_name: string | null;
  comment_text: string | null;
  reply_text: string | null;
  status: string;
  created_at: string;
}

async function callGbpRaw<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('unified-google-api', {
    body: { service: 'user_connect', ...body },
  });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        msg = googleErrorMessage(body) || msg;
      }
    } catch { /* keep generic message */ }
    throw new Error(msg);
  }
  if (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)) {
    throw new Error(googleErrorMessage(data) || String((data as Record<string, unknown>).error));
  }
  return data as T;
}

/** Turns a Google API error body into a short, readable message. */
function googleErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { error?: unknown; details?: unknown; status?: number };
  let detail = '';
  if (typeof b.details === 'string') {
    try {
      const parsed = JSON.parse(b.details) as { error?: { message?: string; status?: string } };
      detail = parsed?.error?.message || '';
    } catch { detail = b.details.slice(0, 200); }
  }
  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(detail)) {
    return 'Google Business Profile API is not enabled in your Google Cloud project. Enable "My Business Account Management API" and "My Business Business Information API", then try again.';
  }
  if (b.status === 429 || /quota|rate/i.test(detail)) {
    return 'Google Business Profile API quota is 0. Request API access from Google (Business Profile API access form), then try again.';
  }
  if (b.status === 403) return detail || 'Google denied access to this Business Profile.';
  return detail || (typeof b.error === 'string' ? b.error : null);
}

/**
 * Google Business Profile connect card with AI review auto-reply.
 * Shown on the AI Connect page and the owner Customer Service page.
 */
export default function GoogleBusinessProfileCard({ enabled, audience }: { enabled: boolean; audience?: 'support' }) {
  const { get, loading, busy, connect, disconnect, configured } =
    useGoogleUserConnections(enabled, audience);
  const callGbp = <T,>(body: Record<string, unknown>) => callGbpRaw<T>(audience ? { ...body, audience } : body);
  const conn = get('business_profile');
  const connected = !!conn && conn.status !== 'needs_reconnect';

  const [locations, setLocations] = useState<GbpLocation[]>([]);
  const [location, setLocation] = useState('');
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [settings, setSettings] = useState<GbpSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<GbpLogItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    if (!connected) return;
    setLocationsLoading(true);
    setLocError(null);
    try {
      const accRes = await callGbp<{ connected?: boolean; data?: { accounts?: GbpAccount[] } }>({
        action: 'gbp_accounts',
      });
      const accounts = accRes?.data?.accounts ?? [];
      const all: GbpLocation[] = [];
      for (const acc of accounts) {
        const locRes = await callGbp<{ data?: { locations?: GbpLocation[] } }>({
          action: 'gbp_locations',
          account: acc.name,
        });
        all.push(...(locRes?.data?.locations ?? []));
      }
      setLocations(all);
      if (all.length === 1) setLocation(all[0].name);
      if (accounts.length === 0) {
        toast.info('No Google Business Profile account found on this Google login.');
      } else if (all.length === 0) {
        toast.info('No business locations found in your Google Business Profile.');
      }
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Could not load business locations');
    } finally {
      setLocationsLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    if (connected) void loadLocations();
  }, [connected, loadLocations]);

  const loadSettings = useCallback(async () => {
    if (!connected || !location) return;
    try {
      const res = await callGbp<{ settings: GbpSettings }>({
        action: 'gbp_autoreply_get',
        accountId: location,
      });
      setSettings({ ...DEFAULT_SETTINGS, ...(res?.settings ?? {}) });
      const logRes = await callGbp<{ items: GbpLogItem[] }>({
        action: 'gbp_autoreply_log',
        limit: 10,
      });
      setLog(logRes?.items ?? []);
    } catch {
      /* keep defaults */
    }
  }, [connected, location]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleConnect = async () => {
    if (!enabled) {
      toast.error('Please log in first to connect Google Business Profile');
      return;
    }
    try {
      await connect('business_profile');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect Google Business Profile');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect('business_profile');
      setLocations([]);
      setLocation('');
      toast.success('Google Business Profile disconnected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not disconnect');
    }
  };

  const handleSave = async () => {
    if (!location) {
      toast.error('Choose a business location first');
      return;
    }
    setSaving(true);
    try {
      await callGbp({
        action: 'gbp_autoreply_save',
        accountId: location,
        settings,
      });
      toast.success('Auto-reply settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async (dryRun: boolean) => {
    if (!location) {
      toast.error('Choose a business location first');
      return;
    }
    setRunning(true);
    try {
      const res = await callGbp<{
        scanned: number;
        replied: number;
        skipped: number;
        items: Array<{ author: string; reply: string; posted: boolean; error?: string }>;
      }>({ action: 'gbp_autoreply_run', location, dryRun });
      if (dryRun) {
        toast.success(`Preview ready: ${res.items.length} reply draft(s) from ${res.scanned} new review(s)`);
      } else {
        toast.success(`Done: ${res.replied} repl${res.replied === 1 ? 'y' : 'ies'} posted, ${res.skipped} skipped`);
        void loadSettings();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Auto-reply run failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <PlatformCard
      name="Google Business Profile"
      connectLabel="Connect Business"
      onSettings={connected ? () => setShowSettings((v) => !v) : undefined}
      description="Connect your Google Business Profile so AI can auto-reply to your customer reviews."
      logo={GoogleBusinessLogo}
      connected={connected}
      connectedLabel="Connected"
      subLabel={connected ? conn?.google_email ?? null : null}
      onConnect={handleConnect}
      onDisconnect={conn ? handleDisconnect : undefined}
      loading={loading || busy === 'business_profile'}
      brandColor="#4285F4"
    >
      {conn?.status === 'needs_reconnect' && (
        <p className="text-[11px] text-destructive">
          Your Google Business Profile authorization expired. Please reconnect.
        </p>
      )}
      {!configured && (
        <p className="text-[11px] text-muted-foreground">
          Google sign-in is not configured yet for this app.
        </p>
      )}

      {connected && showSettings && (
        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Business location</Label>
            {locationsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your locations…
              </div>
            ) : locations.length === 0 ? (
              <div className="space-y-2">
                <p className={`text-[11px] ${locError ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {locError || 'No locations found. Make sure this Google account manages a Business Profile.'}
                </p>
                <Button size="sm" variant="outline" onClick={() => void loadLocations()}>
                  Try again
                </Button>
              </div>
            ) : (
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.name} value={loc.name}>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" /> {loc.title || loc.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {location && (
            <>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="gbp-enabled" className="text-xs">
                  AI auto-reply to new reviews
                </Label>
                <Switch
                  id="gbp-enabled"
                  checked={settings.enabled}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Tone</Label>
                  <Select
                    value={settings.tone}
                    onValueChange={(v) => setSettings((s) => ({ ...s, tone: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="warm">Warm</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Language</Label>
                  <Select
                    value={settings.language}
                    onValueChange={(v) => setSettings((s) => ({ ...s, language: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Same as review</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Hindi">Hindi</SelectItem>
                      <SelectItem value="Hinglish">Hinglish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Custom instructions (optional)</Label>
                <Textarea
                  value={settings.custom_instructions}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, custom_instructions: e.target.value }))
                  }
                  placeholder="e.g. Mention our free resume builder when relevant"
                  className="min-h-[60px] text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Signature (optional)</Label>
                <Input
                  value={settings.signature}
                  onChange={(e) => setSettings((s) => ({ ...s, signature: e.target.value }))}
                  placeholder="e.g. — Team Workly India"
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="gbp-skip-neg" className="text-xs">
                  Skip 1–2 star reviews (reply manually)
                </Label>
                <Switch
                  id="gbp-skip-neg"
                  checked={settings.skip_negative}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, skip_negative: v }))}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Save settings
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRun(true)}
                  disabled={running}
                >
                  {running && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Preview replies
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleRun(false)}
                  disabled={running || !settings.enabled}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Reply now
                </Button>
              </div>

              {log.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Recent AI replies</p>
                  <div className="max-h-56 space-y-2 overflow-y-auto">
                    {log.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-1.5 font-medium">
                          <Star className="h-3 w-3 text-amber-500" />
                          {item.author_name || 'Customer'}
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {item.comment_text && (
                          <p className="mt-1 line-clamp-2 text-muted-foreground">
                            “{item.comment_text}”
                          </p>
                        )}
                        <p className="mt-1 line-clamp-3">{item.reply_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </PlatformCard>
  );
}
