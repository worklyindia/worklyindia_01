import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useMonthlySpent = (userId: string) => {
  const [monthlySpent, setMonthlySpent] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMonthlySpent = useCallback(async () => {
    if (!userId) {
      setMonthlySpent(0);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      // Get current month start and end dates (IST timezone)
      const monthStart = new Date(currentYear, currentMonth - 1, 1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthEnd = new Date(currentYear, currentMonth, 0);
      monthEnd.setHours(23, 59, 59, 999);
      
      console.log(`🔄 Calculating monthly spent for ${userId} from ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);
      
      let totalPointsSpent = 0;

      // Fetch job posting payments (Points deduction from wallet)
      const { data: jobPaymentData, error: jobPaymentError } = await supabase
        .from('job_payments')
        .select('points_spent, description, created_at')
        .eq('user_id', userId)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      if (jobPaymentError) {
        console.error('Error fetching job payments:', jobPaymentError);
      } else if (jobPaymentData && jobPaymentData.length > 0) {
        const jobPointsSpent = jobPaymentData.reduce((sum, payment) => sum + payment.points_spent, 0);
        totalPointsSpent += jobPointsSpent;
        console.log(`📊 Job payments this month: ${jobPointsSpent} points from ${jobPaymentData.length} transactions`);
      }

      // Razorpay job payments (₹, 1:1 with old points)
      const { data: pendingData } = await supabase
        .from('pending_payments' as any)
        .select('amount_inr')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());
      totalPointsSpent += ((pendingData as any[]) || []).reduce((sum, p) => sum + Number(p.amount_inr || 0), 0);

      // Note: We're NOT including job_boosts and verification_purchases amounts 
      // because those are money spent (INR), not points spent from wallet
      
      console.log(`✅ Total points spent this month: ${totalPointsSpent}`);
      setMonthlySpent(totalPointsSpent);
    } catch (error) {
      console.error('Error fetching monthly spent:', error);
      setMonthlySpent(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMonthlySpent();
  }, [fetchMonthlySpent]);

  // Realtime updates for monthly spending (only points-based transactions)
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('monthly-spent-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_payments', filter: `user_id=eq.${userId}` },
        () => fetchMonthlySpent()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'points_transactions', filter: `user_id=eq.${userId}` },
        () => fetchMonthlySpent()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchMonthlySpent]);

  const refreshMonthlySpent = useCallback(() => {
    fetchMonthlySpent();
  }, [fetchMonthlySpent]);

  return { monthlySpent, loading, refreshMonthlySpent };
};