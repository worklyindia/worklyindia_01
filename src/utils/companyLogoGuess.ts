/**
 * Best-effort company logo URL guess for external (Jooble) jobs which do not
 * provide a logo. Uses Clearbit's free logo endpoint by guessing a domain from
 * the company name (e.g. "Verizon" -> "verizon.com"). Consumers must handle
 * onError to fall back to the default Jooble/placeholder icon.
 */
export const guessCompanyLogoUrl = (company?: string | null): string | null => {
  if (!company) return null;
  const slug = company
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(inc|llc|ltd|pvt|private|limited|corp|corporation|co|company|technologies|tech|solutions|services|group)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  if (!slug || slug.length < 2) return null;
  return `https://logo.clearbit.com/${slug}.com`;
};
