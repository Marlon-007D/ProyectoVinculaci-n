-- Custom SQL migration file, put your code below! --
ALTER VIEW public.public_honors SET (security_invoker = true);

CREATE POLICY honors_published_public_read
  ON public.honors
  FOR SELECT
  TO anon
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1
      FROM public.institutions i
      WHERE i.institution_id = honors.institution_id
        AND i.is_active
    )
  );

CREATE POLICY students_published_honors_public_read
  ON public.students
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.honors h
      WHERE h.institution_id = students.institution_id
        AND h.student_id = students.student_id
        AND h.status = 'published'
    )
  );

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
  status
) ON public.honors TO anon;

GRANT SELECT (
  student_id,
  institution_id,
  first_name,
  last_name,
  grade_level
) ON public.students TO anon;
