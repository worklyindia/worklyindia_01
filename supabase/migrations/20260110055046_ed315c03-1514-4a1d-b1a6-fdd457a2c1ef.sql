-- Add slug and short_id columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS short_id TEXT;

-- Add slug and short_id columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS public_slug TEXT,
ADD COLUMN IF NOT EXISTS short_id TEXT;

-- Create unique indexes for companies
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_slug ON public.companies(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_short_id ON public.companies(short_id) WHERE short_id IS NOT NULL;

-- Create unique indexes for profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_public_slug ON public.profiles(public_slug) WHERE public_slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_short_id ON public.profiles(short_id) WHERE short_id IS NOT NULL;

-- Function to generate URL-friendly slug from text
CREATE OR REPLACE FUNCTION public.generate_slug(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  slug TEXT;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  slug := lower(trim(input_text));
  slug := regexp_replace(slug, '[^a-z0-9\s-]', '', 'g');
  slug := regexp_replace(slug, '\s+', '-', 'g');
  slug := regexp_replace(slug, '-+', '-', 'g');
  slug := trim(both '-' from slug);
  
  -- Limit length to 100 chars
  IF length(slug) > 100 THEN
    slug := left(slug, 100);
    slug := trim(both '-' from slug);
  END IF;
  
  RETURN slug;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to generate unique short ID
CREATE OR REPLACE FUNCTION public.generate_short_id(prefix TEXT, length INT DEFAULT 6)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := prefix;
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to generate unique company slug
CREATE OR REPLACE FUNCTION public.generate_unique_company_slug(company_name TEXT, company_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  base_slug := public.generate_slug(company_name);
  final_slug := base_slug;
  
  -- Check for duplicates and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.companies WHERE slug = final_slug AND id != company_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to generate unique profile slug
CREATE OR REPLACE FUNCTION public.generate_unique_profile_slug(full_name TEXT, city TEXT, profile_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  -- Combine name with city for uniqueness
  IF city IS NOT NULL AND city != '' THEN
    base_slug := public.generate_slug(full_name || ' ' || city);
  ELSE
    base_slug := public.generate_slug(full_name);
  END IF;
  
  final_slug := base_slug;
  
  -- Check for duplicates and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE public_slug = final_slug AND id != profile_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger function to auto-generate company slug and short_id
CREATE OR REPLACE FUNCTION public.auto_generate_company_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate slug if not provided or if company_name changed
  IF NEW.slug IS NULL OR (TG_OP = 'UPDATE' AND OLD.company_name != NEW.company_name AND NEW.slug = OLD.slug) THEN
    NEW.slug := public.generate_unique_company_slug(NEW.company_name, NEW.id);
  END IF;
  
  -- Generate short_id if not provided
  IF NEW.short_id IS NULL THEN
    NEW.short_id := public.generate_short_id('c-');
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.companies WHERE short_id = NEW.short_id AND id != NEW.id) LOOP
      NEW.short_id := public.generate_short_id('c-');
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger function to auto-generate profile slug and short_id
CREATE OR REPLACE FUNCTION public.auto_generate_profile_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate slug if not provided or if full_name changed
  IF NEW.public_slug IS NULL OR (TG_OP = 'UPDATE' AND OLD.full_name != NEW.full_name AND NEW.public_slug = OLD.public_slug) THEN
    NEW.public_slug := public.generate_unique_profile_slug(COALESCE(NEW.full_name, 'user'), NEW.city, NEW.id);
  END IF;
  
  -- Generate short_id if not provided
  IF NEW.short_id IS NULL THEN
    NEW.short_id := public.generate_short_id('u-');
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE short_id = NEW.short_id AND id != NEW.id) LOOP
      NEW.short_id := public.generate_short_id('u-');
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_auto_company_slug ON public.companies;
CREATE TRIGGER trigger_auto_company_slug
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_company_slug();

DROP TRIGGER IF EXISTS trigger_auto_profile_slug ON public.profiles;
CREATE TRIGGER trigger_auto_profile_slug
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_profile_slug();

-- Backfill existing companies with slugs
UPDATE public.companies 
SET slug = public.generate_unique_company_slug(company_name, id),
    short_id = public.generate_short_id('c-')
WHERE slug IS NULL OR short_id IS NULL;

-- Backfill existing profiles with slugs
UPDATE public.profiles 
SET public_slug = public.generate_unique_profile_slug(COALESCE(full_name, 'user'), city, id),
    short_id = public.generate_short_id('u-')
WHERE public_slug IS NULL OR short_id IS NULL;