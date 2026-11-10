import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NotificationService } from '@/services/NotificationService';

export interface PaymentStatus {
  id: string;
  status: 'pending' | 'success' | 'failed';
  amount: number;
  points: number;
  created_at: string;
  updated_at: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
}

export const usePaymentTracking = () => {
  const [recentPayments, setRecentPayments] = useState<PaymentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchRecentPayments = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentPayments((data || []).map(payment => ({
        ...payment,
        status: payment.status as 'pending' | 'success' | 'failed'
      })));
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRecentPayments();

    // Set up real-time subscription
    if (user) {
      const subscription = supabase
        .channel('user-payments')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setRecentPayments(prev => [{...payload.new, status: payload.new.status as 'pending' | 'success' | 'failed'} as PaymentStatus, ...prev.slice(0, 9)]);
            } else if (payload.eventType === 'UPDATE') {
              setRecentPayments(prev => 
                prev.map(payment => 
                  payment.id === payload.new.id ? 
                  {...payload.new, status: payload.new.status as 'pending' | 'success' | 'failed'} as PaymentStatus : 
                  payment
                )
              );
              
              // Show toast for successful payments
              if (payload.new.status === 'success' && payload.old.status === 'pending') {
                toast.success(`✅ Payment successful! ${payload.new.points} points added to your wallet`);
                
                // Send push notification
                NotificationService.sendPaymentSuccessNotification(payload.new.points);
              }
            }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user, fetchRecentPayments]);

  const getPaymentStats = useCallback(() => {
    const totalPaid = recentPayments
      .filter(p => p.status === 'success')
      .reduce((sum, p) => sum + p.amount, 0);
    
    const totalPoints = recentPayments
      .filter(p => p.status === 'success')
      .reduce((sum, p) => sum + p.points, 0);
    
    const pendingPayments = recentPayments.filter(p => p.status === 'pending').length;
    const failedPayments = recentPayments.filter(p => p.status === 'failed').length;

    return {
      totalPaid,
      totalPoints,
      pendingPayments,
      failedPayments,
      successRate: recentPayments.length > 0 
        ? ((recentPayments.length - failedPayments) / recentPayments.length * 100).toFixed(1)
        : '100'
    };
  }, [recentPayments]);

  return {
    recentPayments,
    loading,
    refetch: fetchRecentPayments,
    stats: getPaymentStats()
  };
};