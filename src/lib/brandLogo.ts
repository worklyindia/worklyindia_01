// Replace only the superseded owner artwork; future uploads remain authoritative.
export const PRIMARY_LOGO_URL = '/icons/icon-192x192.png?v=20261022';
export const FAVICON_URL = '/favicon.png?v=20261022b';

export const resolveBrandLogo = (url: string | undefined, favicon = false): string => {
  const fallback = favicon ? FAVICON_URL : PRIMARY_LOGO_URL;
  if (!url || /(?:logo_url-1792658068682|favicon_url-1792658227274)\.(?:webp|png)(?:\?|$)/.test(url)) {
    return fallback;
  }
  return url;
};