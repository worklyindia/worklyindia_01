-- ============================================================================
-- Show created roles in UI: Make team_roles a unified VIEW (system + custom)
-- ============================================================================

-- 1) Create system_roles table for built-in roles
CREATE TABLE IF NOT EXISTS public.system_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text UNIQUE NOT NULL,
  role_description text,
  base_permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_custom boolean NOT NULL DEFAULT false,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and admin-only management
ALTER TABLE public.system_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read system roles" ON public.system_roles;
CREATE POLICY "Admins can read system roles"
ON public.system_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.role IN ('admin','owner')
  )
);

DROP POLICY IF EXISTS "Admins can manage system roles" ON public.system_roles;
CREATE POLICY "Admins can manage system roles"
ON public.system_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.role IN ('admin','owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.role IN ('admin','owner')
  )
);

-- 2) Copy existing rows from team_roles table into system_roles (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'team_roles'
  ) THEN
    INSERT INTO public.system_roles (id, role_name, role_description, base_permissions, is_custom, created_by, created_at, updated_at)
    SELECT id, role_name, role_description, base_permissions, COALESCE(is_custom, false), created_by, created_at, updated_at
    FROM public.team_roles
    ON CONFLICT (role_name) DO NOTHING;
  END IF;
END $$;

-- 3) Replace team_roles with a VIEW that unions system_roles + custom_roles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'team_roles'
  ) THEN
    EXECUTE 'DROP TABLE public.team_roles';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'team_roles'
  ) THEN
    EXECUTE 'DROP VIEW public.team_roles';
  END IF;
END $$;

CREATE VIEW public.team_roles AS
SELECT 
  sr.id,
  sr.role_name,
  sr.role_description,
  sr.base_permissions,
  false AS is_custom,
  sr.created_by,
  sr.created_at,
  sr.updated_at
FROM public.system_roles sr
UNION ALL
SELECT 
  cr.id,
  cr.role_name,
  cr.role_description,
  cr.permissions AS base_permissions,
  true AS is_custom,
  cr.created_by,
  cr.created_at,
  cr.updated_at
FROM public.custom_roles cr;

GRANT SELECT ON public.team_roles TO authenticated;

DO $$ BEGIN RAISE NOTICE '✅ Roles unified: team_roles now shows system + custom roles.'; END $$;