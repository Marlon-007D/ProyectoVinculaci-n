-- Local proposal. Run each statement separately before 002_tenant_admin.sql.
ALTER TYPE public.user_role_type ADD VALUE IF NOT EXISTS 'teacher';
ALTER TYPE public.user_role_type ADD VALUE IF NOT EXISTS 'secretary';
ALTER TYPE public.user_role_type ADD VALUE IF NOT EXISTS 'staff';
