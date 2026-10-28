import { WEBSITE_DOMAIN } from "../../_shared/domain.ts";

export function getDomain(providedDomain?: string): string {
  return providedDomain || WEBSITE_DOMAIN;
}

export function buildUrl(domain: string, path: string): string {
  // Remove trailing slash from domain and leading slash from path
  const cleanDomain = domain.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${cleanDomain}/${cleanPath}`;
}
