ALTER TABLE public.razorpay_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.razorpay_events;