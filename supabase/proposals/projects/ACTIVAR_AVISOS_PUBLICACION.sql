-- Ejecutar en el SQL Editor del proyecto institucional. No modifica MFA.
-- Solo replica un contador público por institución; nunca borradores ni formularios.
BEGIN;
CREATE TABLE IF NOT EXISTS public.portal_publication_revisions (
 institution_id uuid PRIMARY KEY REFERENCES public.institutions(institution_id),
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0)
);
ALTER TABLE public.portal_publication_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_publication_revisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.portal_publication_revisions TO anon, authenticated;
DROP POLICY IF EXISTS public_portal_revision ON public.portal_publication_revisions;
CREATE POLICY public_portal_revision ON public.portal_publication_revisions FOR SELECT
 TO anon, authenticated USING (EXISTS (
 SELECT 1 FROM public.institutions i
 WHERE i.institution_id=portal_publication_revisions.institution_id AND i.is_active
));
CREATE OR REPLACE FUNCTION public.notify_portal_publication_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF coalesce(NEW.content_snapshot->>'publication_state','published') <> 'published' THEN
  RETURN NEW;
 END IF;
 INSERT INTO public.portal_publication_revisions AS revisions(institution_id,revision)
 SELECT p.institution_id,1 FROM public.pages p
 JOIN public.institutions i USING(institution_id)
 WHERE p.page_id=NEW.page_id AND p.status='published' AND i.is_active
 ON CONFLICT(institution_id) DO UPDATE SET revision=revisions.revision+1;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_portal_publication_revision() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS portal_publication_revision ON public.publication_versions;
CREATE TRIGGER portal_publication_revision AFTER INSERT ON public.publication_versions
 FOR EACH ROW EXECUTE FUNCTION public.notify_portal_publication_revision();
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  RAISE EXCEPTION 'No existe supabase_realtime. Habilitar Realtime antes de instalar los avisos.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
  AND schemaname='public' AND tablename='portal_publication_revisions') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_publication_revisions;
 END IF;
END;
$$;
COMMIT;
