ALTER TABLE public.developer_oauth_apps ADD COLUMN encrypted_client_secret text;
REVOKE SELECT ON public.developer_oauth_apps FROM authenticated;
GRANT SELECT (id, user_id, client_id, client_name, redirect_uris, client_type, created_at) ON public.developer_oauth_apps TO authenticated;