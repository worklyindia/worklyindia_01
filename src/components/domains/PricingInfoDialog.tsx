import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/hooks/useDomainMarket";

interface PricingInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain?: string;
  price?: number;
  renewalPrice?: number | null;
  isPromo?: boolean;
  currency?: string;
}

/**
 * GoDaddy-style "Pricing" explainer shown from the (?) icon next to a price.
 * Only genuine, server-computed numbers are shown — nothing is made up.
 */
const PricingInfoDialog = ({
  open,
  onOpenChange,
  domain,
  price,
  renewalPrice,
  isPromo,
  currency = "INR",
}: PricingInfoDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-0 bg-foreground text-background">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-background">Pricing</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed">
          {isPromo ? (
            <p>
              {domain ? (
                <>
                  <span className="font-semibold">{domain}</span> is available at a promotional
                  first-year price{price ? ` of ${formatMoney(price, currency)}` : ""}. This discount
                  comes directly from the registrar and applies to the first year only.
                </>
              ) : (
                "This domain is available at a promotional first-year price offered by the registrar."
              )}
            </p>
          ) : (
            <p>
              The price shown{price ? ` (${formatMoney(price, currency)})` : ""} is the registration
              price for the selected term.
            </p>
          )}
          {renewalPrice ? (
            <p>
              Subsequent years renew at {formatMoney(renewalPrice, currency)}/yr. Your domain
              auto-renews based on the term you select before purchasing.
            </p>
          ) : (
            <p>Renewal pricing is confirmed at checkout before you pay.</p>
          )}
          <p className="text-xs opacity-80">
            ICANN fees and applicable taxes may apply at checkout. All prices are locked with a
            live quote before payment.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PricingInfoDialog;
