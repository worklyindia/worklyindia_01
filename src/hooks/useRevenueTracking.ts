import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TimeRange = 'today' | '7d' | '30d' | '3m' | '6m' | '1y';

interface RevenueData {
  totalPointsRevenue: number;
  totalBoostRevenue: number;
  totalVerificationRevenue: number;
  totalReferralCommission: number;
  totalCompetitionPrizes: number;
  netRevenue: number;
  previousPeriodRevenue: number;
  percentageChange: number;
  transactionsCount: number;
  boostsCount: number;
  verificationsCount: number;
  competitionPrizesCount: number;
}

export const useRevenueTracking = (timeRange: TimeRange = '30d') => {
  const [revenue, setRevenue] = useState<RevenueData>({
    totalPointsRevenue: 0,
    totalBoostRevenue: 0,
    totalVerificationRevenue: 0,
    totalReferralCommission: 0,
    totalCompetitionPrizes: 0,
    netRevenue: 0,
    previousPeriodRevenue: 0,
    percentageChange: 0,
    transactionsCount: 0,
    boostsCount: 0,
    verificationsCount: 0,
    competitionPrizesCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const getDateRange = (range: TimeRange) => {
    const now = new Date();
    const startDate = new Date();
    
    switch (range) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '3m':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return { startDate: startDate.toISOString(), endDate: now.toISOString() };
  };

  const getPreviousDateRange = (range: TimeRange) => {
    const { startDate, endDate } = getDateRange(range);
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = end.getTime() - start.getTime();
    
    const prevEnd = new Date(start.getTime());
    const prevStart = new Date(start.getTime() - duration);
    
    return { 
      startDate: prevStart.toISOString(), 
      endDate: prevEnd.toISOString() 
    };
  };

  const fetchRevenue = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange(timeRange);
      const prevRange = getPreviousDateRange(timeRange);

      // Fetch points revenue (transactions)
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('status', 'success')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (transError) throw transError;

      // Fetch boost revenue
      const { data: boosts, error: boostError } = await supabase
        .from('job_boosts')
        .select('amount_paid')
        .in('status', ['paid', 'completed', 'active'])
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (boostError) throw boostError;

      // Fetch verification revenue
      const { data: verifications, error: verError } = await supabase
        .from('verification_purchases')
        .select('amount_paid')
        .in('status', ['paid', 'completed', 'active'])
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (verError) throw verError;

      // Fetch referral commissions
      const { data: commissions, error: commError } = await supabase
        .from('referral_commissions')
        .select('commission_amount, source_type')
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (commError) throw commError;

      // Fetch competition prizes
      const { data: prizes, error: prizesError } = await supabase
        .from('competition_prize_payments')
        .select('prize_amount')
        .eq('status', 'credited')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (prizesError) throw prizesError;

      // Calculate totals
      const totalPointsRevenue = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
      const totalBoostRevenue = boosts?.reduce((sum, b) => sum + (b.amount_paid || 0), 0) || 0;
      const totalVerificationRevenue = verifications?.reduce((sum, v) => sum + (v.amount_paid || 0), 0) || 0;
      
      // Only count referral commissions (exclude competition prizes from this count)
      const totalReferralCommission = commissions?.reduce((sum, c) => {
        if (c.source_type === 'competition_prize') return sum;
        const amount = Number(c.commission_amount) || 0;
        return amount > 0 ? sum + amount : sum;
      }, 0) || 0;

      // Calculate competition prizes paid out
      const totalCompetitionPrizes = prizes?.reduce((sum, p) => sum + Number(p.prize_amount || 0), 0) || 0;
      
      const grossRevenue = totalPointsRevenue + totalBoostRevenue + totalVerificationRevenue;
      const totalDeductions = totalReferralCommission + totalCompetitionPrizes;
      const netRevenue = grossRevenue - totalDeductions;

      // Fetch previous period for comparison
      const { data: prevTransactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('status', 'success')
        .gte('created_at', prevRange.startDate)
        .lte('created_at', prevRange.endDate);

      const { data: prevBoosts } = await supabase
        .from('job_boosts')
        .select('amount_paid')
        .in('status', ['paid', 'completed', 'active'])
        .gte('created_at', prevRange.startDate)
        .lte('created_at', prevRange.endDate);

      const { data: prevVerifications } = await supabase
        .from('verification_purchases')
        .select('amount_paid')
        .in('status', ['paid', 'completed', 'active'])
        .gte('created_at', prevRange.startDate)
        .lte('created_at', prevRange.endDate);

      const prevPointsRevenue = prevTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
      const prevBoostRevenue = prevBoosts?.reduce((sum, b) => sum + (b.amount_paid || 0), 0) || 0;
      const prevVerificationRevenue = prevVerifications?.reduce((sum, v) => sum + (v.amount_paid || 0), 0) || 0;
      const previousPeriodRevenue = prevPointsRevenue + prevBoostRevenue + prevVerificationRevenue;

      const percentageChange = previousPeriodRevenue > 0 
        ? ((grossRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100 
        : 0;

      setRevenue({
        totalPointsRevenue,
        totalBoostRevenue,
        totalVerificationRevenue,
        totalReferralCommission,
        totalCompetitionPrizes,
        netRevenue,
        previousPeriodRevenue,
        percentageChange,
        transactionsCount: transactions?.length || 0,
        boostsCount: boosts?.length || 0,
        verificationsCount: verifications?.length || 0,
        competitionPrizesCount: prizes?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching revenue:', error);
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue();

    // Set up real-time subscriptions
    const channel = supabase
      .channel('revenue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchRevenue)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_boosts' }, fetchRevenue)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_purchases' }, fetchRevenue)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referral_commissions' }, fetchRevenue)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_prize_payments' }, fetchRevenue)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [timeRange]);

  return { revenue, loading, refetch: fetchRevenue };
};
