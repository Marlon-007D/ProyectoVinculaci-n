-- Custom SQL migration file, put your code below! --
ALTER TABLE public.honors
  ADD COLUMN honor_category text NOT NULL DEFAULT 'institutional',
  ADD COLUMN official_order integer,
  ADD COLUMN schedule text,
  ADD COLUMN modality text,
  ADD COLUMN campus text,
  ADD COLUMN status text NOT NULL DEFAULT 'published';

ALTER TABLE public.honors
  ADD CONSTRAINT honors_category_check
    CHECK (honor_category IN ('official', 'institutional')),
  ADD CONSTRAINT honors_status_check
    CHECK (status IN ('draft', 'published')),
  ADD CONSTRAINT honors_official_order_check
    CHECK (
      (honor_category = 'official' AND official_order BETWEEN 1 AND 9)
      OR (honor_category = 'institutional' AND official_order IS NULL)
    ),
  ADD CONSTRAINT honors_official_details_check
    CHECK (
      honor_category <> 'official'
      OR (schedule IS NOT NULL AND modality IS NOT NULL)
    );

CREATE UNIQUE INDEX honors_official_position_key
  ON public.honors (institution_id, academic_period_id, official_order)
  WHERE honor_category = 'official';

CREATE UNIQUE INDEX honors_official_student_period_key
  ON public.honors (institution_id, academic_period_id, student_id)
  WHERE honor_category = 'official';

CREATE FUNCTION public.validate_official_honor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  student_grade text;
  expected_order integer;
BEGIN
  IF NEW.honor_category <> 'official' THEN
    RETURN NEW;
  END IF;

  SELECT s.grade_level INTO student_grade
  FROM public.students s
  WHERE s.student_id = NEW.student_id
    AND s.institution_id = NEW.institution_id;

  IF student_grade IS NULL OR lower(student_grade) !~ 'tercero.*bachillerato|^tercero\s+(de\s+)?bgu$|^3(ro|ero|er|º)?\s*(bgu|bachillerato)$' THEN
    RAISE EXCEPTION 'Las distinciones oficiales solo corresponden a estudiantes de tercero de Bachillerato.'
      USING ERRCODE = '23514';
  END IF;

  expected_order := CASE NEW.achievement
    WHEN 'Abanderado del Pabellón Nacional' THEN 1
    WHEN 'Portaestandarte de la ciudad' THEN 2
    WHEN 'Portaestandarte del plantel' THEN 3
    WHEN '1er. escolta del Pabellón Nacional' THEN 4
    WHEN '2do. escolta del Pabellón Nacional' THEN 5
    WHEN '1er. escolta del estandarte de la ciudad' THEN 6
    WHEN '2do. escolta del estandarte de la ciudad' THEN 7
    WHEN '1er. escolta del estandarte del plantel' THEN 8
    WHEN '2do. escolta del estandarte del plantel' THEN 9
    ELSE NULL
  END;

  IF expected_order IS NULL OR NEW.official_order <> expected_order THEN
    RAISE EXCEPTION 'La distinción oficial y su orden no coinciden.'
      USING ERRCODE = '23514';
  END IF;
  IF NULLIF(btrim(NEW.schedule), '') IS NULL OR NULLIF(btrim(NEW.modality), '') IS NULL THEN
    RAISE EXCEPTION 'Completa la jornada y la modalidad de la distinción oficial.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_official_honor() FROM PUBLIC;

CREATE TRIGGER honors_validate_official
  BEFORE INSERT OR UPDATE ON public.honors
  FOR EACH ROW EXECUTE FUNCTION public.validate_official_honor();

CREATE OR REPLACE VIEW public.public_honors AS
SELECT
  h.honor_id,
  h.institution_id,
  h.academic_period_id,
  h.achievement,
  h.score,
  h.photo_url,
  (s.first_name::text || ' '::text) || s.last_name::text AS student_name,
  s.grade_level,
  h.schedule,
  h.honor_category,
  h.official_order,
  h.modality,
  h.campus
FROM public.honors h
JOIN public.students s
  ON s.institution_id = h.institution_id
 AND s.student_id = h.student_id
JOIN public.institutions i
  ON i.institution_id = h.institution_id
WHERE i.is_active
  AND h.status = 'published';
