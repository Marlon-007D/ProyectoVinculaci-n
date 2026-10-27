-- Execute and commit separately before 009_registration_requests.sql.
ALTER TYPE public.user_role_type ADD VALUE IF NOT EXISTS 'guest';
