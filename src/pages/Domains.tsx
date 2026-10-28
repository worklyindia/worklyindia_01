import { useState } from "react";
import { Helmet } from "react-helmet-async";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Search } from "lucide-react";
import MyDomains, { type OwnedDomain } from "@/components/domains/MyDomains";
import DomainSearch from "@/components/domains/DomainSearch";
import DomainManager from "@/components/domains/DomainManager";
import DomainCheckoutDialog from "@/components/domains/DomainCheckoutDialog";
import CartBar from "@/components/domains/CartBar";
import CartDrawer from "@/components/domains/CartDrawer";
import { DomainCartProvider, useDomainCart } from "@/components/domains/useDomainCart";
import PageHeader from "@/components/PageHeader";

const DomainsInner = () => {
  const cart = useDomainCart();
  const [selected, setSelected] = useState<OwnedDomain | null>(null);
  const [checkoutDomains, setCheckoutDomains] = useState<string[] | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const checkoutCart = (domains: string[]) => {
    if (!cart.checkoutEnabled) return;
    setCartOpen(false);
    setCheckoutDomains(domains);
  };

  return (
    <>
      <Helmet>
        <title>Buy & Manage Domains | Workly India</title>
        <meta
          name="description"
          content="Search and register domains at live INR prices, grab today's domain offers, and manage DNS, nameservers and forwarding from one secure dashboard."
        />
        <link rel="canonical" href="/domains" />
      </Helmet>

      <PageHeader title="Domains" backTo="/employer-portal" />
      <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-8">
        {selected ? (
          <DomainManager domain={selected} onBack={() => setSelected(null)} />
        ) : (
          <Tabs defaultValue="buy" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy" className="gap-2">
                <Search className="h-4 w-4" /> Buy domains
              </TabsTrigger>
              <TabsTrigger value="mine" className="gap-2">
                <Globe className="h-4 w-4" /> My domains
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buy" className="mt-4 space-y-6">
              <DomainSearch />
            </TabsContent>

            <TabsContent value="mine" className="mt-4">
              <MyDomains onManage={setSelected} />
            </TabsContent>
          </Tabs>
        )}

        <DomainCheckoutDialog
          domains={checkoutDomains ?? []}
          open={cart.checkoutEnabled && checkoutDomains !== null && checkoutDomains.length > 0}
          onOpenChange={(open) => {
            if (!open) setCheckoutDomains(null);
          }}
          onRegistered={() => {
            cart.clear();
          }}
        />

        <CartDrawer open={cartOpen} onOpenChange={setCartOpen} onCheckout={checkoutCart} />
        <CartBar onOpenCart={() => setCartOpen(true)} />
      </main>
    </>
  );
};

const Domains = () => (
  <DomainCartProvider>
    <DomainsInner />
  </DomainCartProvider>
);

export default Domains;
