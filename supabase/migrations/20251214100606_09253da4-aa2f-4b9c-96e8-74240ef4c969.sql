-- Enable REPLICA IDENTITY FULL for real-time updates on profiles table
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Enable REPLICA IDENTITY FULL for real-time updates on companies table  
ALTER TABLE public.companies REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;