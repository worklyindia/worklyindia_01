import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { DonationCampaign } from "@/hooks/useDonationCampaign";
import { Loader2, Heart } from "lucide-react";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { useBrandAssets } from "@/hooks/useBrandAssets";

declare global {
  interface Window { Razorpay: any }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const resolveCheckoutLogoUrl = (logoUrl?: string | null) => {
  if (!logoUrl) return undefined;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  if (typeof window === "undefined") return logoUrl;
  return new URL(logoUrl, window.location.origin).toString();
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: DonationCampaign;
}

export default function DonateDialog({ open, onOpenChange, campaign }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const brandAssets = useBrandAssets();
  const checkoutLogoUrl = resolveCheckoutLogoUrl(brandAssets.logo_url);
  const [amount, setAmount] = useState<number>(campaign.suggested_amounts?.[1] ?? 251);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto-fill from logged-in user's profile so they don't have to type anything
  useEffect(() => {
    if (!open) return;
    const pName = (profile as any)?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || "";
    const pEmail = user?.email || (profile as any)?.email || "";
    const pPhone = (profile as any)?.phone || user?.user_metadata?.phone || user?.phone || "";
    if (pName && !name) setName(pName);
    if (pEmail && !email) setEmail(pEmail);
    if (pPhone && !phone) setPhone(pPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id, (profile as any)?.id]);

  const handleDonate = async () => {
    if (!amount || amount < (campaign.min_amount ?? 1)) {
      toast({ title: "Invalid amount", description: `Minimum ₹${campaign.min_amount}`, variant: "destructive" });
      return;
    }
    if (!anonymous && !name.trim()) {
      toast({ title: "Name required", description: "Please enter your name or donate anonymously", variant: "destructive" });
      return;
    }
    const emailTrim = email.trim();
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      toast({ title: "Email required", description: "Please enter a valid email to receive your donation receipt", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Failed to load payment gateway");

      const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
        body: {
          type: "donation",
          campaign_id: campaign.id,
          amount,
          donor_name: name.trim(),
          donor_email: emailTrim,
          donor_phone: phone.trim() || null,
          message: message.trim() || null,
          is_anonymous: anonymous,
        },
      });
      if (error || !data?.order_id) throw new Error(data?.error || error?.message || "Failed to create order");

      const rzp = new window.Razorpay({
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        order_id: data.order_id,
        name: brandAssets.brand_name || BRAND_CONFIG.name,
        description: "Donation for " + (campaign.short_description || "Gau Seva"),
        image: checkoutLogoUrl,
        prefill: {
          name: anonymous ? "Anonymous" : name,
          email,
          contact: phone,
        },
        theme: { color: brandAssets.primary_color || BRAND_CONFIG.firstWordColor },
        handler: async (resp: any) => {
          try {
            const { data: vdata, error: verr } = await supabase.functions.invoke("unified-verify-payment", {
              body: {
                action: "verify-donation",
                donation_id: data.donation_id,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              },
            });
            if (verr || !vdata?.success) throw new Error(vdata?.error || "Verification failed");
            toast({ title: "🙏 Thank you!", description: "Your donation has been received. Gau Mata blesses you." });
            onOpenChange(false);
          } catch (e: any) {
            toast({ title: "Verification failed", description: e.message, variant: "destructive" });
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      rzp.on("payment.failed", (resp: any) => {
        const reason = resp?.error?.description || resp?.error?.reason || "Payment failed";
        toast({ title: "Payment failed", description: reason, variant: "destructive" });
        setLoading(false);
      });

      // Close the donation sheet before opening Razorpay. Radix Sheet focus/scroll locking
      // can otherwise block touches inside Razorpay's mobile checkout iframe.
      onOpenChange(false);
      window.setTimeout(() => rzp.open(), 350);
    } catch (e: any) {
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent fullPage>
        <SheetHeader className="text-left">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          <SheetTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-orange-600 fill-orange-600" />
            {campaign.title}
          </SheetTitle>
          <SheetDescription>Every donation supports Gau Seva 🐄</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label>Choose amount (₹)</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(campaign.suggested_amounts || []).map((a) => (
                <Button
                  key={a}
                  type="button"
                  variant={amount === a ? "default" : "outline"}
                  onClick={() => setAmount(a)}
                  className={amount === a ? "bg-orange-600 hover:bg-orange-700" : ""}
                >
                  ₹{a}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              min={campaign.min_amount}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-2"
              placeholder="Custom amount"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="anon" checked={anonymous} onCheckedChange={(v) => setAnonymous(!!v)} />
            <Label htmlFor="anon" className="cursor-pointer text-sm">Donate anonymously</Label>
          </div>

          {!anonymous && (
            <div>
              <Label>Your Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Email *</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="optional" />
            </div>
          </div>

          <div>
            <Label>Message (optional)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={300} />
          </div>

          <Button
            onClick={handleDonate}
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12 text-base"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Heart className="w-4 h-4 mr-2 fill-white" />}
            Donate ₹{amount} →
          </Button>
          <p className="text-xs text-muted-foreground text-center pb-2">
            Secure payments via Razorpay · UPI · Cards · Net Banking
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
