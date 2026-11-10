import { useParams } from "react-router-dom";
import { useEmployerWhatsApp } from "@/components/employer/whatsapp/useEmployerWhatsApp";
import EmployerNumberSwitcher from "@/components/employer/whatsapp/EmployerNumberSwitcher";
import EmployerWhatsAppLimitCard from "@/components/employer/whatsapp/EmployerWhatsAppLimitCard";
import { WhatsAppProfileOverview, WhatsAppProfileSectionPage, WhatsAppSubHeader } from "@/components/whatsapp/WhatsAppProfileSections";

const BASE = "/employer/workly-chat/business-profile";

export default function EmployerWhatsAppBusinessProfile() {
  const { section } = useParams();
  const { account, accounts, reload } = useEmployerWhatsApp();
  const k = account?.phone_number_id ?? "default";
  if (section) return <WhatsAppProfileSectionPage key={`${section}-${k}`} scope="employer" base={BASE} />;

  return (
    <div className="min-h-screen bg-background">
      <WhatsAppSubHeader title="Business profile" fallback="/employer/workly-chat" />
      {account && <EmployerNumberSwitcher accounts={accounts} current={account} reload={reload} switchOnly />}
      <main key={k} className="w-full pb-28">
        <WhatsAppProfileOverview scope="employer" base={BASE}
          before={<EmployerWhatsAppLimitCard phoneNumberId={account?.phone_number_id ?? null} />} />
      </main>
    </div>
  );
}
