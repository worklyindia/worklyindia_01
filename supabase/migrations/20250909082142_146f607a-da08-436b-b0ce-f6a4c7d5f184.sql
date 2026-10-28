-- Create edge_functions table for tracking deployed functions
CREATE TABLE public.edge_functions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  code TEXT,
  config JSONB DEFAULT '{}',
  last_deployed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create secrets_management table for tracking secrets (not storing values)
CREATE TABLE public.secrets_management (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  secret_key TEXT NOT NULL UNIQUE,
  description TEXT,
  used_by_functions TEXT[] DEFAULT '{}',
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create function_logs table for execution monitoring
CREATE TABLE public.function_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  execution_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  execution_time_ms INTEGER,
  error_message TEXT,
  request_data JSONB,
  response_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.edge_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secrets_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.function_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - only admin users can access
CREATE POLICY "Only admins can access edge functions" ON public.edge_functions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ));

CREATE POLICY "Only admins can access secrets management" ON public.secrets_management
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ));

CREATE POLICY "Only admins can access function logs" ON public.function_logs
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_edge_functions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for edge_functions
CREATE TRIGGER update_edge_functions_updated_at
  BEFORE UPDATE ON public.edge_functions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_edge_functions_updated_at();