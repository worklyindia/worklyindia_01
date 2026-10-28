import { Button } from "@/components/ui/button";
import { ChevronRight, ShoppingCart } from "lucide-react";
import { useDomainCart } from "./useDomainCart";

/**
 * Sticky "Continue to Cart" bar — appears once the cart has at least one
 * domain. Sits above the app's native bottom navigation on mobile.
 */
const CartBar = ({ onOpenCart }: { onOpenCart: () => void }) => {
  const { items } = useDomainCart();
  if (items.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3 md:bottom-4">
      <div className="mx-auto max-w-5xl">
        <Button
          className="h-12 w-full justify-between rounded-xl px-5 text-base shadow-lg"
          onClick={onOpenCart}
        >
          <span className="font-semibold">Continue to Cart</span>
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="rounded-full bg-background/20 px-2 py-0.5 text-sm font-bold">
              {items.length}
            </span>
            <ChevronRight className="h-4 w-4" />
          </span>
        </Button>
      </div>
    </div>
  );
};

export default CartBar;
