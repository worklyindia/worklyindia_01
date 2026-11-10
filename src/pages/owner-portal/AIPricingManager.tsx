import { Fragment, useMemo, useState } from 'react';
import { ArrowLeft, Bot, IndianRupee, Play, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  useAIPricingAuditLog,
  useAIPricingModules,
  useRunAIPricing,
  useUpdateAIPricingModule,
  type AIPricingModule,
} from '@/hooks/useAIPricing';

const NUMBER_FIELDS: Array<{ key: keyof AIPricingModule; label: string; hint?: string }> = [
  { key: 'unit_cost_inr', label: 'Cost per unit (₹)', hint: 'Our real cost per point / day / month / minute / message' },
  { key: 'fixed_cost_inr', label: 'Fixed cost per sale (₹)' },
  { key: 'points_value_inr', label: 'Value of 1 point (₹)' },
  { key: 'tax_percent', label: 'GST (%)' },
  { key: 'payment_fee_percent', label: 'Gateway fee (%)' },
  { key: 'min_profit_inr', label: 'Minimum profit (₹)' },
  { key: 'min_margin_percent', label: 'Minimum margin (%)' },
  { key: 'max_change_percent', label: 'Max price change per run (%)' },
  { key: 'price_floor_inr', label: 'Never price below (₹)' },
  { key: 'price_ceiling_inr', label: 'Never price above (₹)' },
  { key: 'free_tier_units', label: 'Free units per user' },
  { key: 'free_tier_max_cost_inr', label: 'Free cost budget (₹)' },
  { key: 'max_new_plans_per_run', label: 'Max new plans per run' },
  { key: 'max_plan_edits_per_run', label: 'Max plan edits per run' },
  { key: 'max_plan_retires_per_run', label: 'Max plans retired per run' },
];

const PLAN_TOGGLES: Array<{ key: keyof AIPricingModule; label: string; hint: string }> = [
  { key: 'allow_new_plans', label: 'AI can create plans', hint: 'Publish new safe, profitable plans' },
  { key: 'allow_edit_plans', label: 'AI can edit plans', hint: 'Rename, change limits, features & price' },
  { key: 'allow_retire_plans', label: 'AI can retire plans', hint: 'Hide dead plans (never deleted)' },
];

function ModuleCard({ mod }: { mod: AIPricingModule }) {
  const update = useUpdateAIPricingModule();
  const run = useRunAIPricing();
  const [draft, setDraft] = useState<Partial<AIPricingModule>>({});

  const value = (key: keyof AIPricingModule) =>
    (draft[key] ?? mod[key]) as number | boolean | string;

  const dirty = Object.keys(draft).length > 0;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              {mod.label}
              <Badge variant="outline">{mod.price_kind === 'points' ? 'Points' : 'INR'}</Badge>
              {mod.ai_enabled
                ? <Badge className="bg-primary/10 text-primary hover:bg-primary/10">AI on</Badge>
                : <Badge variant="secondary">AI off</Badge>}
              {mod.auto_apply && <Badge variant="outline">Auto-apply</Badge>}
              {mod.cost_model === 'provider_api' && (
                <Badge variant="outline">Cost from provider API pricing</Badge>
              )}
              {mod.review_only && <Badge variant="destructive">Review-only (frozen)</Badge>}
            </CardTitle>
            <CardDescription>{mod.notes}</CardDescription>
            {mod.cost_model === 'provider_api' && (
              <p className="mt-1 text-xs text-muted-foreground">
                {mod.last_cost_source ? `Cost source: ${mod.last_cost_source}. ` : ''}
                Internal usage caps used for costing (no quota is treated as infinite):{' '}
                {Object.entries(mod.internal_usage_caps ?? {})
                  .filter(([k]) => k !== 'unlimited_sentinel')
                  .map(([k, v]) => `${k.replace(/_/g, ' ')} = ${String(v)}`)
                  .join(' · ') || 'not configured'}
              </p>
            )}

          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={run.isPending}
            onClick={() => run.mutate({ modules: [mod.module] })}
          >
            {run.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run now
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">AI pricing</p>
              <p className="text-xs text-muted-foreground">Let AI recommend prices</p>
            </div>
            <Switch
              checked={value('ai_enabled') as boolean}
              onCheckedChange={(v) => update.mutate({ id: mod.id, updates: { ai_enabled: v } })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">Auto-apply</p>
              <p className="text-xs text-muted-foreground">Write safe prices live</p>
            </div>
            <Switch
              checked={value('auto_apply') as boolean}
              onCheckedChange={(v) => update.mutate({ id: mod.id, updates: { auto_apply: v } })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">Free tier</p>
              <p className="text-xs text-muted-foreground">Give a safe free allowance</p>
            </div>
            <Switch
              checked={value('free_tier_enabled') as boolean}
              onCheckedChange={(v) => update.mutate({ id: mod.id, updates: { free_tier_enabled: v } })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {PLAN_TOGGLES.map((t) => (
            <div key={String(t.key)} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.hint}</p>
              </div>
              <Switch
                checked={Boolean(value(t.key))}
                onCheckedChange={(v) => update.mutate({ id: mod.id, updates: { [t.key]: v } })}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {NUMBER_FIELDS.map((field) => (
            <div key={String(field.key)} className="space-y-1">
              <Label className="text-xs">{field.label}</Label>
              <Input
                type="number"
                step="0.01"
                value={String(value(field.key) ?? 0)}
                onChange={(e) => setDraft((d) => ({ ...d, [field.key]: Number(e.target.value) }))}
              />
              {field.hint && <p className="text-[11px] text-muted-foreground">{field.hint}</p>}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {mod.last_run_at
              ? `Last run ${new Date(mod.last_run_at).toLocaleString('en-IN')} — ${mod.last_status ?? '—'}${
                mod.last_source ? ` (${mod.last_source})` : ''
              }`
              : 'Never run yet'}
            {mod.last_error ? ` • ${mod.last_error}` : ''}
          </p>
          <div className="flex gap-2">
            {dirty && (
              <Button variant="ghost" size="sm" onClick={() => setDraft({})}>Reset</Button>
            )}
            <Button
              size="sm"
              disabled={!dirty || update.isPending}
              onClick={() => update.mutate({ id: mod.id, updates: draft }, { onSuccess: () => setDraft({}) })}
            >
              Save limits
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AIPricingManager() {
  const navigate = useNavigate();
  const { data: modules = [], isLoading } = useAIPricingModules();
  const { data: auditLog = [] } = useAIPricingAuditLog();
  const runAll = useRunAIPricing();

  const aiOnCount = useMemo(() => modules.filter((m) => m.ai_enabled).length, [modules]);
  const unsafeCount = useMemo(() => auditLog.filter((r) => !r.safe).length, [auditLog]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/10 bg-background/95 backdrop-blur-md">
        <div className="container mx-auto flex flex-wrap items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/owner-portal')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Sparkles className="h-5 w-5 text-primary" /> AI Auto Pricing
            </h1>
            <p className="text-sm text-muted-foreground">
              One control centre for wallet, boost, badge, job posting, renewal, interview and AI plan prices
            </p>
          </div>
          <Button disabled={runAll.isPending} onClick={() => runAll.mutate({})}>
            {runAll.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
            Run AI pricing now
          </Button>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Bot className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{aiOnCount}/{modules.length}</p>
                <p className="text-xs text-muted-foreground">Modules with AI pricing on</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{unsafeCount === 0 ? 'Safe' : `${unsafeCount} flagged`}</p>
                <p className="text-xs text-muted-foreground">Loss protection on the last 100 decisions</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <IndianRupee className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{auditLog.filter((r) => r.applied).length}</p>
                <p className="text-xs text-muted-foreground">Prices applied recently</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          Every price is clamped so that selling price ≥ our cost + GST + gateway fee + minimum profit. If AI is off,
          unreachable or returns something unsafe, the rule engine keeps the last safe price — the platform never sells
          at a loss.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading modules…</p>
        ) : (
          <div className="space-y-5">
            {modules.map((mod) => <ModuleCard key={mod.id} mod={mod} />)}
          </div>
        )}

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent pricing decisions</CardTitle>
            <CardDescription>Latest 100 AI and rule-engine decisions with cost, profit and margin</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {auditLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pricing runs logged yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">Module</th>
                    <th className="py-2 pr-4">Item</th>
                    <th className="py-2 pr-4">Old → New</th>
                    <th className="py-2 pr-4">Cost</th>
                    <th className="py-2 pr-4">Profit</th>
                    <th className="py-2 pr-4">Margin</th>
                    <th className="py-2 pr-4">By</th>
                    <th className="py-2 pr-4">Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((row) => {
                    const details = row.details ?? null;
                    const cost = details?.cost_details ?? null;
                    const lines = cost?.breakdown ?? [];
                    return (
                    <Fragment key={row.id}>
                    <tr className="border-t border-border/40">
                      <td className="py-2 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 pr-4 text-xs">{row.module}</td>
                      <td className="py-2 pr-4">{row.item_name}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {row.old_price} → <span className="font-semibold">{row.new_price}</span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          {row.price_kind === 'points' ? 'pts' : '₹'}
                        </span>
                      </td>
                      <td className="py-2 pr-4">₹{row.cost_inr}</td>
                      <td className="py-2 pr-4">₹{row.profit_inr}</td>
                      <td className="py-2 pr-4">{row.margin_percent}%</td>
                      <td className="py-2 pr-4">
                        <Badge variant={row.source === 'ai' ? 'default' : 'secondary'}>{row.source}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {row.applied ? '✅' : details?.review_only ? '🔒 review-only' : '—'}
                      </td>
                    </tr>
                    {(lines.length > 0 || details?.cost_error) && (
                      <tr className="border-t border-border/20 bg-muted/30">
                        <td colSpan={9} className="px-2 py-3">
                          <details>
                            <summary className="cursor-pointer text-xs font-medium">
                              Cost calculation ({details?.cost_model ?? 'manual'}) — provider → usage → cost → GST → gateway → profit/margin → final price
                            </summary>
                            <div className="mt-2 space-y-2 text-xs">
                              {details?.cost_error && (
                                <p className="text-destructive">
                                  API cost unavailable — price retained (last known-good): {details.cost_error}
                                </p>
                              )}
                              {lines.map((l, i) => (
                                <div key={`${l.rate_key}-${i}`} className="flex flex-wrap gap-x-2">
                                  <span className="font-medium">{l.provider}</span>
                                  <span className="text-muted-foreground">{l.service}</span>
                                  <span>
                                    {l.units} × ₹{l.unit_price_inr}/{l.unit} = ₹{l.cost_inr}
                                  </span>
                                  {l.source_url !== 'internal' && (
                                    <a
                                      href={l.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-primary underline"
                                    >
                                      pricing doc ({l.source_doc_date})
                                    </a>
                                  )}
                                </div>
                              ))}
                              {cost && (
                                <p className="text-muted-foreground">
                                  Provider cost ₹{cost.provider_cost_inr} · configured floor ₹{cost.configured_cost_inr} ·
                                  cost used ₹{cost.cost_used_inr} ({cost.cost_basis})
                                </p>
                              )}
                              <p className="text-muted-foreground">
                                GST {details?.tax_percent}% · gateway {details?.payment_fee_percent}% · min profit ₹
                                {details?.min_profit_inr} · min margin {details?.min_margin_percent}% · safe floor ₹
                                {details?.floor_inr} · affordability ceiling {details?.price_ceiling_inr}
                              </p>
                              {cost?.usage_assumptions && (
                                <p className="text-muted-foreground break-all">
                                  Usage assumptions: {JSON.stringify(cost.usage_assumptions)}
                                </p>
                              )}
                              {row.reason && <p className="text-muted-foreground">Decision: {row.reason}</p>}
                            </div>
                          </details>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}

                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
