-- Fix security warning: Set search_path for functions
ALTER FUNCTION public.get_brand_assets() SET search_path = public;
ALTER FUNCTION public.update_brand_assets(jsonb) SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;