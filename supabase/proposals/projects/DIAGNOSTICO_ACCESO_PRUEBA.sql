-- SOLO LECTURA. Condiciones de acceso de la cuenta e institución de pruebas.
-- No inicia sesión ni modifica permisos o MFA.
SELECT p.email, p.mfa_required, p.mfa_enabled,
 i.slug AS institucion, i.is_active AS institucion_activa,
 m.is_active AS membresia_activa, r.name::text AS rol,
 (SELECT s.is_enabled FROM public.module_settings s
  WHERE s.institution_id=i.institution_id AND s.module_name='projects') AS proyectos_habilitados,
 (SELECT s.is_enabled FROM public.module_settings s
  WHERE s.institution_id=i.institution_id AND s.module_name='portal') AS portal_habilitado
FROM public.profiles p
LEFT JOIN public.institutions i ON i.slug='ue-el-esfuerzo'
LEFT JOIN public.memberships m ON m.profile_id=p.profile_id AND m.institution_id=i.institution_id
LEFT JOIN public.roles r ON r.role_id=m.role_id
WHERE lower(p.email)='midemera@espe.edu.ec';
