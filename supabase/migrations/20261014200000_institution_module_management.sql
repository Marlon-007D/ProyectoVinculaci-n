-- Configuración individual de los cinco accesos principales por institución.
-- Aplicar después de database/script.sql y database/superadmin.sql.
BEGIN;

INSERT INTO public.module_settings (institution_id, module_name, is_enabled)
SELECT i.institution_id, modules.module_name, TRUE
FROM public.institutions AS i
CROSS JOIN (VALUES ('inicio'), ('projects'), ('dece'), ('simuladores'), ('portal')) AS modules(module_name)
ON CONFLICT (institution_id, module_name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_institution_module_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.module_settings (institution_id, module_name, is_enabled)
  VALUES
    (NEW.institution_id, 'inicio', TRUE),
    (NEW.institution_id, 'projects', TRUE),
    (NEW.institution_id, 'dece', TRUE),
    (NEW.institution_id, 'simuladores', TRUE),
    (NEW.institution_id, 'portal', TRUE)
  ON CONFLICT (institution_id, module_name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_institution_module_settings_trigger ON public.institutions;
CREATE TRIGGER seed_institution_module_settings_trigger
AFTER INSERT ON public.institutions
FOR EACH ROW EXECUTE FUNCTION public.seed_institution_module_settings();

CREATE OR REPLACE FUNCTION public.get_accessible_module_settings()
RETURNS TABLE (
  module_setting_id UUID,
  institution_id UUID,
  module_name TEXT,
  is_enabled BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ms.module_setting_id, ms.institution_id, ms.module_name::TEXT, ms.is_enabled
  FROM public.module_settings AS ms
  WHERE auth.uid() IS NOT NULL
    AND (
      public.is_super_admin()
      OR public.is_member_of_institution(ms.institution_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.set_institution_module_enabled(
  target_institution_id UUID,
  target_module_name TEXT,
  target_is_enabled BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  saved_setting_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo el superadministrador global puede configurar los módulos.'
      USING ERRCODE = '42501';
  END IF;

  IF target_module_name NOT IN ('inicio', 'projects', 'dece', 'simuladores', 'portal') THEN
    RAISE EXCEPTION 'El módulo solicitado no es válido.';
  END IF;

  INSERT INTO public.module_settings (institution_id, module_name, is_enabled)
  SELECT i.institution_id, target_module_name, target_is_enabled
  FROM public.institutions AS i
  WHERE i.institution_id = target_institution_id
  ON CONFLICT (institution_id, module_name)
  DO UPDATE SET is_enabled = EXCLUDED.is_enabled
  RETURNING module_setting_id INTO saved_setting_id;

  IF saved_setting_id IS NULL THEN
    RAISE EXCEPTION 'La institución no existe.';
  END IF;

  RETURN saved_setting_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_accessible_module_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_institution_module_enabled(UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_accessible_module_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_institution_module_enabled(UUID, TEXT, BOOLEAN) TO authenticated;

COMMIT;
