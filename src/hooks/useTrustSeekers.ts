import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrustItem } from "@/components/auth/TrustMarquee";

const FALLBACK: TrustItem[] = [
  { name: "Priya S." },
  { name: "Rahul K." },
  { name: "Anjali M." },
  { name: "Vikram R." },
  { name: "Neha P." },
  { name: "Arjun D." },
  { name: "Sneha I." },
  { name: "Rohan B." },
  { name: "Pooja N." },
  { name: "Karan T." },
  { name: "Divya A." },
  { name: "Aman G." },
];

const shortenName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const useTrustSeekers = () => {
  return useQuery({
    // Cache aggressively — shuffling happens client-side on each render.
    queryKey: ["trust-seekers"],
    staleTime: 1000 * 60 * 30, // 30 min
    gcTime: 1000 * 60 * 60, // 1 hour
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TrustItem[]> => {
      try {
        const { data, error } = await (supabase as any).rpc("get_trust_seekers", {
          _limit: 2000,
        });

        if (error || !data) return FALLBACK;

        const items: TrustItem[] = data
          .filter((p: any) => p.name && String(p.name).trim().length > 1)
          .map((p: any) => ({
            name: shortenName(p.name as string),
            imageUrl: (p.image_url as string) || null,
          }));

        return items.length >= 1 ? shuffle(items) : shuffle(FALLBACK);
      } catch {
        return shuffle(FALLBACK);
      }
    },
  });
};
