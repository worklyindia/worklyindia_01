export interface JobDurationPackage {
  months: number;
  points: number;
  price?: number;
  is_default?: boolean;
  is_active?: boolean;
}

/** Owner page edits `points` (₹); `price` is a legacy mirror that can go stale, so points wins. */
export function packagePrice(pkg: Pick<JobDurationPackage, 'points' | 'price'>): number {
  const value = Number(pkg.points ?? pkg.price);
  return Number.isFinite(value) ? value : 0;
}

/** Lowest price first; same price → shorter duration first. */
export function sortPackagesByPrice<T extends JobDurationPackage>(packages: T[]): T[] {
  return [...packages].sort((a, b) => (packagePrice(a) - packagePrice(b)) || (a.months - b.months));
}

/** Packages visitors and employers can buy: active only, sorted by price. */
export function visiblePackages<T extends JobDurationPackage>(packages: unknown): T[] {
  if (!Array.isArray(packages)) return [];
  return sortPackagesByPrice((packages as T[]).filter((p) => p && p.is_active !== false));
}

/** Packages as saved by the owner: price mirrors points, sorted by price. */
export function normalizeForSave<T extends JobDurationPackage>(packages: T[]): T[] {
  return sortPackagesByPrice(packages.map((p) => ({ ...p, price: p.points })));
}
