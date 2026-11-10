/**
 * Default avatar fallbacks for users and companies.
 *
 * Fallback chains:
 *   - Job seeker: uploaded image -> OAuth (Google/LinkedIn) avatar -> initials avatar (UI)
 *   - Company: uploaded logo -> OAuth avatar of employer -> linked seeker profile_image_url -> generated default company icon
 */
import defaultCompanyLogo from "@/assets/default-company-logo.webp";

export const DEFAULT_COMPANY_LOGO = defaultCompanyLogo;

const isNonEmpty = (s?: string | null): s is string =>
  typeof s === "string" && s.trim().length > 0;

export function resolveCompanyLogo(opts: {
  companyLogo?: string | null;
  oauthAvatar?: string | null;
  seekerAvatar?: string | null;
}): string {
  if (isNonEmpty(opts.companyLogo)) return opts.companyLogo;
  if (isNonEmpty(opts.oauthAvatar)) return opts.oauthAvatar;
  if (isNonEmpty(opts.seekerAvatar)) return opts.seekerAvatar;
  return DEFAULT_COMPANY_LOGO;
}

/**
 * Returns true when the given URL looks like an OAuth-provider-hosted avatar
 * (Google or LinkedIn). Used to safely refresh provider-hosted images without
 * overwriting a user-uploaded picture.
 */
export function isOAuthHostedAvatar(url?: string | null): boolean {
  if (!isNonEmpty(url)) return false;
  try {
    const host = new URL(url).host.toLowerCase();
    return (
      host.endsWith("googleusercontent.com") ||
      host.endsWith("licdn.com") ||
      host.endsWith("linkedin.com") ||
      host.endsWith("twimg.com") ||
      host.endsWith("twitter.com") ||
      host.endsWith("x.com")
    );
  } catch {
    return false;
  }
}
