import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

export type JobPaymentPurpose = "job_posting" | "job_extension" | "interview";

export interface JobPaymentRequest {
  purpose: JobPaymentPurpose;
  job_id?: string;
  months?: number;
  target_status?: "active" | "scheduled";
  interview?: Record<string, unknown>;
  description?: string;
  logoUrl?: string;
  prefill?: { name?: string; email?: string; contact?: string };
}

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const readError = async (error: unknown) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      return body?.error || body?.details || error.message;
    } catch {
      return error.message;
    }
  }
  return (error as Error)?.message || "Payment failed";
};

/** Opens Razorpay checkout and resolves with the server result after verification. */
export async function payWithRazorpay(req: JobPaymentRequest): Promise<{ success: boolean; data?: any; error?: string; cancelled?: boolean }> {
  if (!(await loadRazorpay())) return { success: false, error: "Could not load Razorpay. Check your internet connection." };

  const { description, logoUrl, prefill, ...body } = req;
  const { data: order, error } = await supabase.functions.invoke("create-razorpay-order", {
    body: { type: "job_payment", ...body },
  });
  if (error || !order?.order_id) return { success: false, error: error ? await readError(error) : order?.error || "Could not create order" };

  return new Promise((resolve) => {
    const rzp = new (window as any).Razorpay({
      key: order.key,
      amount: order.amount,
      currency: order.currency,
      order_id: order.order_id,
      ...(order.customer_id ? { customer_id: order.customer_id } : {}),
      name: "Workly India",
      notes: { service: order.label || "service" },
      description: order.label || "Service payment",
      image: logoUrl,
      prefill,
      handler: async (resp: any) => {
        const { data, error: vErr } = await supabase.functions.invoke("unified-verify-payment", {
          body: {
            action: "verify-job-payment",
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          },
        });
        if (vErr || !data?.success) {
          resolve({ success: false, error: vErr ? await readError(vErr) : data?.error || "Payment verification failed" });
          return;
        }
        resolve({ success: true, data: data.data });
      },
      modal: { ondismiss: () => resolve({ success: false, cancelled: true }) },
    });
    rzp.on("payment.failed", (r: any) => resolve({ success: false, error: r?.error?.description || "Payment failed" }));
    rzp.open();
  });
}
