// Only public account metadata may leave the server; never return Graph tokens or raw responses.
export const META_PROFILE_FIELDS = {
  instagram: ['id', 'user_id', 'name', 'username', 'profile_picture_url', 'biography', 'website', 'followers_count', 'follows_count', 'media_count', 'account_type'],
  facebook: ['id', 'name', 'username', 'picture', 'about', 'description', 'category', 'category_list', 'website', 'phone', 'emails', 'single_line_address', 'location', 'hours', 'followers_count', 'fan_count', 'link', 'verification_status', 'is_published', 'is_verified', 'cover', 'business', 'can_post', 'rating_count', 'overall_star_rating'],
} as const;

export function publicMetaProfile(platform: 'instagram' | 'facebook', raw: Record<string, unknown>) {
  const profile: Record<string, unknown> = {};
  for (const key of META_PROFILE_FIELDS[platform]) {
    if (raw[key] !== undefined && raw[key] !== null) profile[key] = raw[key];
  }
  const picture = raw.picture as { data?: { url?: string; is_silhouette?: boolean } } | undefined;
  profile.picture_url = platform === 'instagram' ? raw.profile_picture_url ?? null : picture?.data?.is_silhouette ? null : picture?.data?.url ?? null;
  delete profile.picture;
  return profile;
}