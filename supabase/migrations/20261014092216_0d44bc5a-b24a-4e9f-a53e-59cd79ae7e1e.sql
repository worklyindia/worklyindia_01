DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hero_banners') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hero_banners;
  END IF;
END $$;