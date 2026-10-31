import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck } from "lucide-react";

export const FOUNDER_NAME = "Vishalbhai Muljibhai Gohil";
export const FOUNDER_PHOTO_KEY = "founder_photo_url";
const DEFAULT_PHOTO = "/founder-ceo.jpg";
const SITE = "https://worklyindia.devs.surf";

/** Founder & CEO card; the photo is owner-editable in Brand Management. */
const FounderSection = ({ className = "" }: { className?: string }) => {
  const { data: photo } = useQuery({
    queryKey: ["app-setting", FOUNDER_PHOTO_KEY],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("setting_value").eq("setting_key", FOUNDER_PHOTO_KEY).maybeSingle();
      return (data?.setting_value as string) || DEFAULT_PHOTO;
    },
    staleTime: Infinity,
  });
  const src = photo || DEFAULT_PHOTO;
  const absolute = src.startsWith("http") ? src : `${SITE}${src}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE}/#founder`,
    name: FOUNDER_NAME,
    alternateName: "Vishal Gohil",
    jobTitle: "Founder & CEO",
    image: absolute,
    url: `${SITE}/about-us`,
    worksFor: { "@id": `${SITE}/#organization`, "@type": "Organization", name: "Workly India", url: `${SITE}/` },
    address: { "@type": "PostalAddress", addressLocality: "Patan", addressRegion: "Gujarat", addressCountry: "IN" },
  };

  return (
    <section className={className} aria-labelledby="founder-heading">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>
      <Card className="overflow-hidden border border-border/50">
        <div className="grid md:grid-cols-2">
          <img
            src={src}
            alt={`${FOUNDER_NAME}, Founder & CEO of Workly India`}
            className="w-full aspect-[4/5] object-cover"
            loading="lazy"
            decoding="async"
            width={1080}
            height={1350}
          />
          <div className="p-6 md:p-8 flex flex-col justify-center text-center md:text-left">
            <Badge variant="secondary" className="w-fit mx-auto md:mx-0 mb-3">Meet the Founder</Badge>
            <h2 id="founder-heading" className="text-2xl font-bold text-foreground flex items-center gap-2 justify-center md:justify-start">
              {FOUNDER_NAME}
              <BadgeCheck className="w-6 h-6 text-primary" aria-label="Verified" />
            </h2>
            <p className="text-primary font-semibold mt-1">Founder & CEO, Workly India</p>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              I started Workly India from Patan, Gujarat, so job seekers can find real, verified work without
              ever paying a fee. Every employer on our platform is checked, and our team is reachable by phone
              and WhatsApp.
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
};

export default FounderSection;
