import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AIPricingModule {
  id: string;
  module: string;
  label: string;
  price_kind: 'inr' | 'points' | string;
  ai_enabled: boolean;
  auto_apply: boolean;
  unit_cost_inr: number;
  fixed_cost_inr: number;
  points_value_inr: number;
  tax_percent: number;
  payment_fee_percent: number;
  min_profit_inr: number;
  min_margin_percent: number;
  max_change_percent: number;
  price_floor_inr: number;
  price_ceiling_inr: number;
  free_tier_enabled: boolean;
  free_tier_units: number;
  free_tier_max_cost_inr: number;
  allow_new_plans?: boolean;
  allow_edit_plans?: boolean;
  allow_retire_plans?: boolean;
  max_new_plans_per_run?: number;
  max_plan_edits_per_run?: number;
  max_plan_retires_per_run?: number;
  notes: string | null;
  cost_model?: string | null;
  review_only?: boolean | null;
  usage_assumptions?: Record<string, unknown> | null;
  internal_usage_caps?: Record<string, unknown> | null;
  last_cost_source?: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_source: string | null;
  last_error: string | null;
}

export interface AIPricingCostLine {
  provider: string;
  service: string;
  rate_key: string;
  unit: string;
  unit_price_inr: number;
  units: number;
  cost_inr: number;
  source_url: string;
  source_doc_date: string;
}

export interface AIPricingCostDetails {
  cost_source?: string;
  provider_cost_inr?: number;
  configured_cost_inr?: number;
  cost_used_inr?: number;
  cost_basis?: string;
  error?: string;
  breakdown?: AIPricingCostLine[];
  usage_assumptions?: Record<string, unknown>;
  pricing_sources?: Array<{ provider: string; source_url: string; source_doc_date: string }>;
}

export interface AIPricingAuditDetails {
  units?: number;
  floor_inr?: number;
  dry_run?: boolean;
  review_only?: boolean;
  cost_model?: string;
  cost_error?: string | null;
  cost_details?: AIPricingCostDetails | null;
  tax_percent?: number;
  payment_fee_percent?: number;
  min_profit_inr?: number;
  min_margin_percent?: number;
  price_ceiling_inr?: number;
  [key: string]: unknown;
}

export interface AIPricingAuditRow {
  id: string;
  module: string;
  item_name: string | null;
  price_kind: string;
  old_price: number | null;
  new_price: number | null;
  cost_inr: number | null;
  profit_inr: number | null;
  margin_percent: number | null;
  source: string;
  applied: boolean;
  safe: boolean;
  reason: string | null;
  details: AIPricingAuditDetails | null;
  created_at: string;
}


export const useAIPricingModules = () =>
  useQuery({
    queryKey: ['ai-pricing-modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_pricing_modules')
        .select('*')
        .order('label');
      if (error) throw error;
      return (data ?? []) as unknown as AIPricingModule[];
    },
  });

export const useAIPricingAuditLog = (module?: string) =>
  useQuery({
    queryKey: ['ai-pricing-audit', module ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('ai_pricing_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (module) query = query.eq('module', module);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AIPricingAuditRow[];
    },
  });

export const useUpdateAIPricingModule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AIPricingModule> }) => {
      const { error } = await supabase
        .from('ai_pricing_modules')
        .update(updates as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-pricing-modules'] });
      toast.success('Pricing settings saved');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save settings'),
  });
};

export const useRunAIPricing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ modules, dryRun }: { modules?: string[]; dryRun?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('unified-wallet-api', {
        body: { action: 'ai-price-manager', modules, dry_run: dryRun },
      });
      if (error) throw error;
      return data as { ok: boolean; results: Record<string, any> };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-pricing-modules'] });
      queryClient.invalidateQueries({ queryKey: ['ai-pricing-audit'] });
      const applied = Object.values(data?.results ?? {}).reduce(
        (sum: number, r: any) => sum + (Number(r?.applied) || 0),
        0,
      );
      toast.success(applied > 0 ? `AI pricing run complete — ${applied} price(s) updated` : 'AI pricing run complete — no changes needed');
    },
    onError: (error: Error) => toast.error(error.message || 'AI pricing run failed'),
  });
};
