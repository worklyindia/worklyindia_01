import instagram from '@/assets/email-social/instagram-hd.png.asset.json';
import youtube from '@/assets/email-social/youtube-hd.png.asset.json';
import telegram from '@/assets/email-social/telegram-hd.png.asset.json';
import twitter from '@/assets/email-social/x-hd.png.asset.json';
import facebook from '@/assets/email-social/facebook-hd.png.asset.json';
import linkedin from '@/assets/email-social/linkedin-hd.png.asset.json';
import whatsapp from '@/assets/email-social/whatsapp-hd.png.asset.json';

export const SOCIAL_PLATFORMS = ['instagram', 'youtube', 'telegram', 'twitter', 'facebook', 'linkedin', 'whatsapp'] as const;
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];
export const SOCIAL_ICON_QUERY_KEY = ['email-social-icons'] as const;
export const SOCIAL_ICON_FIELDS = SOCIAL_PLATFORMS.map(platform => `email_social_icon_${platform}`);
export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram', youtube: 'YouTube', telegram: 'Telegram', twitter: 'X',
  facebook: 'Facebook', linkedin: 'LinkedIn', whatsapp: 'WhatsApp',
};
export const DEFAULT_SOCIAL_ICONS: Record<SocialPlatform, string> = {
  instagram: instagram.url, youtube: youtube.url, telegram: telegram.url, twitter: twitter.url,
  facebook: facebook.url, linkedin: linkedin.url, whatsapp: whatsapp.url,
};

export const resolveSocialIcons = (settings: Record<string, string | undefined>) =>
  Object.fromEntries(SOCIAL_PLATFORMS.map(platform => [
    platform, settings[`email_social_icon_${platform}`]?.trim() || DEFAULT_SOCIAL_ICONS[platform],
  ])) as Record<SocialPlatform, string>;

export const socialPlatformUrl = (platform: SocialPlatform, url: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  return platform === 'whatsapp' ? `https://wa.me/${url.replace(/\D/g, '')}` : `https://${url}`;
};