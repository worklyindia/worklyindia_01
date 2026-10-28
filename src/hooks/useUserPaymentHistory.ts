import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PaymentHistoryItem {
  id: string;
  type: 'job_payment' | 'guest_transaction' | 'boost' | 'verification';
  amount: number;
  points?: number;
  status: string;
  description: string;
  created_at: string;
  metadata?: any;
}

export const useUserPaymentHistory = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["userPaymentHistory", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const allPayments: PaymentHistoryItem[] = [];

      // Fetch job payments
      const { data: jobPayments, error: jobError } = await supabase
        .from("job_payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!jobError && jobPayments) {
        allPayments.push(
          ...jobPayments.map((p) => ({
            id: p.id,
            type: 'job_payment' as const,
            amount: 0,
            points: p.points_spent,
            status: 'completed',
            description: p.description,
            created_at: p.created_at,
            metadata: { payment_type: p.payment_type, job_id: p.job_id },
          }))
        );
      }

      // Fetch guest transactions (if user has email match)
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser.user?.email) {
        const { data: guestTxns, error: guestError } = await supabase
          .from("guest_transactions")
          .select("*")
          .eq("email", authUser.user.email)
          .order("created_at", { ascending: false });

        if (!guestError && guestTxns) {
          allPayments.push(
            ...guestTxns.map((t) => ({
              id: t.id,
              type: 'guest_transaction' as const,
              amount: t.amount,
              points: t.points_amount,
              status: t.status,
              description: `Guest purchase - ${t.package_name}`,
              created_at: t.created_at,
              metadata: { 
                razorpay_order_id: t.razorpay_order_id,
                razorpay_payment_id: t.razorpay_payment_id 
              },
            }))
          );
        }
      }

      // Fetch boost payments
      const { data: boosts, error: boostError } = await supabase
        .from("job_boosts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!boostError && boosts) {
        allPayments.push(
          ...boosts.map((b) => ({
            id: b.id,
            type: 'boost' as const,
            amount: b.amount_paid,
            points: 0,
            status: b.status,
            description: 'Job Boost Purchase',
            created_at: b.created_at,
            metadata: { 
              job_id: b.job_id,
              boost_package_id: b.boost_package_id,
              razorpay_order_id: b.razorpay_order_id 
            },
          }))
        );
      }

      // Fetch verification purchases
      const { data: verifications, error: verifyError } = await supabase
        .from("verification_purchases")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!verifyError && verifications) {
        allPayments.push(
          ...verifications.map((v) => ({
            id: v.id,
            type: 'verification' as const,
            amount: v.amount_paid,
            points: 0,
            status: v.status,
            description: 'Verification Purchase',
            created_at: v.created_at,
            metadata: { 
              verification_package_id: v.verification_package_id,
              razorpay_order_id: v.razorpay_order_id 
            },
          }))
        );
      }

      // Sort all payments by date
      return allPayments.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!user,
  });
};
