-- Create certifications table
CREATE TABLE public.certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  certification_name TEXT NOT NULL,
  issuing_organization TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  credential_id TEXT,
  credential_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

-- Create policies for certifications
CREATE POLICY "Users can view their own certifications" 
ON public.certifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own certifications" 
ON public.certifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own certifications" 
ON public.certifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own certifications" 
ON public.certifications 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add languages array column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN languages TEXT[];

-- Create trigger for automatic timestamp updates on certifications
CREATE TRIGGER update_certifications_updated_at
BEFORE UPDATE ON public.certifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();