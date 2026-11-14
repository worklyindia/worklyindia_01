-- ON CONFLICT DO NOTHING requires SELECT privilege for the unique-key check.
-- RLS intentionally has no SELECT policy for anon, so no rows are exposed.
grant select on public.app_anonymous_installations to anon;
grant select on public.app_anonymous_sessions to anon;
