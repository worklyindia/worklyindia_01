export interface Festival { date: string; name: string; }

/** Expand only a Navratri starting entry, never an already numbered day. */
export function expandFestivalDays(input: readonly Festival[]): Festival[] {
  const result = new Map<string, Festival>();
  const add = (festival: Festival) => result.set(`${festival.date}|${festival.name.toLowerCase()}`, festival);
  for (const festival of input) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(festival.date) || !festival.name) continue;
    const start = new Date(`${festival.date}T00:00:00Z`);
    if (Number.isNaN(start.getTime())) continue;
    const isStart = /navratri/i.test(festival.name) && !/\b(?:last|end|day\s*[2-9])\b/i.test(festival.name);
    if (!isStart) { add(festival); continue; }
    const base = festival.name.replace(/^first\s+day\s+of\s+/i, "").replace(/\s+day\s*1\s*$/i, "").trim();
    for (let day = 1; day <= 9; day++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + day - 1);
      add({ date: date.toISOString().slice(0, 10), name: `${base} Day ${day}` });
    }
  }
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function selectFestivalDay(festivals: readonly Festival[], today: string) {
  const current = festivals.filter(f => f.date === today);
  const nextDate = current.length ? undefined : festivals.find(f => f.date > today)?.date;
  return { current, upcoming: nextDate ? festivals.filter(f => f.date === nextDate) : [] };
}