import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle, AlertCircle, Wrench, Loader2, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import LottieSearchIcon from "@/components/LottieSearchIcon";

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

export default function PaymentRecoveryPage() {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchPendingTransactions = async () => {
    setLoading(true);
    try {
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
      const { data, error } = await supabase.functions.invoke('recover-payment', {
        body: {
          action: 'check',
          razorpay_order_id: transaction.razorpay_order_id,
          transaction_id: transaction.id
        }
      });

      if (error) throw error;

      toast({
        title: data.status === 'captured' ? '✅ Payment Found!' : 'Payment Status',
        description: data.message || `Status: ${data.status}`,
        variant: data.status === 'captured' ? 'default' : 'destructive'
      });

      if (data.status === 'captured' || data.status === 'already_processed') {
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
      const { data, error } = await supabase.functions.invoke('recover-payment', {
        body: {
          action: 'recover',
          razorpay_order_id: transaction.razorpay_order_id,
          transaction_id: transaction.id
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: '✅ Recovery Successful!',
          description: `${transaction.points} points have been added to user's wallet`,
        });
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

  const filteredTransactions = pendingTransactions.filter(tx => 
    tx.razorpay_order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.points.toString().includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full shrink-0"
              onClick={() => navigate('/owner-portal/points-packages')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-orange-500 shrink-0" />
                <h1 className="text-xl font-bold text-foreground truncate">Payment Recovery</h1>
              </div>
              <p className="text-sm text-muted-foreground">Recover failed payments manually</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchPendingTransactions}
              disabled={loading}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline ml-1">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
          <Input
            placeholder="Search by Order ID, User ID, or Points..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stats */}
        {!loading && (
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <span className="text-muted-foreground">
              {pendingTransactions.length} pending payment(s) need attention
            </span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p className="font-medium text-foreground">No pending payments found!</p>
              <p className="text-sm text-muted-foreground mt-1">All payments are up to date.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => (
              <Card key={tx.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    {/* Top row - Points and Amount */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg font-bold text-foreground">
                            {tx.points} Points
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="font-medium text-foreground">₹{tx.amount}</span>
                          <Badge variant="outline" className="text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-700 text-xs">
                            Pending
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(tx.created_at), 'dd MMMM yyyy, hh:mm a')}
                        </p>
                      </div>
                    </div>

                    {/* Order ID */}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Order:</span>
                        <code className="text-xs bg-background px-2 py-1 rounded break-all">
                          {tx.razorpay_order_id || 'N/A'}
                        </code>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">User:</span>
                        <code className="text-xs bg-background px-2 py-1 rounded">
                          {tx.user_id.slice(0, 12)}...
                        </code>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => checkPaymentStatus(tx)}
                        disabled={checking === tx.id || recovering === tx.id}
                        className="h-8 px-2 text-xs"
                      >
                        {checking === tx.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <span className="mr-1 inline-flex"><LottieSearchIcon size={12} /></span>
                            Check
                          </>
                        )}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => recoverPayment(tx)}
                        disabled={checking === tx.id || recovering === tx.id}
                        className="h-8 px-2 text-xs"
                      >
                        {recovering === tx.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Recover
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
