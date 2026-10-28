const META_TIMEZONES: Record<string, string> = {
  '1': 'Pacific Time (America/Los_Angeles)',
  '71': 'Asia/Kolkata, UTC+05:30',
};

/** Meta's numeric IDs are not UTC offsets. Keep unknown IDs explicit rather than guessing. */
export function formatWhatsappTimezone(value?: string | number | null): string | undefined {
  if (value == null || value === '') return undefined;
  const id = String(value);
  return META_TIMEZONES[id] || (id.includes('/') ? id.replace(/_/g, ' ') : `Meta timezone ID ${id} (name unavailable)`);
}