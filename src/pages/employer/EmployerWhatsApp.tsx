import { Loader2 } from "lucide-react";
import EmployerNumberSwitcher from "@/components/employer/whatsapp/EmployerNumberSwitcher";
import EmployerWhatsAppFullChat from "@/pages/employer/EmployerWhatsAppFullChat";
import { useEmployerWhatsApp } from "@/components/employer/whatsapp/useEmployerWhatsApp";

export default function EmployerWhatsApp() {
  const { account, accounts, connected, loading, reload } = useEmployerWhatsApp();

  if (loading) {
    return <div className="min-h-screen flex justify-center items-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (connected && account) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <EmployerNumberSwitcher accounts={accounts} current={account} reload={reload} />
        <div className="min-h-0 flex-1">
          <EmployerWhatsAppFullChat
            key={account.phone_number_id ?? "default"}
            companyId={account.company_id}
            phoneNumberId={account.phone_number_id ?? null}
            isDefaultNumber={!!account.is_default}
          />
        </div>
      </div>
    );
  }

  return (
    <EmployerWhatsAppFullChat companyId="" onConnected={() => void reload()} />
  );
}
