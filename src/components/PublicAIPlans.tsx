import { Check, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTableRefresh } from "@/hooks/useLiveTableRefresh";
import { BRAND_CONFIG } from "@/config/brandConfig";

export type PublicAIPlan = {
  id: string;
  name: string;
  price_inr: number;
  messages_per_month: number;
  priority_support: boolean;
  features: string[];
};

/** Live list of active AI plans, cheapest first. */
export function usePublicAIPlans() {
  const { data: plans, isLoading, refetch } = useQuery<PublicAIPlan[]>({
    queryKey: ["public-ai-chat-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_chat_plans")
        .select("id, name, price_inr, messages_per_month, priority_support, features")
        .eq("is_active", true)
        .order("price_inr", { ascending: true })
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PublicAIPlan[];
    },
    staleTime: 0,
  });
  useLiveTableRefresh("ai_chat_plans", () => { refetch(); });
  return { plans, isLoading };
}

/**
 * Plan cards shown to visitors. `signupTo` is where the plan button sends people,
 * so each caller can keep its own login/signup destination and redirect.
 */
export function AIPlanCards({ signupTo }: { signupTo: string }) {
  const { plans, isLoading } = usePublicAIPlans();

  return (
    <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3" aria-label="ChatWork AI plans">
      {isLoading && <p className="text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">Loading current plans…</p>}
      {!isLoading && plans?.map((plan) => (
        <Card key={plan.id} className="flex flex-col p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {plan.price_inr === 0 ? "Free" : `₹${plan.price_inr}`}
                {plan.price_inr > 0 && <span className="text-sm font-normal text-muted-foreground"> / month</span>}
              </p>
            </div>
            {plan.priority_support && <Badge variant="outline">Priority support</Badge>}
          </div>

          <div className="mt-5 flex-1 space-y-3">
            {plan.features.map((feature) => (
              <div key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <Button className="mt-6 w-full" asChild>
            <Link to={signupTo}>{plan.price_inr === 0 ? "Create free account" : "Get started"}</Link>
          </Button>
        </Card>
      ))}
      {!isLoading && (!plans || plans.length === 0) && (
        <Card className="p-6 text-center md:col-span-2 lg:col-span-3">
          <p className="text-muted-foreground">Plans are temporarily unavailable.</p>
          <Link to="/contact-us" className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4">
            Contact support
          </Link>
        </Card>
      )}
    </section>
  );
}

/** Payment, refund and legal notes that always sit under the plan cards. */
export function AIPlanNotes() {
  return (
    <>
      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">Payment and billing</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Prices are displayed in Indian rupees. Any applicable taxes, billing period, plan limits, and payment confirmation are shown during checkout. Payments are processed by a secure third-party payment gateway; card and banking details are not stored by {BRAND_CONFIG.name}.
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-foreground">Cancellation and refunds</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Cancelled or activated digital plans are generally non-refundable. If a verified technical issue prevents activation or delivery, contact support promptly; approved refunds are returned to the original payment method within 9–15 working days, subject to the Refund &amp; Cancellation Policy.
          </p>
        </Card>
      </section>

      <nav className="mt-10 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-border/60 pt-6 text-sm" aria-label="ChatWork AI legal links">
        <Link to="/privacy" className="text-primary underline underline-offset-4">Privacy Policy</Link>
        <Link to="/terms-conditions" className="text-primary underline underline-offset-4">Terms &amp; Conditions</Link>
        <Link to="/refund-policy" className="text-primary underline underline-offset-4">Refund &amp; Cancellation</Link>
        <Link to="/contact-us" className="text-primary underline underline-offset-4">Contact Us</Link>
      </nav>
    </>
  );
}
