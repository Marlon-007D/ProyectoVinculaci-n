-- Read-only operator audit. No accounts or memberships are created automatically.
SELECT i.institution_id, i.slug, count(m.profile_id) AS active_super_admins
FROM public.institutions i
LEFT JOIN public.memberships m ON m.institution_id=i.institution_id AND m.is_active
 AND EXISTS(SELECT 1 FROM public.roles r WHERE r.role_id=m.role_id AND r.name::text IN ('super_admin','superadmin'))
WHERE i.is_active
GROUP BY i.institution_id,i.slug
HAVING count(m.profile_id)<>1;
