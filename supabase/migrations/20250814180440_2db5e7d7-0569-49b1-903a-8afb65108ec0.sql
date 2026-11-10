-- Fix security warnings by updating functions with proper search paths
CREATE OR REPLACE FUNCTION public.update_points_balance()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_old_points()
RETURNS INTEGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
DECLARE
  expired_count INTEGER := 0;
BEGIN
  -- This function can be called by a cron job to expire points
  -- For now, it just marks transactions as expired
  UPDATE public.points_transactions
  SET metadata = metadata || '{"expired": true}'::jsonb
  WHERE expires_at <= now() 
  AND transaction_type = 'purchase'
  AND (metadata->>'expired')::boolean IS NOT TRUE;
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$;