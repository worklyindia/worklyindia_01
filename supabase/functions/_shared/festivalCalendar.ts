// Indian festival / holiday calendar (Google Calendar "Indian Holidays" dataset)
// with IST-accurate "kitne din baaki hain" maths.

const IST = "Asia/Kolkata";

export interface FestivalEntry {
  date: string; // YYYY-MM-DD
  name: string;
  type?: string;
}

export const FESTIVALS: FestivalEntry[] = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-14", name: "Makar Sankranti / Pongal" },
  { date: "2026-01-26", name: "Republic Day", type: "national" },
  { date: "2026-02-15", name: "Vasant Panchami" },
  { date: "2026-02-17", name: "Maha Shivaratri" },
  { date: "2026-03-03", name: "Holika Dahan" },
  { date: "2026-03-04", name: "Holi" },
  { date: "2026-03-21", name: "Ugadi / Gudi Padwa" },
  { date: "2026-03-27", name: "Ram Navami" },
  { date: "2026-04-01", name: "Mahavir Jayanti" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-14", name: "Ambedkar Jayanti / Baisakhi" },
  { date: "2026-05-01", name: "Labour Day" },
  { date: "2026-05-07", name: "Buddha Purnima" },
  { date: "2026-05-27", name: "Eid ul-Fitr" },
  { date: "2026-06-25", name: "Rath Yatra" },
  { date: "2026-07-29", name: "Muharram" },
  { date: "2026-08-15", name: "Independence Day", type: "national" },
  { date: "2026-08-26", name: "Raksha Bandhan" },
  { date: "2026-09-04", name: "Janmashtami" },
  { date: "2026-09-14", name: "Ganesh Chaturthi" },
  { date: "2026-09-25", name: "Eid e Milad" },
  { date: "2026-10-02", name: "Gandhi Jayanti", type: "national" },
  { date: "2026-10-19", name: "Dussehra" },
  { date: "2026-11-08", name: "Dhanteras" },
  { date: "2026-11-09", name: "Diwali" },
  { date: "2026-11-10", name: "Govardhan Puja" },
  { date: "2026-11-11", name: "Bhai Dooj" },
  { date: "2026-11-15", name: "Chhath Puja" },
  { date: "2026-11-24", name: "Guru Nanak Jayanti" },
  { date: "2026-12-25", name: "Christmas" },
  { date: "2027-01-01", name: "New Year's Day" },
  { date: "2027-01-14", name: "Makar Sankranti / Pongal" },
  { date: "2027-01-26", name: "Republic Day", type: "national" },
  { date: "2027-02-06", name: "Maha Shivaratri" },
  { date: "2027-03-22", name: "Holi" },
  { date: "2027-03-27", name: "Good Friday" },
  { date: "2027-04-15", name: "Ram Navami" },
  { date: "2027-05-16", name: "Eid ul-Fitr" },
  { date: "2027-08-15", name: "Independence Day", type: "national" },
  { date: "2027-08-25", name: "Janmashtami" },
  { date: "2027-10-02", name: "Gandhi Jayanti", type: "national" },
  { date: "2027-10-09", name: "Dussehra" },
  { date: "2027-10-29", name: "Diwali" },
  { date: "2027-12-25", name: "Christmas" },
];

/** Today's date in IST as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: IST });
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function humanDate(iso: string): string {
  return new Date(`${iso}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: IST,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function upcomingFestivals(limit = 5, now: Date = new Date()) {
  const today = todayIST(now);
  return FESTIVALS
    .filter((f) => f.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
    .map((f) => {
      const days = daysBetween(today, f.date);
      return {
        ...f,
        date_label: humanDate(f.date),
        days_remaining: days,
        when: days === 0 ? "aaj" : days === 1 ? "kal" : `${days} din baaki`,
      };
    });
}

/**
 * Full date/time + festival calendar snapshot.
 * `festival` (optional) does a fuzzy name lookup, e.g. "diwali", "holi".
 */
export function getCalendarInfo(
  opts: { festival?: string; limit?: number; now?: Date } = {},
) {
  const now = opts.now || new Date();
  const today = todayIST(now);
  const upcoming = upcomingFestivals(opts.limit ?? 8, now);

  let match: any = null;
  if (opts.festival) {
    const q = opts.festival.trim().toLowerCase();
    const hit = FESTIVALS
      .filter((f) => f.date >= today && f.name.toLowerCase().includes(q))
      .sort((a, b) => a.date.localeCompare(b.date))[0] ||
      FESTIVALS.filter((f) => f.name.toLowerCase().includes(q))
        .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (hit) {
      const days = daysBetween(today, hit.date);
      match = {
        ...hit,
        date_label: humanDate(hit.date),
        days_remaining: days,
        past: days < 0,
        when: days === 0
          ? "aaj hai"
          : days === 1
          ? "kal hai"
          : days > 0
          ? `${days} din baaki hain`
          : `${Math.abs(days)} din pehle tha`,
      };
    } else {
      match = {
        not_found: true,
        query: opts.festival,
        note:
          "Is naam ka festival calendar me nahi mila — user ko honestly batao, guess mat karo.",
      };
    }
  }

  return {
    success: true,
    timezone: IST,
    today: {
      date: today,
      date_label: humanDate(today),
      weekday: now.toLocaleDateString("en-IN", { timeZone: IST, weekday: "long" }),
      time: now.toLocaleTimeString("en-IN", {
        timeZone: IST,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      iso: now.toISOString(),
    },
    festival_lookup: match,
    upcoming_festivals: upcoming,
    next_festival: upcoming[0] || null,
    source: "Google Calendar — Indian Holidays (en.indian#holiday@group.v.calendar.google.com)",
  };
}
