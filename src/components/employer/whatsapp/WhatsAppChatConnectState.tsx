import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import WhatsAppLogo from "@/components/whatsapp/WhatsAppLogo";
import { useEmployerWhatsAppConnect } from "./useEmployerWhatsAppConnect";

export default function WhatsAppChatConnectState({ onConnected }: { onConnected: () => void }) {
  const { connect, busy } = useEmployerWhatsAppConnect(onConnected);
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
    <WhatsAppLogo size={28} />
    <p className="font-medium">Connect your WhatsApp account</p>
    <Button onClick={connect} disabled={busy}>
      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Connect WhatsApp
    </Button>
  </div>;
}