import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useEngagementVisibility = () => {
  return useQuery({
    queryKey: ["site-settings", "engagement_visibility"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["show_views_count", "show_applies_count"]);

      if (error) throw error;
      
      const result = { showViews: true, showApplies: true };
      data?.forEach((row) => {
        if (row.key === "show_views_count") result.showViews = row.value === true || row.value === "true";
        if (row.key === "show_applies_count") result.showApplies = row.value === true || row.value === "true";
      });
      return result;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateEngagementVisibility = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("site_settings")
        .update({ value: value as unknown as any, updated_by: user?.id })
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", "engagement_visibility"] });
      toast.success("Visibility setting updated!");
    },
    onError: () => {
      toast.error("Failed to update visibility setting");
    },
  });
};

export interface SocialLinks {
  instagram: string;
  facebook: string;
  youtube: string;
  twitter: string;
  telegram: string;
  linkedin: string;
  whatsapp: string;
  instagram_handle: string;
  facebook_handle: string;
  youtube_handle: string;
  twitter_handle: string;
  telegram_handle: string;
  linkedin_handle: string;
  whatsapp_handle: string;
}

export interface MerchantInfo {
  legal_name: string;
  contact_number: string;
  email: string;
  registered_address: string;
  operational_address: string;
  founded_year?: string;
  udyam_registration?: string;
  iec_code?: string;
  business_type?: string;
}

export interface ContactInfo {
  phone: string;
  phone_hours: string;
  email: string;
  email_response: string;
  office_address: string;
  office_note: string;
  live_chat_available: boolean;
  live_chat_hours: string;
  hours_weekdays?: string;
  hours_saturday?: string;
  hours_sunday?: string;
}

export const useSocialLinks = () => {
  return useQuery({
    queryKey: ["site-settings", "social_links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "social_links")
        .single();

      if (error) throw error;
      return data.value as unknown as SocialLinks;
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
};

export const useUpdateSocialLinks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (socialLinks: SocialLinks) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("site_settings")
        .update({ 
          value: socialLinks as unknown as any,
          updated_by: user?.id 
        })
        .eq("key", "social_links")
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", "social_links"] });
      queryClient.invalidateQueries({ queryKey: ["social-links"] });
      toast.success("Social media links updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update social media links");
      console.error("Error updating social links:", error);
    },
  });
};

export const useMerchantInfo = () => {
  return useQuery({
    queryKey: ["site-settings", "merchant_info"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "merchant_info")
        .single();

      if (error) throw error;
      return data.value as unknown as MerchantInfo;
    },
    staleTime: 0,
    refetchOnMount: "always",
    gcTime: 60 * 60 * 1000,
  });
};

export const useUpdateMerchantInfo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (merchantInfo: MerchantInfo) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("site_settings")
        .update({ 
          value: merchantInfo as unknown as any,
          updated_by: user?.id 
        })
        .eq("key", "merchant_info")
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", "merchant_info"] });
      toast.success("Merchant information updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update merchant information");
      console.error("Error updating merchant info:", error);
    },
  });
};

export const useContactInfo = () => {
  return useQuery({
    queryKey: ["site-settings", "contact_info"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "contact_info")
        .single();

      if (error) throw error;
      return data.value as unknown as ContactInfo;
    },
    staleTime: 0,
    refetchOnMount: "always",
    gcTime: 60 * 60 * 1000,
  });
};

export const useUpdateContactInfo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactInfo: ContactInfo) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("site_settings")
        .update({ 
          value: contactInfo as unknown as any,
          updated_by: user?.id 
        })
        .eq("key", "contact_info")
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", "contact_info"] });
      toast.success("Contact information updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update contact information");
      console.error("Error updating contact info:", error);
    },
  });
};
