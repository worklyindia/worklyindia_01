// Owner storage lists: newest upload on top; exact same date+time falls back to name.
const timeOf = (value?: string | null) => (value ? Date.parse(value) || 0 : 0);

export const sortNewestFirst = <T,>(
  items: T[],
  dateOf: (item: T) => string | null | undefined,
  nameOf: (item: T) => string,
): T[] => [...items].sort((a, b) => timeOf(dateOf(b)) - timeOf(dateOf(a)) || nameOf(a).localeCompare(nameOf(b)));
