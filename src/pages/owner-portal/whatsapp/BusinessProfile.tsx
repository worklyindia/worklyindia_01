import { useParams } from "react-router-dom";
import OwnerWhatsAppLimits from "@/components/whatsapp/OwnerWhatsAppLimits";
import { WhatsAppProfileOverview, WhatsAppProfileSectionPage, WhatsAppSubHeader } from "@/components/whatsapp/WhatsAppProfileSections";

const BASE = "/owner-portal/whatsapp/business-profile";

export default function WhatsAppBusinessProfilePage() {
  const { section } = useParams();
  if (section) return <WhatsAppProfileSectionPage scope="owner" base={BASE} />;
  return (
    <div className="min-h-screen bg-background">
      <WhatsAppSubHeader title="Business profile" fallback="/owner-portal/whatsapp/chat" />
      <main className="w-full pb-24">
        <WhatsAppProfileOverview scope="owner" base={BASE} before={<OwnerWhatsAppLimits />} />
      </main>
    </div>
  );
}
