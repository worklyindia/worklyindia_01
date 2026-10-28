import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Facebook, Loader2 } from "lucide-react";
import { useEmployerWhatsAppConnect } from "./useEmployerWhatsAppConnect";

export default function EmployerWhatsAppConnectCard({ onConnected }: { onConnected: () => void }) {
  const { connect, busy } = useEmployerWhatsAppConnect(onConnected);

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          Your company WhatsApp
          <Badge variant="secondary">Not connected</Badge>
        </CardTitle>
        <CardDescription>Connect your WhatsApp Business number to chat with candidates from here.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 grid gap-2">
        <Button className="w-full" onClick={connect} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Facebook className="w-4 h-4 mr-2" />}
          Connect
        </Button>
      </CardContent>
    </Card>
  );
}
