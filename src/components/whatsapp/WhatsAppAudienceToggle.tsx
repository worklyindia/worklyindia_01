import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWhatsAppAudience, type WhatsAppAudience } from "@/lib/whatsappAudience";

export default function WhatsAppAudienceToggle({ className }: { className?: string }) {
  const [audience, setAudience] = useWhatsAppAudience();
  return (
    <Tabs
      value={audience}
      onValueChange={(v) => {
        setAudience(v as WhatsAppAudience);
        // reload so templates/data of the selected number are fetched fresh
        window.location.reload();
      }}
      className={className}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="job_seeker">Job seekers</TabsTrigger>
        <TabsTrigger value="employer">Employers</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
