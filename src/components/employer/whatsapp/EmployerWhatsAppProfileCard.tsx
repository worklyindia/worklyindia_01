import { confirmDialog } from '@/lib/confirmDialog';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, Unplug } from "lucide-react";
import { toast } from "sonner";
import { employerWhatsAppAction, useEmployerWhatsApp } from "./useEmployerWhatsApp";

export default function EmployerWhatsAppProfileCard() {
  const navigate = useNavigate();
  const { account, connected, loading, reload } = useEmployerWhatsApp();
  const [busy, setBusy] = useState(false);

  const disconnect = async () => {
    if (!await confirmDialog("Disconnect your WhatsApp number? You can connect again anytime.")) return;
    setBusy(true);
    try { await employerWhatsAppAction({ action: "disconnect" }); toast.success("WhatsApp disconnected"); await reload(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  if (loading) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><MessageCircle className="w-5 h-5" />WhatsApp</span>
          <Badge variant={connected ? "default" : "secondary"}>{connected ? "Connected" : "Not connected"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {connected ? (
          <>
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Number:</span> {account?.display_phone || "-"}</p>
              <p><span className="text-muted-foreground">Name:</span> {account?.verified_name || account?.business_name || "-"}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => navigate("/employer/workly-chat")}>Open chat</Button>
              <Button variant="outline" onClick={disconnect} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unplug className="w-4 h-4 mr-2" />}Disconnect
              </Button>
            </div>
          </>
        ) : (
          <Button className="w-full" onClick={() => navigate("/employer/workly-chat")}>Connect WhatsApp</Button>
        )}
      </CardContent>
    </Card>
  );
}
