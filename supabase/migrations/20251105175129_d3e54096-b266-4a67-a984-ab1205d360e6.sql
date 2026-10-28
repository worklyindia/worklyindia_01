-- Create the handle_updated_at function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply trigger to api_keys table
DROP TRIGGER IF EXISTS set_updated_at ON public.api_keys;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Apply trigger to secrets_management table
DROP TRIGGER IF EXISTS set_updated_at ON public.secrets_management;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.secrets_management
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Apply trigger to edge_functions table
DROP TRIGGER IF EXISTS set_updated_at ON public.edge_functions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.edge_functions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();