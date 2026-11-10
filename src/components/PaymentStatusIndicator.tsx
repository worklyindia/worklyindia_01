import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PaymentStatusProps {
  orderId?: string;
  onStatusUpdate?: (status: string) => void;
}

const PaymentStatusIndicator: React.FC<PaymentStatusProps> = ({ 
  orderId, 
  onStatusUpdate 
}) => {
  const [status, setStatus] = useState<'pending' | 'success' | 'failed' | 'unknown'>('pending');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (orderId && user) {
      checkPaymentStatus();
      // Set up real-time subscription for status updates
      const subscription = supabase
        .channel('payment-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            if (payload.new.razorpay_order_id === orderId) {
              setStatus(payload.new.status as 'pending' | 'success' | 'failed');
              onStatusUpdate?.(payload.new.status);
              setLoading(false);
            }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [orderId, user]);

  const checkPaymentStatus = async () => {
    if (!orderId || !user) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('status')
        .eq('razorpay_order_id', orderId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error checking payment status:', error);
        setStatus('unknown');
      } else {
        setStatus(data.status as 'pending' | 'success' | 'failed');
        onStatusUpdate?.(data.status);
      }
    } catch (error) {
      console.error('Payment status check failed:', error);
      setStatus('unknown');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: 'Processing Payment...',
          color: 'bg-yellow-500/10 text-yellow-600',
          description: 'Your payment is being verified. Please wait.'
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: 'Payment Successful',
          color: 'bg-green-500/10 text-green-600',
          description: 'Your payment has been processed successfully.'
        };
      case 'failed':
        return {
          icon: <XCircle className="w-4 h-4" />,
          text: 'Payment Failed',
          color: 'bg-red-500/10 text-red-600',
          description: 'Your payment could not be processed. Please try again.'
        };
      default:
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: 'Status Unknown',
          color: 'bg-gray-500/10 text-gray-600',
          description: 'Unable to determine payment status.'
        };
    }
  };

  const statusConfig = getStatusConfig();

  if (!orderId) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          {statusConfig.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-sm">{statusConfig.text}</span>
            <Badge className={statusConfig.color}>
              {status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {statusConfig.description}
          </p>
          {orderId && (
            <p className="text-xs text-muted-foreground mt-1">
              Order ID: {orderId.slice(-8)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default PaymentStatusIndicator;