/** Normalises one owner-entered domain ("https://www.Site.com/x" → "www.site.com"). */
export const normalizeDomain = (raw: string): string =>
  raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");

/** Parses the saved list (comma, space or newline separated). */
export const parseDomains = (raw: string | null | undefined): string[] =>
  (raw || "").split(/[\s,]+/).map(normalizeDomain).filter((d) => d.includes("."));

/**
 * Turnstile shows only on the domains the owner saved. "site.com" also covers
 * "www.site.com" and other subdomains. An empty list keeps it on every domain.
 */
export const isTurnstileHostAllowed = (hostname: string, domains: string[]): boolean => {
  if (!domains.length) return true;
  const host = normalizeDomain(hostname);
  return domains.some((d) => {
    const base = d.replace(/^www\./, "");
    return host === d || host === base || host.endsWith(`.${base}`);
  });
};
