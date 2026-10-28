import { supabase } from "@/integrations/supabase/client";

export type PaymentEventStatus = "success" | "failed" | "cancelled";

export interface PaymentEventInput {
  status: PaymentEventStatus;
  itemName: string;
  amountInr?: number | null;
  pointsSpent?: number | null;
  pointsAdded?: number | null;
  method?: "razorpay" | "wallet";
  paymentId?: string | null;
  orderId?: string | null;
  reason?: string | null;
  actionUrl?: string;
  transactionType?: string;
}

/**
 * Fire-and-forget: tells the backend to send an instant in-app notification +
 * push for a payment outcome (success / failed / cancelled). Never throws, so a
 * notification problem can never break the payment UI.
 */
export async function reportPaymentEvent(input: PaymentEventInput): Promise<void> {
  try {
    await supabase.functions.invoke("email-api", {
      body: {
        action: "report_payment_event",
        status: input.status,
        item_name: input.itemName,
        amount_inr: input.amountInr ?? null,
        points_spent: input.pointsSpent ?? null,
        points_added: input.pointsAdded ?? null,
        method: input.method ?? "razorpay",
        payment_id: input.paymentId ?? null,
        order_id: input.orderId ?? null,
        reason: input.reason ?? null,
        action_url: input.actionUrl ?? null,
        transaction_type: input.transactionType ?? "purchase",
      },
    });
  } catch (error) {
    console.error("[reportPaymentEvent] failed:", error);
  }
}
