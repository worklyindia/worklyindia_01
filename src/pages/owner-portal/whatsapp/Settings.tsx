import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import WhatsAppAudienceConnect from "@/components/whatsapp/WhatsAppAudienceConnect";

export default function WhatsAppCloudSettings() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background px-2 py-2.5">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight truncate">WhatsApp Settings</h1>
          <p className="text-xs text-muted-foreground truncate">Manage connected WhatsApp numbers</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-3 sm:px-6 py-4 pb-24 space-y-4">
        <WhatsAppAudienceConnect />
      </main>
    </div>
  );
}
