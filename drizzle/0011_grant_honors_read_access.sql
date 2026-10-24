-- The administrative board loads only these fields.  The existing RLS
-- policies continue to restrict every query to the active institution.
GRANT SELECT (
  honor_id,
  institution_id,
  academic_period_id,
  student_id,
  achievement,
  score,
  photo_url,
  schedule,
  honor_category,
  official_order,
  modality,
  campus,
  status,
  updated_at
) ON public.honors TO authenticated;

GRANT SELECT (
  academic_period_id,
  institution_id,
  name,
  start_date,
  end_date,
  is_active,
  updated_at
) ON public.academic_periods TO authenticated;

GRANT SELECT (
  student_id,
  institution_id,
  first_name,
  last_name,
  grade_level
) ON public.students TO authenticated;
