import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CANONICAL_URL } from "@/config/domainConfig";
import { FOUNDER_NAME, FOUNDER_PHOTO_KEY, DEFAULT_FOUNDER_PHOTO, founderSchema } from "@/lib/founderProfile.mjs";

/** Founder & CEO card; the photo is owner-editable in Brand Management. */
const FounderSection = ({ className = "" }: { className?: string }) => {
  const queryClient = useQueryClient();
  const { data: photo } = useQuery({
    queryKey: ["app-setting", FOUNDER_PHOTO_KEY],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("setting_value").eq("setting_key", FOUNDER_PHOTO_KEY).maybeSingle();
      if (error) throw error;
      return data?.setting_value || DEFAULT_FOUNDER_PHOTO;
    },
    staleTime: Infinity,
  });
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["app-setting", FOUNDER_PHOTO_KEY] }); };
    const channel = supabase.channel('public-founder-photo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: `setting_key=eq.${FOUNDER_PHOTO_KEY}` }, refresh)
      .subscribe((status) => { if (status === 'SUBSCRIBED') refresh(); });
    window.addEventListener('online', refresh);
    return () => { void supabase.removeChannel(channel); window.removeEventListener('online', refresh); };
  }, [queryClient]);
  const src = photo || DEFAULT_FOUNDER_PHOTO;
  const schema = founderSchema(CANONICAL_URL, src);

  return (
    <section id="founder" className={className} aria-labelledby="founder-heading">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>
        <div className="grid items-center gap-6 border-y border-border py-8 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-8">
          <img
            src={src}
            alt={`${FOUNDER_NAME}, Founder & CEO of Workly India`}
            className="w-full max-w-[280px] mx-auto aspect-[4/5] rounded-lg object-cover"
            loading="lazy"
            decoding="async"
            width={1080}
            height={1350}
          />
          <div className="min-w-0 flex flex-col justify-center text-center md:text-left">
            <Badge variant="secondary" className="w-fit mx-auto md:mx-0 mb-3">Meet the Founder</Badge>
            <h2 id="founder-heading" className="text-2xl font-bold text-foreground break-words">
              {FOUNDER_NAME}
            </h2>
            <p className="text-primary font-semibold mt-1">Founder & CEO, Workly India</p>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Vishalbhai Muljibhai Gohil is the Founder & CEO of Workly India, a platform connecting
              job seekers and employers across India.
            </p>
          </div>
        </div>
    </section>
  );
};

export default FounderSection;
