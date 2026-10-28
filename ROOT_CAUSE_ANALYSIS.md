# Supabase Unhealthy / High-CPU Incident — Root Cause & Permanent Fix

## Symptom
- Supabase project on Free plan (Nano compute, 0.5 GB RAM, shared CPU) entered
  `RESTARTING` / `Unhealthy` state.
- Database, PostgREST, Auth and Storage all unhealthy simultaneously.
- CPU utilization near 100%, API success rate ~54%.
- Website intermittently failed to load data on some devices.

## Root Cause
The Nano compute instance was being CPU-saturated by a small number of hot
PostgREST queries that the frontend was issuing far too often. From
`pg_stat_statements`:

| Query | Calls | Total ms |
|---|---:|---:|
| `rpc get_active_hero_banners()` | 9,113 | 157,577 |
| `user_shares` per-user list | 21,930 | 12,613 |
| `home_trust_badges` list | 4,124 | 13,463 |
| `site_settings` key lookup | 2,889 | 11,561 |
| `device_info_logs` upsert / fingerprint lookups | ~4,400 | ~50,000 |
| `resume_drafts` upsert | 357 | 47,998 |
| `jobs` trending list (LATERAL join) | 1,262 | 21,008 |

Two categories of problem:

1. **Missing indexes** on `device_info_logs.canvas_fingerprint` and
   `device_info_logs.fingerprint_hash`, and no index that matches the
   `jobs` "active + public, order by trending_score" access path — those
   queries were doing full scans on every request.
2. **Frontend polling / no caching** on components that render on almost
   every page (HeroBanner, HomeTrustBadges, useSiteSettings social/contact/
   merchant, useShareTracking), so every route change or re-mount re-hit
   Postgres for identical data.

Combined, the Nano instance could not keep up and the health checks
tripped restarts.

## Permanent Fix
### Database (migration)
- `idx_device_info_canvas_updated` on `(canvas_fingerprint, updated_at DESC)`
- `idx_device_info_fingerprint_hash_updated` on
  `(fingerprint_hash, updated_at DESC)`
- `idx_home_trust_badges_active_sort` on `(is_active, sort_order)`
- `idx_jobs_active_public_trending` on `(trending_score DESC)`
  `WHERE status='active' AND visibility='public'`
- `ANALYZE` on the affected tables.

### Frontend
- `HeroBanner.tsx` — skip the RPC entirely when the 15 min localStorage
  cache is still fresh.
- `HomeTrustBadges.tsx` — added a 30 min localStorage cache; no query
  when cache is warm.
- `useSiteSettings.ts` — `useSocialLinks`, `useMerchantInfo`,
  `useContactInfo` now have `staleTime: 30 min`, `gcTime: 60 min`.
- `useShareTracking.ts` — migrated from `useState`/`useEffect` (which
  re-queried on every mount) to `useQuery` with `staleTime: 15 min`,
  `refetchOnMount/Focus/Reconnect: false`. `trackShare` invalidates the
  cache so the count still updates after a share.

The global `QueryClient` (`src/utils/queryClient.ts`) already enforces
30 min stale / 2 h gcTime and disables refetch-on-focus/mount/reconnect,
so all react-query consumers now cooperate with the free-plan budget.

## Expected Result
- ~9 k hero-banner RPC calls per hour → cache-first, one call per visitor
  per 15 min.
- Per-mount `user_shares` scans collapse into a single 15 min cached read
  per session.
- `device_info_logs` lookups now hit indexes instead of scanning.
- CPU headroom restored; PostgREST/Auth/Storage stop tripping health checks.

## Ongoing Monitoring
- Watch `Supabase → Reports → Database` for CPU / Disk IO.
- Re-run the `slow_queries` tool weekly; add indexes for any new
  offenders that appear above ~10 s total time.
- If usage still trends up, upgrade compute from Nano → Micro. Nano
  (0.5 GB RAM, shared CPU) has effectively no headroom for production
  traffic.
