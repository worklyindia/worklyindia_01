import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DonationCampaign = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  long_content: string | null;
  image_url: string | null;
  target_amount: number;
  collected_amount: number;
  donor_count: number;
  status: "active" | "ended" | "draft";
  is_featured: boolean;
  display_order: number;
  min_amount: number;
  suggested_amounts: number[];
};

export function useFeaturedDonationCampaign() {
  const [campaign, setCampaign] = useState<DonationCampaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchCampaign = async () => {
      const { data } = await supabase
        .from("donation_campaigns")
        .select("*")
        .neq("status", "draft")
        .order("is_featured", { ascending: false })
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mounted) {
        setCampaign(data as any);
        setLoading(false);
      }
    };

    fetchCampaign();

    const channel = supabase
      .channel("donation_campaigns_featured")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "donation_campaigns" },
        () => fetchCampaign()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { campaign, loading };
}

export function useAllDonationCampaigns() {
  const [campaigns, setCampaigns] = useState<DonationCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("donation_campaigns")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });
    setCampaigns((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  return { campaigns, loading, reload };
}
