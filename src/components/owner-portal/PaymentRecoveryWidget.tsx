import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle, AlertCircle, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

interface PendingTransaction {
  id: string;
  user_id: string;
  points: number;
  amount: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  status: string;
}

export default function PaymentRecoveryWidget() {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPendingTransactions = async () => {
    setLoading(true);
    try {
      // Fetch transactions that are pending and older than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('transactions')
        .select('id, user_id, points, amount, razorpay_order_id, razorpay_payment_id, created_at, status')
        .eq('status', 'pending')
        .lt('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingTransactions(data || []);
    } catch (error: any) {
      console.error('Error fetching pending transactions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch pending transactions',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingTransactions();
  }, []);

  const checkPaymentStatus = async (transaction: PendingTransaction) => {
    setChecking(transaction.id);
    try {
      // Call edge function to check Razorpay status
      const { data, error } = await supabase.functions.invoke('recover-payment', {
        body: {
          action: 'check',
          orderId: transaction.razorpay_order_id,
          transactionId: transaction.id
        }
      });

      if (error) throw error;

      toast({
        title: 'Payment Status',
        description: data.message || `Status: ${data.status}`,
      });

      // Refresh list if payment was found
      if (data.status === 'captured') {
        await fetchPendingTransactions();
      }
    } catch (error: any) {
      console.error('Error checking payment status:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to check payment status',
        variant: 'destructive'
      });
    } finally {
      setChecking(null);
    }
  };

  const recoverPayment = async (transaction: PendingTransaction) => {
    setRecovering(transaction.id);
    try {
      // Call edge function to recover payment
      const { data, error } = await supabase.functions.invoke('recover-payment', {
        body: {
          action: 'recover',
          orderId: transaction.razorpay_order_id,
          transactionId: transaction.id,
          userId: transaction.user_id,
          points: transaction.points,
          amount: transaction.amount
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Recovery Successful! ✅',
          description: `${transaction.points} points have been added to user's wallet`,
        });
        // Refresh list
        await fetchPendingTransactions();
      } else {
        toast({
          title: 'Recovery Failed',
          description: data.message || 'Payment could not be recovered',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Error recovering payment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to recover payment',
        variant: 'destructive'
      });
    } finally {
      setRecovering(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-lg">Payment Recovery</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPendingTransactions}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
        <CardDescription>
          Pending payments older than 5 minutes that need manual recovery
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pendingTransactions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
            <p>No pending payments found!</p>
            <p className="text-sm">All payments are up to date.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span>{pendingTransactions.length} pending payment(s) need attention</span>
            </div>
            
            {pendingTransactions.map((tx) => (
              <div 
                key={tx.id} 
                className="border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">
                        {tx.points} Points
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">₹{tx.amount}</span>
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        Pending
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      Order: {tx.razorpay_order_id || 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(tx.created_at), 'dd MMMM yyyy hh:mm a')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      User: {tx.user_id.slice(0, 8)}...
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => checkPaymentStatus(tx)}
                      disabled={checking === tx.id || recovering === tx.id}
                    >
                      {checking === tx.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Check Status'
                      )}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => recoverPayment(tx)}
                      disabled={checking === tx.id || recovering === tx.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {recovering === tx.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Recover Payment'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
