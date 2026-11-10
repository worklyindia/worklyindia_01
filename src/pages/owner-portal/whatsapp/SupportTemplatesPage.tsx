import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupportTemplateManager } from "@/components/owner-portal/whatsapp/SupportTemplateManager";

export default function SupportTemplatesPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-2 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold leading-tight">Chat Templates</h1>
          <p className="text-xs text-muted-foreground">Customer support openers after 24-hour window</p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 p-3 pb-10">
        <SupportTemplateManager audience="customer_service" />
      </main>
    </div>
  );
}
