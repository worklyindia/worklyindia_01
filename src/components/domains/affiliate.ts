/**
 * GoDaddy CJ affiliate fallback.
 *
 * When "Enable domain sales" is switched OFF, the store stops selling and every
 * cart action instead sends the visitor to GoDaddy through the owner's CJ
 * Affiliate deep link, so commissions keep coming in.
 */

const GODADDY_SEARCH = (domain: string) =>
  `https://www.godaddy.com/domainsearch/find?domainToCheck=${encodeURIComponent(domain)}`;

/** Unknown settings fail closed until the storefront confirms purchase access. */
export const domainPurchaseMode = (
  salesEnabled: boolean | null,
  affiliateUrl: string,
): "cart" | "affiliate" | "locked" => {
  if (salesEnabled === true) return "cart";
  if (salesEnabled === false && affiliateUrl.trim()) return "affiliate";
  return "locked";
};

/**
 * Builds the final click URL.
 * - `{domain}` anywhere in the link is replaced with the domain name.
 * - A CJ deep link (`...?url=`) gets the GoDaddy search URL appended.
 * - Anything else is opened as-is.
 */
export const buildAffiliateUrl = (affiliateUrl: string, domain?: string): string => {
  const base = affiliateUrl.trim();
  if (!base) return "";
  if (base.includes("{domain}")) return base.replace(/\{domain\}/g, encodeURIComponent(domain ?? ""));
  if (!domain) return base;
  const target = encodeURIComponent(GODADDY_SEARCH(domain));
  if (/[?&]url=$/.test(base)) return `${base}${target}`;
  if (/[?&]url=/.test(base)) return base;
  return `${base}${base.includes("?") ? "&" : "?"}url=${target}`;
};

export const openAffiliate = (affiliateUrl: string, domain?: string) => {
  const url = buildAffiliateUrl(affiliateUrl, domain);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
};
