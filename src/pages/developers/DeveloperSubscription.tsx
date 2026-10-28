import { useNavigate } from "react-router-dom";
import { goBack } from "@/lib/goBack";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ApiSubscriptionCard from "@/components/api/ApiSubscriptionCard";

export default function DeveloperSubscription() {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, "/developers")} aria-label="Back to Developer Portal">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Subscription</h1>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-7 sm:px-6 sm:pt-10">
        <ApiSubscriptionCard />
      </main>
    </div>
  );
}