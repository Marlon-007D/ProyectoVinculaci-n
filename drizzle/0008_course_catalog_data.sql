ALTER TABLE public.course_categories ADD COLUMN slug text;
ALTER TABLE public.course_categories ADD CONSTRAINT course_categories_slug_not_empty CHECK (length(trim(slug)) > 0);
CREATE UNIQUE INDEX course_categories_institution_slug_key ON public.course_categories (institution_id, slug);

ALTER TABLE public.course_modules ADD COLUMN slug text;
ALTER TABLE public.course_modules ADD COLUMN topics jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.course_modules ADD CONSTRAINT course_modules_slug_not_empty CHECK (length(trim(slug)) > 0);
ALTER TABLE public.course_modules ADD CONSTRAINT course_modules_topics_array CHECK (jsonb_typeof(topics) = 'array');
CREATE UNIQUE INDEX course_modules_institution_slug_key ON public.course_modules (institution_id, slug);
