import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { AIPlanCards, AIPlanNotes } from "@/components/PublicAIPlans";

const AIPublicPricing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="ChatWork AI Pricing"
        description="ChatWork AI plans and pricing from Workly India. Review features, limits, payment terms, refund policy, and support information."
        keywords="ChatWork AI pricing, AI subscription India, Workly India pricing"
        canonical="/ai-assistant/pricing"
      />

      <header className="border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/auth?redirect=/ai-assistant/pricing")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            AI login
          </Button>
          <Link to="/" className="text-sm font-semibold text-foreground">
            {BRAND_CONFIG.name}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 pb-16">
        <section className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">ChatWork AI</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, transparent AI plans
          </h1>
          <p className="mt-4 text-muted-foreground">
            Choose the plan that fits your use of ChatWork AI. Job-seeker access and plan limits are shown clearly before payment.
          </p>
        </section>

        <AIPlanCards signupTo="/auth?redirect=/ai-assistant/pricing&mode=signup" />

        <AIPlanNotes />
      </main>
    </div>
  );
};

export default AIPublicPricing;
