-- Upserts on app_installations use ON CONFLICT DO UPDATE.
-- PostgreSQL requires the conflicting row to be visible to the authenticated user.
-- Keep visibility limited to the user's own installation; owner access remains governed
-- by the existing owner-read policy.
create policy "Users read their own app installations"
on public.app_installations
for select
to authenticated
using ((select auth.uid()) = user_id);
