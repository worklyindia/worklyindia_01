import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, KeyRound, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { goBack } from "@/lib/goBack";
import WhatsAppBusinessProfile from "@/components/whatsapp/WhatsAppBusinessProfile";
import WhatsAppCallingSettings from "@/components/whatsapp/WhatsAppCallingSettings";
import WhatsAppSecuritySettings from "@/components/whatsapp/WhatsAppSecuritySettings";
import WhatsAppSetupGate from "@/components/whatsapp/WhatsAppSetupGate";

type Scope = "owner" | "employer";
const TITLES: Record<string, string> = { edit: "Edit profile", calling: "Calling", security: "Two-step verification" };

export function WhatsAppSubHeader({ title, fallback }: { title: string; fallback: string }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background px-2 py-2.5">
      <Button variant="ghost" size="icon" aria-label="Back" onClick={() => goBack(navigate, fallback)} className="shrink-0">
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold leading-tight">{title}</h1>
    </header>
  );
}

/** Profile overview: read-only profile with edit icon, then settings buttons that open their own pages. */
export function WhatsAppProfileOverview({ scope, base, before }: { scope: Scope; base: string; before?: ReactNode }) {
  const navigate = useNavigate();
  const items = [
    { key: "security", label: "Two-step verification", icon: KeyRound },
    { key: "calling", label: "Calling", icon: Phone },
  ];
  return (
    <WhatsAppSetupGate scope={scope}>
      {before}
      <WhatsAppBusinessProfile scope={scope} onEdit={() => navigate(`${base}/edit`)} />
      <section className="w-full bg-background">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Settings</h2>
        {items.map(({ key, label, icon: Icon }) => (
          <Button key={key} type="button" variant="ghost" onClick={() => navigate(`${base}/${key}`)}
            className="flex min-h-14 w-full justify-start gap-3 rounded-none border-b border-border px-4 text-left sm:px-6">
            <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1 text-sm font-medium">{label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        ))}
      </section>
    </WhatsAppSetupGate>
  );
}

/** Full-page section (edit / calling / security) with back header named after the page. */
export function WhatsAppProfileSectionPage({ scope, base }: { scope: Scope; base: string }) {
  const navigate = useNavigate();
  const { section = "" } = useParams();
  const title = TITLES[section] ?? "Business profile";
  return (
    <div className="min-h-screen bg-background">
      <WhatsAppSubHeader title={title} fallback={base} />
      <main className="w-full pb-28">
        <WhatsAppSetupGate scope={scope}>
        {section === "edit" && <WhatsAppBusinessProfile scope={scope} mode="edit" onSaved={() => goBack(navigate, base)} />}
        {section === "calling" && <WhatsAppCallingSettings scope={scope} />}
        {section === "security" && <WhatsAppSecuritySettings scope={scope} />}
        </WhatsAppSetupGate>
      </main>
    </div>
  );
}
