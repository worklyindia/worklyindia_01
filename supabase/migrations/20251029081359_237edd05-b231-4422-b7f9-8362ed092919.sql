-- Create contact_information table for centralized contact management
CREATE TABLE IF NOT EXISTS public.contact_information (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  info_type TEXT NOT NULL UNIQUE, -- 'general', 'legal', 'support', 'fraud', etc.
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  additional_info JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_information ENABLE ROW LEVEL SECURITY;

-- Anyone can read active contact information
CREATE POLICY "Anyone can view active contact information"
  ON public.contact_information
  FOR SELECT
  USING (is_active = true);

-- Only admins can manage contact information
CREATE POLICY "Admins can manage contact information"
  ON public.contact_information
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('admin', 'owner')
    )
  );

-- Insert default contact information
INSERT INTO public.contact_information (info_type, email, phone, address, additional_info) VALUES
('general', 'Workly India.india.24x7@gmail.com', '+91 9904923067', 'Workly India Vishalbhai Muljibhai Gohil, Gohil sheri, Sankhewsar, Patan, Gujarat, India - 384246', '{"hours": "9 AM - 6 PM (Mon-Fri)"}'::jsonb),
('legal', 'Workly India.india.24x7@gmail.com', '+91 9904923067', 'Workly India Vishalbhai Muljibhai Gohil, Gohil sheri, Sankhewsar, Patan, Gujarat, PIN: 384246', '{}'::jsonb),
('support', 'Workly India.india.24x7@gmail.com', '+91 9904923067', 'Workly India Vishalbhai Muljibhai Gohil, Gohil sheri, Sankhewsar, Patan, Gujarat, PIN: 384246', '{"availability": "24/7"}'::jsonb),
('fraud', 'Workly India.india.24x7@gmail.com', '+91 9904923067-FRAUD-HELP', 'Workly India Vishalbhai Muljibhai Gohil, Gohil sheri, Sankhewsar, Patan, Gujarat, PIN: 384246', '{"cybercrime_portal": "cybercrime.gov.in", "police_helpline": "1930"}'::jsonb)
ON CONFLICT (info_type) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_contact_information_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contact_information_updated_at
  BEFORE UPDATE ON public.contact_information
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_information_updated_at();