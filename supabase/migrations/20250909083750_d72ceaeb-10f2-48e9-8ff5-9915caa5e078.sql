-- Add RLS policies for owner portal tables

-- Enable RLS for edge_functions table
ALTER TABLE public.edge_functions ENABLE ROW LEVEL SECURITY;

-- Create edge_functions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.edge_functions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  code TEXT,
  config JSONB DEFAULT '{}',
  status TEXT DEFAULT 'inactive',
  last_deployed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID
);

-- RLS policies for edge_functions
CREATE POLICY "Only admins can manage edge functions" ON public.edge_functions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- Update existing RLS policies for better error handling
DROP POLICY IF EXISTS "Only admins can access function logs" ON public.function_logs;
CREATE POLICY "Only admins can access function logs" ON public.function_logs
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Only admins can access secrets management" ON public.secrets_management;
CREATE POLICY "Only admins can access secrets management" ON public.secrets_management
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- Create trigger for edge_functions updated_at
CREATE OR REPLACE FUNCTION public.update_edge_functions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_edge_functions_updated_at ON public.edge_functions;
CREATE TRIGGER update_edge_functions_updated_at
  BEFORE UPDATE ON public.edge_functions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_edge_functions_updated_at();