-- Create point_adjustments table for manual point changes
CREATE TABLE public.point_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  points INTEGER NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('add', 'deduct')),
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.point_adjustments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own point adjustments" 
ON public.point_adjustments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can create point adjustments" 
ON public.point_adjustments 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

CREATE POLICY "Admins can view all point adjustments" 
ON public.point_adjustments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- Create function to handle point adjustments
CREATE OR REPLACE FUNCTION public.adjust_wallet_points(
  p_user_id UUID,
  p_points INTEGER,
  p_adjustment_type TEXT,
  p_reason TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Insert adjustment record
  INSERT INTO public.point_adjustments (
    user_id,
    admin_id,
    points,
    adjustment_type,
    reason
  ) VALUES (
    p_user_id,
    auth.uid(),
    p_points,
    p_adjustment_type,
    p_reason
  );

  -- Update wallet
  IF p_adjustment_type = 'add' THEN
    INSERT INTO public.wallets (user_id, balance_points)
    VALUES (p_user_id, p_points)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      balance_points = wallets.balance_points + p_points,
      updated_at = now();
  ELSE
    INSERT INTO public.wallets (user_id, balance_points, total_spent)
    VALUES (p_user_id, -p_points, p_points)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      balance_points = GREATEST(wallets.balance_points - p_points, 0),
      total_spent = wallets.total_spent + p_points,
      updated_at = now();
  END IF;
END;
$$;