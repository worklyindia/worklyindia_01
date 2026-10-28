/**
 * Shared rules for the signed-out Domains introduction page.
 * The catalogue only says which endings the owner sells — the real price for a
 * name is quoted live at search time, so nothing here may invent a price.
 */
export type TldCatalogueRow = {
  tld: string;
  is_popular?: boolean | null;
  sort_order?: number | null;
  active?: boolean | null;
};

export type DomainOfferRow = {
  domain: string;
  tld: string;
  available?: boolean | null;
  customer_price?: number | string | null;
  customer_renewal_price?: number | string | null;
  currency?: string | null;
  offer_day?: string | null;
};

export type PublicDomainQuote = {
  domain: string;
  available?: boolean;
  tld?: string;
  price?: number;
  renewal_price?: number | null;
  currency?: string;
  period_years?: number;
};

// Familiar endings are a presentation preference, not measured market share.
const COMMON_ENDINGS = ['com', 'in', 'org', 'net', 'co', 'co.in', 'io', 'ai', 'app', 'dev', 'shop', 'store', 'online', 'site', 'xyz', 'tech', 'info', 'biz', 'me', 'cloud', 'club', 'live', 'world', 'agency', 'digital', 'space', 'website', 'life', 'solutions', 'fun'];

export function popularDomainTlds(rows: TldCatalogueRow[], limit = 24): TldCatalogueRow[] {
  const unique = new Map<string, TldCatalogueRow>();
  for (const row of visibleTlds(rows)) {
    const tld = row.tld.trim().replace(/^\./, '').toLowerCase();
    if (tld && !unique.has(tld)) unique.set(tld, { ...row, tld });
  }
  const rank = (tld: string) => {
    const index = COMMON_ENDINGS.indexOf(tld);
    return index < 0 ? COMMON_ENDINGS.length : index;
  };
  return [...unique.values()].sort((a, b) =>
    Number(b.is_popular === true) - Number(a.is_popular === true) ||
    rank(a.tld) - rank(b.tld) || Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || a.tld.localeCompare(b.tld),
  ).slice(0, limit);
}

/** One available name per popular supported ending; never reuse saved prices. */
export async function loadPublicDomainCards(
  tlds: TldCatalogueRow[],
  offers: PublicDomainQuote[],
  check: (domain: string) => Promise<PublicDomainQuote>,
  maximumCount = 24,
  onProgress?: (cards: PublicDomainQuote[]) => void,
): Promise<PublicDomainQuote[]> {
  const selected = popularDomainTlds(tlds, maximumCount);
  const cards = new Map<string, PublicDomainQuote>();
  const snapshot = () => selected.flatMap(({ tld }) => {
    const quote = cards.get(tld);
    return quote ? [quote] : [];
  });
  const pending = [...selected];
  await Promise.all(Array.from({ length: Math.min(3, pending.length) }, async () => {
    while (pending.length) {
      const row = pending.shift();
      if (!row) return;
      const suggested = offers.find(offer => offer.domain.toLowerCase().endsWith(`.${row.tld}`))?.domain;
      const candidates = [...new Set([suggested, `getxyz.${row.tld}`, `getworkly.${row.tld}`, `worklyhub2026.${row.tld}`].filter((domain): domain is string => Boolean(domain)))];
      for (const domain of candidates) {
        try {
          const quote = await check(domain);
          if (quote.available !== true || !Number.isFinite(quote.price) || Number(quote.price) <= 0 ||
              !Number.isFinite(quote.renewal_price) || Number(quote.renewal_price) <= 0) continue;
          cards.set(row.tld, { ...quote, domain: quote.domain.toLowerCase(), tld: row.tld });
          onProgress?.(snapshot());
          break;
        } catch {
          // Try another name; never invent availability or a price.
        }
      }
    }
  }));
  if (selected.length && cards.size === 0) throw new Error('Domain prices could not be loaded.');
  return snapshot();
}

/** Active endings only, popular first, then the owner's saved order, then A–Z. */
export function visibleTlds(rows: TldCatalogueRow[]): TldCatalogueRow[] {
  return rows
    .filter((row) => row.active !== false)
    .sort(
      (a, b) =>
        Number(b.is_popular === true) - Number(a.is_popular === true) ||
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) ||
        a.tld.localeCompare(b.tld),
    );
}

/**
 * Today's offers: available names with a server-quoted price, cheapest first.
 * Rows from another day are never shown, so an expired deal cannot be quoted.
 */
export function currentOffers(rows: DomainOfferRow[], today: string): DomainOfferRow[] {
  return rows
    .filter(
      (row) =>
        row.available !== false &&
        row.offer_day === today &&
        Number(row.customer_price ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        Number(a.customer_price ?? 0) - Number(b.customer_price ?? 0) ||
        `${a.domain}.${a.tld}`.localeCompare(`${b.domain}.${b.tld}`),
    );
}

/** Money for the public page: only the currency the server returned. */
export function formatOfferPrice(value: number | string | null | undefined, currency?: string | null): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "";
  const symbol = (currency ?? "INR").toUpperCase() === "INR" ? "₹" : `${currency} `;
  return `${symbol}${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
