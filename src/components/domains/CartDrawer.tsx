import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatMoney } from "@/hooks/useDomainMarket";
import { ShoppingCart, Trash2 } from "lucide-react";
import { useDomainCart } from "./useDomainCart";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckout: (domains: string[]) => void;
}

/** Cart contents — domains with the price they had when added. Final price is locked at checkout. */
const CartDrawer = ({ open, onOpenChange, onCheckout }: CartDrawerProps) => {
  const { items, remove, checkoutEnabled } = useDomainCart();
  const total = items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
  const currency = items[0]?.currency || "INR";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-[100dvh] w-screen max-w-none flex-col rounded-none border-0 sm:max-w-none"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Your Cart
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">Your cart is empty</p>
            <p className="text-sm text-muted-foreground">
              Search for a domain and tap the cart icon to add it here.
            </p>
          </div>
        ) : (
          <>
            <ul className="mt-4 flex-1 space-y-3 overflow-y-auto">
              {items.map((item) => {
                const price = Number(item.price) || 0;
                const renewal = Number(item.renewal_price) || 0;
                const savings = renewal > price ? renewal - price : 0;
                const offPct = savings > 0 ? Math.round((savings / renewal) * 100) : 0;

                return (
                  <li
                    key={item.domain}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.domain}</p>
                      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
                        {price > 0 ? (
                          <>
                            <span className="font-bold">
                              {formatMoney(price, item.currency)}
                              <span className="text-xs font-medium text-muted-foreground">/1 year</span>
                            </span>
                            {savings > 0 ? (
                              <>
                                <span className="text-xs text-muted-foreground line-through">
                                  {formatMoney(renewal, item.currency)}
                                </span>
                                <span className="text-xs font-semibold text-emerald-600">
                                  {offPct}% off
                                </span>
                              </>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Price confirmed at checkout</span>
                        )}
                      </p>
                      {renewal > 0 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Renews at {formatMoney(renewal, item.currency)}/1 year
                        </p>
                      ) : null}
                      {savings > 0 ? (
                        <p className="mt-0.5 text-xs font-semibold text-emerald-600">
                          🎉 You save {formatMoney(savings, item.currency)}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(item.domain)}
                      aria-label={`Remove ${item.domain} from cart`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimated total</span>
                <span className="text-lg font-bold">
                  {total > 0 ? formatMoney(total, currency) : "—"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Final price confirmed at checkout.
              </p>
              <Button
                className="h-12 w-full text-base"
                disabled={!checkoutEnabled}
                onClick={() => { if (checkoutEnabled) onCheckout(items.map((i) => i.domain)); }}
              >
                Continue to Checkout
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
