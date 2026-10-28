// =============================================================================
// Ban guard — banned users receive NO notifications until unbanned.
// -----------------------------------------------------------------------------
// The ban is checked on the SIDE the message belongs to:
//   job-seeker message -> profiles.account_status
//   employer message   -> companies.account_status
//   Auth Users ban     -> blocks BOTH sides (the whole login is suspended)
// So banning someone's job seeker profile silences only their job seeker
// notifications; their employer profile keeps working, and vice versa.
//
// The push token stays stored — only delivery is blocked.
// Ban / unban lifecycle messages themselves are exempt so the user is still
// told about the suspension and the restoration.
// This helper never throws — a lookup failure must not break notifications
// (fail-open: when unsure, the notification is allowed).
// =============================================================================

export type NotifySide = 'job_seeker' | 'employer' | 'any';

export const BANNED_STATUSES = new Set(['banned', 'fully_banned']);

/** Events that must still reach a banned user (the ban notice + unban notice). */
export const BAN_EXEMPT_EVENTS = new Set([
  'account_banned_job_seeker',
  'account_unbanned_job_seeker',
  'account_banned_employer',
  'account_unbanned_employer',
  'job_apply_banned',
  'job_apply_unbanned',
  'job_posting_banned',
  'job_posting_unbanned',
  'job_seeker_account_deleted',
  'employer_account_deleted',
]);

export function isBanExemptEvent(eventType?: string | null): boolean {
  return !!eventType && BAN_EXEMPT_EVENTS.has(eventType);
}

async function statusBanned(
  supabase: any,
  table: 'profiles' | 'companies',
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from(table)
    .select('account_status')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data?.account_status && BANNED_STATUSES.has(String(data.account_status));
}

/**
 * Single-user ban check for one side of the marketplace.
 * Set checkAuth=true on single-recipient paths to also honour Auth Users bans
 * (the auth.admin lookup is per-user, so it is skipped in bulk).
 */
export async function isUserBanned(
  supabase: any,
  userId: string,
  options: { side?: NotifySide; checkAuth?: boolean } = {},
): Promise<boolean> {
  if (!userId) return false;
  const side: NotifySide = options.side ?? 'any';
  try {
    if (side !== 'employer' && (await statusBanned(supabase, 'profiles', userId))) return true;
    if (side !== 'job_seeker' && (await statusBanned(supabase, 'companies', userId))) return true;

    // An Auth Users ban suspends the whole login, so it blocks both sides.
    if (options.checkAuth) {
      const { data } = await supabase.auth.admin.getUserById(userId);
      const bannedUntil = data?.user?.banned_until;
      if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) return true;
    }
  } catch (err) {
    console.warn('[banGuard] lookup failed, allowing notification:', err);
  }
  return false;
}

/**
 * Bulk filter used by fan-out / broadcast pushes, which carry no single event,
 * so both sides are checked. Auth bans are enforced on the single-recipient path.
 */
export async function filterBannedUsers(
  supabase: any,
  userIds: string[],
  side: NotifySide = 'any',
): Promise<string[]> {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  if (ids.length === 0) return [];
  try {
    const [profileRows, companyRows] = await Promise.all([
      side === 'employer'
        ? Promise.resolve({ data: [] })
        : supabase.from('profiles').select('user_id, account_status').in('user_id', ids),
      side === 'job_seeker'
        ? Promise.resolve({ data: [] })
        : supabase.from('companies').select('user_id, account_status').in('user_id', ids),
    ]);
    const banned = new Set<string>();
    for (const row of [...(profileRows?.data || []), ...(companyRows?.data || [])]) {
      if (row?.user_id && BANNED_STATUSES.has(String(row.account_status))) banned.add(row.user_id);
    }
    return ids.filter((id) => !banned.has(id));
  } catch (err) {
    console.warn('[banGuard] bulk filter failed, allowing all recipients:', err);
    return ids;
  }
}
