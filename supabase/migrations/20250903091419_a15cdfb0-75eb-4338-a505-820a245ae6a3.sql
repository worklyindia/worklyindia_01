-- Enhance companies table for proper employer authentication
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS district TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS company_details TEXT,
ADD COLUMN IF NOT EXISTS organisation_size TEXT,
ADD COLUMN IF NOT EXISTS interview_contact_details TEXT;

-- Create trigger to update employer metrics when company profile is updated
CREATE OR REPLACE TRIGGER update_employer_metrics_on_company_update
AFTER INSERT OR UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_employer_metrics();