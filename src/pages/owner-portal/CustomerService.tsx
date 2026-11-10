import { goBack } from '@/lib/goBack';
import { ArrowLeft, Headphones } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MetaSocialAIConnectCard from '@/components/social/MetaSocialAIConnectCard';
import GoogleBusinessProfileCard from '@/components/social/GoogleBusinessProfileCard';
import WhatsAppAudienceConnect from '@/components/whatsapp/WhatsAppAudienceConnect';
import { ScopedMailboxCards } from '@/components/owner/TemplateMailboxCards';

export default function CustomerService() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab');
  const tab = requestedTab && ['mailboxes', 'whatsapp', 'social'].includes(requestedTab) ? requestedTab : 'mailboxes';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-start gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          className="mt-0.5 shrink-0"
          onClick={() => goBack(navigate, '/owner-portal')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Headphones className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold sm:text-2xl">Customer Service</h1>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setParams((current) => { const next = new URLSearchParams(current); next.set("tab", value); return next; }, { replace: true })}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="mailboxes">Mailboxes</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-3 space-y-3">
          <WhatsAppAudienceConnect audiences={['customer_service']} />
        </TabsContent>

 <TabsContent value="social" className="mt-3 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Instagram and Facebook accounts for customer service only — separate from the ones on AI Connect.
          </p>
          <MetaSocialAIConnectCard platform="instagram" audience="support" returnTo="/owner-portal/customer-service?tab=social" />
          <MetaSocialAIConnectCard platform="facebook" audience="support" returnTo="/owner-portal/customer-service?tab=social" />
          <p className="text-[11px] text-muted-foreground">
            Google Business Profile — AI auto-replies to your Google reviews as website customer support.
          </p>
          <GoogleBusinessProfileCard enabled={true} audience="support" />
        </TabsContent>

        <TabsContent value="mailboxes" className="mt-3 space-y-3">
          <section className="space-y-3">
              <h2 className="text-sm font-semibold">Support mailboxes</h2>
              <ScopedMailboxCards scope="support" />
          </section>
        </TabsContent>

      </Tabs>
    </div>
  );
}
