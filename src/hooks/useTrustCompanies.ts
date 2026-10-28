import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrustItem } from "@/components/auth/TrustMarquee";

const FALLBACK: TrustItem[] = [
  { name: "Infosys", verified: true },
  { name: "TCS", verified: true },
  { name: "Wipro", verified: true },
  { name: "HCL Tech", verified: true },
  { name: "Tech Mahindra", verified: true },
  { name: "Capgemini", verified: true },
  { name: "Accenture", verified: true },
  { name: "Cognizant", verified: true },
  { name: "Genpact", verified: true },
  { name: "Zomato", verified: true },
  { name: "Swiggy", verified: true },
  { name: "Paytm", verified: true },
];

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const useTrustCompanies = () => {
  return useQuery({
    queryKey: ["trust-companies"],
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TrustItem[]> => {
      try {
        const { data, error } = await (supabase as any).rpc("get_trust_companies", {
          _limit: 2000,
        });

        if (error || !data) return FALLBACK;

        const items: TrustItem[] = data
          .filter((c: any) => c.name)
          .map((c: any) => ({
            name: c.name as string,
            imageUrl: (c.image_url as string) || null,
            verified: Boolean(c.verified),
          }));

        return items.length >= 1 ? shuffle(items) : shuffle(FALLBACK);
      } catch {
        return shuffle(FALLBACK);
      }
    },
  });
};
