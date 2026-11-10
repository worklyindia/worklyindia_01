-- Support Tickets Table for AI Career Chat
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  conversation_context JSONB,
  ai_attempted_solutions JSONB,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket Counter for sequential numbering
CREATE TABLE public.ticket_counter (
  id TEXT PRIMARY KEY DEFAULT 'default',
  current_year INTEGER NOT NULL,
  current_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize counter
INSERT INTO public.ticket_counter (id, current_year, current_number) 
VALUES ('default', EXTRACT(YEAR FROM NOW())::INTEGER, 0);

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER;
  v_number INTEGER;
  v_ticket_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
  
  -- Update counter and get new number
  UPDATE ticket_counter 
  SET 
    current_number = CASE 
      WHEN current_year = v_year THEN current_number + 1 
      ELSE 1 
    END,
    current_year = v_year,
    updated_at = NOW()
  WHERE id = 'default'
  RETURNING current_number INTO v_number;
  
  -- Format: WFH-2024-00001
  v_ticket_number := 'WFH-' || v_year || '-' || LPAD(v_number::TEXT, 5, '0');
  
  RETURN v_ticket_number;
END;
$$;

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_counter ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
CREATE POLICY "Users can view their own tickets"
ON public.support_tickets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own tickets"
ON public.support_tickets FOR UPDATE
USING (auth.uid() = user_id);

-- Admin policy (assuming admin_users table exists)
CREATE POLICY "Admins can view all tickets"
ON public.support_tickets FOR SELECT
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can update all tickets"
ON public.support_tickets FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access"
ON public.support_tickets FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Ticket counter - only service role
CREATE POLICY "Service role can manage counter"
ON public.ticket_counter FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes for performance
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX idx_support_tickets_ticket_number ON public.support_tickets(ticket_number);

-- Updated_at trigger
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();