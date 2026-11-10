import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type BotAudience = 'job_seeker' | 'employer';

/**
 * Owner Portal me save kiye gaye bot ka username deta hai.
 * Job seekers aur employers ke liye alag bot hota hai, isliye
 * hamesha sahi bot hi open ho.
 */
export const useTelegramBot = (audience: BotAudience = 'job_seeker') => {
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchBot = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_telegram_bot_username' as any, {
          p_audience: audience,
        });
        if (cancelled) return;
        if (error) {
          console.error('Error fetching telegram bot username:', error);
          setBotUsername(null);
        } else {
          const username = (data as unknown as string | null) || null;
          setBotUsername(username ? username.replace(/^@/, '') : null);
        }
      } catch (err) {
        if (!cancelled) setBotUsername(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchBot();
    return () => {
      cancelled = true;
    };
  }, [audience]);

  return {
    botUsername,
    isActive: !!botUsername,
    isLoading,
  };
};
