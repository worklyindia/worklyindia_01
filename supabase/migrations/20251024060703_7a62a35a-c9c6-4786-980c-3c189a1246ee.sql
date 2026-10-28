-- Ensure realtime emits full row data and table is in publication
ALTER TABLE public.job_interactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_interactions;

-- Grant execute on RPCs used by the app
GRANT EXECUTE ON FUNCTION public.log_profile_view(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile_views_with_period(uuid) TO anon, authenticated;