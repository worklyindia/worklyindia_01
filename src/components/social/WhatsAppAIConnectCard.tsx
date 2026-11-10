import { useNavigate } from 'react-router-dom';
import PlatformCard from '@/components/social/PlatformCard';
import { toast } from 'sonner';
import { useEmployerWhatsApp, employerWhatsAppAction } from '@/components/employer/whatsapp/useEmployerWhatsApp';
import { useEmployerWhatsAppConnect } from '@/components/employer/whatsapp/useEmployerWhatsAppConnect';

import WhatsAppLogo from "@/components/whatsapp/WhatsAppLogo";

/** AI Connect WhatsApp: same connection as the employer WhatsApp page; AI auto-replies while connected. */
export default function WhatsAppAIConnectCard() {
  const navigate = useNavigate();
  const { account, connected, loading, reload } = useEmployerWhatsApp();
  const { connect, busy, setBusy } = useEmployerWhatsAppConnect(() => {
    void reload();
    navigate('/ai-assistant/connect/whatsapp/settings');
  });

  const disconnect = async () => {
    setBusy(true);
    try {
      await employerWhatsAppAction({ action: 'disconnect' });
      toast.success('WhatsApp disconnected');
      await reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <PlatformCard
      name="WhatsApp"
      connectLabel="Connect"
      description="Connect your WhatsApp Business number so AI can auto reply to candidate messages."
      logo={<WhatsAppLogo />}
      connected={connected}
      connectedLabel={account?.verified_name || account?.business_name || 'Connected'}
      subLabel={connected ? account?.display_phone : null}
      onConnect={connect}
      onSettings={connected ? () => navigate('/ai-assistant/connect/whatsapp/settings') : undefined}
      onDisconnect={connected ? disconnect : undefined}
      loading={busy || loading}
      brandColor="#25D366"
    />
  );
}
