import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import supportAvatar from '@/assets/support-avatar.webp';

export interface AIChatSettings {
  name: string;
  avatar_url: string;
  tagline: string;
  verification_enabled: boolean;
  verification_color: 'gold' | 'blue' | 'green' | 'silver';
  isLoading: boolean;
}

export const useAIChatSettings = () => {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['ai-chat-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['ai_support_name', 'ai_support_avatar', 'ai_support_tagline', 'ai_support_verification_enabled', 'ai_support_verification_color']);

      if (error) throw error;

      const settingsMap = data?.reduce((acc, item) => {
        acc[item.setting_key] = item.setting_value || '';
        return acc;
      }, {} as Record<string, string>) || {};

      return {
        name: settingsMap['ai_support_name'] || 'ChatWork',
        avatar_url: settingsMap['ai_support_avatar'] || supportAvatar,
        tagline: settingsMap['ai_support_tagline'] || 'AI Career Assistant',
        verification_enabled: settingsMap['ai_support_verification_enabled'] === 'true',
        verification_color: (settingsMap['ai_support_verification_color'] as 'gold' | 'blue' | 'green' | 'silver') || 'gold',
      };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return {
    data: settings || { 
      name: 'ChatWork', 
      avatar_url: supportAvatar, 
      tagline: 'AI Career Assistant',
      verification_enabled: true,
      verification_color: 'gold'
    },
    isLoading,
  };
};
