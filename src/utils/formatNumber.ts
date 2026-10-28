export function formatCount(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(num % 1_000_000 >= 100_000 ? 1 : 0) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(num % 1_000 >= 100 ? 1 : 0) + 'K';
  return num.toString();
}
